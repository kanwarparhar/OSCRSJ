'use client'

import { useRef, useState } from 'react'
import {
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'

// The command Kanwar pastes into the VS Code integrated terminal to
// bring the local renderer back up. `npm run dev` matches the error
// text ("Is the local renderer dev server running") and needs no
// build step, so it's the fastest path to a working preview.
const RENDERER_START_COMMAND = 'cd ~/Documents/oscrsj-renderer && npm run dev'

// Recognize the "renderer is not running on the Mac" failure so the
// card can show start-it-yourself instructions instead of a bare
// error string. Matches the API route's 502 message
// ("Could not reach renderer at …: fetch failed. Is the local
// renderer dev server running on Kanwar's Mac?").
function isRendererUnreachable(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('could not reach renderer') ||
    m.includes('renderer dev server running') ||
    (m.includes('502') && m.includes('fetch failed'))
  )
}

// Franklin §6 four-state inline-card pattern (Sushant Session 57,
// Phase 1.C). Replaces the static "preview pane" placeholder in
// MetadataEditorForm with a live NDJSON-stream-driven status card.
//
// States:
//   idle     — nothing's been clicked; CTA is just "Open preview ↗"
//   in_flight— NDJSON stream open; render chain stages tick
//   success  — preview ready; signed URL + verdict line + Regenerate
//   failure  — first error sentence + expandable full report

type ChainStage =
  | 'tool_probe'
  | 'sanity'
  | 'xmp_build'
  | 'jinja'
  | 'weasyprint'
  | 'ghostscript'
  | 'verapdf'
  | 'jats_generate'
  | 'jats_validate'
  | 'report'
  | 'upload'
  | 'writeback'
  | 'done'

interface ChainEvent {
  stage: ChainStage
  status: 'started' | 'ok' | 'warn' | 'fail'
  message?: string
  data?: Record<string, unknown>
  wallclockSeconds: number
}

const STAGE_LABEL: Record<ChainStage, string> = {
  tool_probe: 'Probe tools',
  sanity: 'Run sanity tests',
  xmp_build: 'Build XMP packet',
  jinja: 'Render Jinja template',
  weasyprint: 'Render PDF (WeasyPrint)',
  ghostscript: 'Ghostscript pass',
  verapdf: 'verapdf validate',
  jats_generate: 'JATS XML generate',
  jats_validate: 'JATS XML validate',
  report: 'Assemble render-report.json',
  upload: 'Upload preview PDF',
  writeback: 'Write storage paths',
  done: 'Done',
}

const STAGE_ORDER: ChainStage[] = [
  'tool_probe',
  'sanity',
  'xmp_build',
  'jinja',
  'weasyprint',
  'ghostscript',
  'verapdf',
  'jats_generate',
  'jats_validate',
  'report',
  'upload',
]

interface Props {
  manuscriptId: string
  disabled: boolean
  disabledReason: string | null
}

type FormState =
  | { kind: 'idle' }
  | { kind: 'in_flight'; stages: Record<string, 'started' | 'ok' | 'warn' | 'fail'>; latestStage: ChainStage }
  | {
      kind: 'success'
      signedUrl: string
      expiresAt: string
      verapdfPassed: boolean
      jatsPassed: boolean
      pageCount: number | null
      pdfBytes: number | null
    }
  | { kind: 'failure'; firstError: string; fullReport: ChainEvent[] }

export default function PreviewRenderCluster({
  manuscriptId,
  disabled,
  disabledReason,
}: Props) {
  const [state, setState] = useState<FormState>({ kind: 'idle' })
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function copyStartCommand() {
    try {
      await navigator.clipboard.writeText(RENDERER_START_COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked — user selects the text manually
    }
  }

  async function runPreview() {
    if (disabled) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const stages: Record<string, 'started' | 'ok' | 'warn' | 'fail'> = {}
    setState({ kind: 'in_flight', stages, latestStage: 'tool_probe' })

    const events: ChainEvent[] = []
    let firstError: string | null = null
    let successData: {
      signedUrl?: string
      expiresAt?: string
      verapdfPassed?: boolean
      jatsPassed?: boolean
      pageCount?: number | null
      pdfBytes?: number | null
    } = {}

    try {
      const resp = await fetch(`/api/preview/${manuscriptId}`, {
        method: 'POST',
        signal: controller.signal,
      })
      if (!resp.ok) {
        let body = ''
        try {
          body = await resp.text()
        } catch {}
        setState({
          kind: 'failure',
          firstError: `Preview request returned ${resp.status}: ${body || resp.statusText}`,
          fullReport: [],
        })
        return
      }
      if (!resp.body) {
        setState({
          kind: 'failure',
          firstError: 'Response body is empty.',
          fullReport: [],
        })
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as ChainEvent
            events.push(event)

            // Track stage state for in-flight display.
            stages[event.stage] = event.status
            setState((prev) => {
              if (prev.kind !== 'in_flight') return prev
              return {
                kind: 'in_flight',
                stages: { ...prev.stages, [event.stage]: event.status },
                latestStage: event.stage,
              }
            })

            // Capture failure and success data.
            if (event.status === 'fail' && !firstError) {
              firstError = event.message || `Stage ${event.stage} failed.`
            }
            if (event.stage === 'done' && event.status === 'ok' && event.data) {
              const d = event.data
              successData = {
                signedUrl: d.signedUrl as string | undefined,
                expiresAt: d.expiresAt as string | undefined,
                verapdfPassed: d.verapdfPassed as boolean | undefined,
                jatsPassed: d.jatsValidationPassed as boolean | undefined,
                pageCount: (d.pageCount as number | null | undefined) ?? null,
                pdfBytes: (d.pdfBytes as number | null | undefined) ?? null,
              }
            }
          } catch {
            // Malformed NDJSON line — ignore.
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setState({
        kind: 'failure',
        firstError: `Stream failed: ${err instanceof Error ? err.message : String(err)}`,
        fullReport: events,
      })
      return
    }

    if (firstError) {
      setState({
        kind: 'failure',
        firstError,
        fullReport: events,
      })
      return
    }

    if (successData.signedUrl) {
      setState({
        kind: 'success',
        signedUrl: successData.signedUrl,
        expiresAt: successData.expiresAt || '',
        verapdfPassed: successData.verapdfPassed ?? false,
        jatsPassed: successData.jatsPassed ?? false,
        pageCount: successData.pageCount ?? null,
        pdfBytes: successData.pdfBytes ?? null,
      })
      // Auto-open the preview in a new tab.
      try {
        window.open(successData.signedUrl, '_blank', 'noopener,noreferrer')
      } catch {
        // popup blocker — user clicks the button instead
      }
      return
    }

    setState({
      kind: 'failure',
      firstError: 'Stream ended without a signed URL.',
      fullReport: events,
    })
  }

  if (state.kind === 'idle') {
    return (
      <div>
        <button
          type="button"
          onClick={runPreview}
          disabled={disabled}
          title={disabledReason || ''}
          className={`btn-primary-light ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Open preview ↗
        </button>
        <p className="editor-field-hint mt-2">
          Generates a non-publishing PDF artifact. 24h signed URL · 7-day Storage retention.
        </p>
        {disabledReason && (
          <p className="text-xs text-brown italic mt-1">{disabledReason}</p>
        )}
      </div>
    )
  }

  if (state.kind === 'in_flight') {
    return (
      <div className="preview-status-card">
        <p className="text-sm font-medium text-brown-dark flex items-center gap-2">
          <ArrowPathIcon className="w-4 h-4 animate-spin text-amber-700" />
          Preview in progress · {STAGE_LABEL[state.latestStage]}…
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          {STAGE_ORDER.map((s) => {
            const status = state.stages[s]
            const icon =
              status === 'ok' || status === 'warn'
                ? '✓'
                : status === 'fail'
                  ? '✗'
                  : status === 'started'
                    ? '⏳'
                    : '○'
            const colorClass =
              status === 'ok' || status === 'warn'
                ? 'text-green-700'
                : status === 'fail'
                  ? 'text-red-700'
                  : status === 'started'
                    ? 'text-amber-700'
                    : 'text-brown'
            return (
              <p key={s} className={colorClass}>
                {icon} {STAGE_LABEL[s]}
              </p>
            )
          })}
        </div>
      </div>
    )
  }

  if (state.kind === 'success') {
    const formattedBytes = state.pdfBytes
      ? state.pdfBytes < 1024 * 1024
        ? `${(state.pdfBytes / 1024).toFixed(1)} KB`
        : `${(state.pdfBytes / 1024 / 1024).toFixed(1)} MB`
      : '—'
    return (
      <div className="preview-result-success">
        <p className="text-sm font-medium text-green-900 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4" />
          Preview ready
        </p>
        <p className="text-xs text-green-900">
          PDF/A-1b: {state.verapdfPassed ? 'clean' : 'failed'} · JATS:{' '}
          {state.jatsPassed ? '0 errors' : 'failed'}
          {state.pageCount ? ` · ${state.pageCount} pages` : ''} · {formattedBytes}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={state.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary-light text-xs inline-flex items-center gap-1.5"
          >
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            Open preview PDF
          </a>
          <button
            type="button"
            onClick={runPreview}
            className="btn-ghost text-xs inline-flex items-center gap-1.5"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Regenerate
          </button>
        </div>
        {state.expiresAt && (
          <p className="text-xs text-green-900 italic">
            Link expires{' '}
            {new Date(state.expiresAt).toLocaleString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            .
          </p>
        )}
      </div>
    )
  }

  // state.kind === 'failure'
  const rendererDown = isRendererUnreachable(state.firstError)
  return (
    <div className="preview-result-failure">
      <p className="text-sm font-medium text-red-900 flex items-center gap-2">
        <XCircleIcon className="w-4 h-4" />
        Preview failed
      </p>
      <p className="text-xs text-red-900">{state.firstError}</p>

      {rendererDown && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-900">
            The renderer isn&apos;t running on your Mac. Start it, then click{' '}
            <span className="font-semibold">Try again</span>.
          </p>
          <p className="text-xs text-amber-900">
            In VS Code, open a terminal (Terminal → New Terminal, or{' '}
            <span className="font-mono">Ctrl+`</span>) and paste this:
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 font-mono text-xs text-brown-dark bg-white border border-amber-300 rounded px-2 py-1.5 whitespace-pre-wrap break-all">
              {RENDERER_START_COMMAND}
            </code>
            <button
              type="button"
              onClick={copyStartCommand}
              className="btn-ghost text-xs inline-flex items-center gap-1 shrink-0"
              title="Copy command"
            >
              {copied ? (
                <>
                  <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardIcon className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-amber-800 italic">
            Wait until the terminal prints{' '}
            <span className="font-mono not-italic">Ready</span> (a few seconds),
            leave that terminal open, then click Try again. If it&apos;s still
            down, restart the launchd service instead:{' '}
            <span className="font-mono not-italic break-all">
              launchctl unload ~/Library/LaunchAgents/com.oscrsj.renderer.plist &amp;&amp; launchctl load ~/Library/LaunchAgents/com.oscrsj.renderer.plist
            </span>
            .
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runPreview}
          className="btn-ghost text-xs inline-flex items-center gap-1.5"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
          Try again
        </button>
        {state.fullReport.length > 0 && (
          <details className="text-xs">
            <summary className="text-brown hover:text-brown-dark cursor-pointer">
              Show full report ({state.fullReport.length} stages)
            </summary>
            <pre className="font-mono text-xs text-brown bg-white border border-border rounded-md p-3 mt-2 whitespace-pre-wrap max-h-80 overflow-y-auto">
              {state.fullReport
                .map((e) => {
                  const summary = `[${e.wallclockSeconds.toFixed(1)}s] ${e.stage} · ${e.status}${e.message ? ` — ${e.message}` : ''}`
                  // Surface event.data on fail/warn events so the JATS validator's
                  // actual error array (and any other diagnostic payload the
                  // renderer emits) is visible directly in the failure card
                  // instead of being silently dropped. Without this the editor
                  // has no way to see *what* failed, only *that* it failed.
                  if ((e.status === 'fail' || e.status === 'warn') && e.data && Object.keys(e.data).length > 0) {
                    let dataBlock: string
                    try {
                      dataBlock = JSON.stringify(e.data, null, 2)
                    } catch {
                      dataBlock = String(e.data)
                    }
                    return `${summary}\n${dataBlock}`
                  }
                  return summary
                })
                .join('\n')}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
