'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DemoSpec } from '@/lib/formatting/demoSpecs'

/**
 * Interactive Word mock for /studio/format (Session 97, Kanwar directive).
 *
 * A Word-like document that visibly re-formats when you pick a journal, starting
 * from the author's UNFORMATTED draft so the first click shows a real before/after.
 *
 * THE POINT: every journal value comes from `getDemoSpecs()`, which reads the SAME
 * encoded rule files the pipeline uses. This is a window onto the registry, not a
 * mockup of one. If JBJS changes its guide and we re-encode it, the demo follows
 * for free. A hand-authored fixture would drift and quietly turn the page's core
 * claim into a lie.
 *
 * NULL DISCIPLINE (load-bearing): where a journal's guide is silent we render
 * "not specified · your choice kept", never a plausible default. AJSM genuinely
 * publishes no font rule; Eur Spine J states no line spacing. Those cells go grey
 * and italic. That is "Never invents a requirement" demonstrated rather than
 * asserted. Do not fill them in.
 *
 * THE DRAFT ENTRY IS NOT A JOURNAL. It represents the author's own manuscript and
 * is deliberately synthetic (Calibri 11, single, no line numbers, an unformatted
 * author-date citation). It is labelled as such everywhere and is never presented
 * as coming from the registry.
 */

const SPACING_LABEL: Record<string, string> = {
  single: 'Single',
  '1.5': '1.5 lines',
  double: 'Double',
}

const NOT_SPECIFIED = 'not specified · your choice kept'

type CiteKind = 'draft' | 'superscript' | 'bracket' | 'paren'

interface Entry {
  key: string
  /** Chip label. */
  label: string
  /** Full journal name, or the draft's description. */
  name: string
  isDraft: boolean
  guidelinesUrl: string | null
  verifiedDate: string | null
  layout: {
    fontFamily: string | null
    fontSizePt: number | null
    lineSpacing: 'single' | '1.5' | 'double' | null
    /** null = the guide is silent, so the author's setting is preserved. */
    lineNumbers: 'none' | 'continuous' | 'per_page' | null
    marginMm: number | null
  }
  references: {
    style: string
    inText: CiteKind
    inTextPunctuation: 'before' | 'after' | null
    etAlThreshold: number | 'all' | null
    maxCount: number | null
  }
}

/** The author's raw manuscript. Synthetic by design — see the header note. */
const DRAFT: Entry = {
  key: 'draft',
  label: 'Your draft',
  name: 'Your manuscript, as you wrote it',
  isDraft: true,
  guidelinesUrl: null,
  verifiedDate: null,
  layout: {
    fontFamily: 'Calibri',
    fontSizePt: 11,
    lineSpacing: 'single',
    lineNumbers: 'none',
    marginMm: null,
  },
  references: {
    style: 'unformatted',
    inText: 'draft',
    inTextPunctuation: null,
    etAlThreshold: null,
    maxCount: null,
  },
}

/** Renders the in-text citation exactly as that journal wants it. */
function Citation({ entry }: { entry: Entry }) {
  const { inText, inTextPunctuation } = entry.references
  if (inText === 'draft') {
    return (
      <>
        <span> </span>
        <span className="cite bad">(Smith 2019)</span>
      </>
    )
  }
  // "before" = punctuation after the marker → "described [1]." ;
  // "after"/null → "described." then the marker.
  const punctFirst = inTextPunctuation === 'before'
  const marker =
    inText === 'superscript' ? (
      <sup className="cite">1</sup>
    ) : inText === 'bracket' ? (
      <span className="cite"> [1]</span>
    ) : (
      <span className="cite"> (1)</span>
    )
  return punctFirst ? (
    <>
      {marker}
      <span>.</span>
    </>
  ) : (
    <>
      <span>.</span>
      {marker}
    </>
  )
}

function citeSummary(e: Entry): string {
  const { inText, style } = e.references
  if (inText === 'draft') return 'unformatted author-date'
  const shape = inText === 'superscript' ? 'superscript' : inText === 'bracket' ? 'bracketed' : 'parenthetical'
  return `${style.toUpperCase()} ${shape}`
}

function fontSummary(e: Entry): string {
  if (e.isDraft) return `${e.layout.fontFamily} ${e.layout.fontSizePt}pt (yours)`
  if (!e.layout.fontFamily) return 'not specified, yours kept'
  return `${e.layout.fontFamily}${e.layout.fontSizePt ? ` ${e.layout.fontSizePt}pt` : ''}`
}

/** Fields we diff + highlight. Order = the order changes are listed. */
type FieldKey = 'font' | 'spacing' | 'lineNumbers' | 'margins' | 'citations'

const FIELD_LABEL: Record<FieldKey, string> = {
  font: 'Font',
  spacing: 'Line spacing',
  lineNumbers: 'Line numbers',
  margins: 'Margins',
  citations: 'Citations',
}

function fieldValue(e: Entry, k: FieldKey): string {
  switch (k) {
    case 'font':
      return fontSummary(e)
    case 'spacing':
      return e.layout.lineSpacing ? SPACING_LABEL[e.layout.lineSpacing] : 'not specified, yours kept'
    case 'lineNumbers':
      if (e.layout.lineNumbers === null) return 'not specified, yours kept'
      return e.layout.lineNumbers === 'none' ? 'off' : 'on, continuous'
    case 'margins':
      return e.layout.marginMm ? `${e.layout.marginMm} mm all round` : 'not specified'
    case 'citations':
      return citeSummary(e)
  }
}

const ALL_FIELDS: FieldKey[] = ['font', 'spacing', 'lineNumbers', 'margins', 'citations']

interface Change {
  key: FieldKey
  from: string
  to: string
}

function diff(prev: Entry, next: Entry): Change[] {
  const out: Change[] = []
  for (const k of ALL_FIELDS) {
    const a = fieldValue(prev, k)
    const b = fieldValue(next, k)
    if (a !== b) out.push({ key: k, from: a, to: b })
  }
  return out
}

export default function WordDemo({ specs }: { specs: DemoSpec[] }) {
  const entries: Entry[] = useMemo(
    () => [
      DRAFT,
      ...specs.map((s) => ({
        key: s.slug,
        label: s.abbrev,
        name: s.name,
        isDraft: false,
        guidelinesUrl: s.guidelinesUrl,
        verifiedDate: s.verifiedDate,
        layout: s.layout,
        references: { ...s.references, inText: s.references.inText as CiteKind },
      })),
    ],
    [specs],
  )

  const [idx, setIdx] = useState(0)
  const [applying, setApplying] = useState(false)
  const [changes, setChanges] = useState<Change[]>([])
  const [flash, setFlash] = useState(false)
  const [touched, setTouched] = useState(false)
  const [reduced, setReduced] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  const entry = entries[idx]

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  const go = useCallback(
    (next: number, viaUser: boolean) => {
      if (viaUser) setTouched(true)
      if (next === idx) return
      clearTimers()
      const delta = diff(entries[idx], entries[next])
      setApplying(true)
      timers.current.push(
        window.setTimeout(() => {
          setIdx(next)
          setChanges(delta)
          setApplying(false)
          setFlash(true)
        }, 380),
      )
      // Highlight decays so the page settles instead of strobing.
      timers.current.push(window.setTimeout(() => setFlash(false), 2200))
    },
    [idx, entries],
  )

  // Autoplay until the visitor takes over. Starts on the draft so the first
  // transition is the big one.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true)
      return
    }
    if (touched) return
    const node = rootRef.current
    if (!node) return
    let timer: number | null = null
    let visible = false

    const tick = () => {
      timer = window.setTimeout(() => {
        setIdx((i) => {
          const next = (i + 1) % entries.length
          const delta = diff(entries[i], entries[next])
          setChanges(delta)
          setFlash(true)
          window.setTimeout(() => setFlash(false), 2200)
          return next
        })
        if (visible) tick()
      }, 4200)
    }

    const io = new IntersectionObserver(
      (e) => {
        visible = e[0].isIntersecting
        if (visible && timer === null) tick()
        if (!visible && timer !== null) {
          window.clearTimeout(timer)
          timer = null
        }
      },
      { threshold: 0.2 },
    )
    io.observe(node)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      io.disconnect()
    }
  }, [touched, entries])

  useEffect(() => clearTimers, [])

  if (!entry) return null

  const { layout, references } = entry
  // null (guide silent) preserves the draft, which carries no line numbers.
  const showLineNos = layout.lineNumbers === 'continuous' || layout.lineNumbers === 'per_page'
  const fontUnspecified = !entry.isDraft && layout.fontFamily === null
  const spacingUnspecified = !entry.isDraft && layout.lineSpacing === null
  const fontLabel = layout.fontFamily ?? 'Calibri'
  const sizeLabel = layout.fontSizePt ?? 11

  const changed = (k: FieldKey) => (flash && changes.some((c) => c.key === k) ? ' changed' : '')

  const docStyle: React.CSSProperties = {
    fontFamily: layout.fontFamily
      ? `"${layout.fontFamily}", "Times New Roman", serif`
      : 'Calibri, "Segoe UI", system-ui, sans-serif',
    fontSize: `${(layout.fontSizePt ?? 11) * 1.28}px`,
    lineHeight: layout.lineSpacing === 'double' ? 2 : layout.lineSpacing === '1.5' ? 1.5 : 1.3,
  }

  return (
    <div className="wd" ref={rootRef} id="demo" style={{ scrollMarginTop: '80px' }}>
      {/* ---------- SWITCHER (above the window: it is the control) ---------- */}
      <div className="wd-switch">
        <span className="wd-switch-lbl">Format for:</span>
        <div className="wd-chips" role="group" aria-label="Preview formatting for a journal">
          {entries.map((e, i) => (
            <button
              key={e.key}
              type="button"
              className={`wd-chip${i === idx ? ' on' : ''}${e.isDraft ? ' draft' : ''}`}
              aria-pressed={i === idx}
              onClick={() => go(i, true)}
            >
              {e.label}
            </button>
          ))}
        </div>
        {!touched && !reduced && <span className="wd-hint">click any journal</span>}
      </div>

      <div className="wd-stage">
        {/* ---------- WORD WINDOW ---------- */}
        <div className="wd-win">
          <div className="wd-title">
            <span className="wd-traffic">
              <i className="r" />
              <i className="y" />
              <i className="g" />
            </span>
            <span className="wd-fname">
              {entry.isDraft ? 'manuscript_draft.docx' : `manuscript_${entry.label.replace(/\s+/g, '')}.docx`}
              <span className="wd-saved">{applying ? 'Applying…' : 'Saved'}</span>
            </span>
          </div>

          <div className="wd-tabs">
            {['File', 'Home', 'Insert', 'Layout', 'References', 'Review', 'View'].map((t) => (
              <span key={t} className={t === 'Home' ? 'on' : undefined}>
                {t}
              </span>
            ))}
          </div>

          {/* Ribbon boxes are the live spec readout, and they pulse when they change. */}
          <div className="wd-ribbon">
            <div className="wd-grp">
              <div className="wd-row">
                <span
                  className={`wd-box wd-font${fontUnspecified ? ' muted' : ''}${changed('font')}`}
                  title={fontUnspecified ? `${entry.name}: font ${NOT_SPECIFIED}` : undefined}
                >
                  {fontLabel}
                </span>
                <span
                  className={`wd-box wd-size${fontUnspecified ? ' muted' : ''}${changed('font')}`}
                  title={fontUnspecified ? `${entry.name}: font size ${NOT_SPECIFIED}` : undefined}
                >
                  {sizeLabel}
                </span>
              </div>
              <div className="wd-lbl">Font{fontUnspecified ? ' (yours)' : ''}</div>
            </div>
            <div className="wd-grp">
              <div className="wd-row">
                <span className="wd-btn b">B</span>
                <span className="wd-btn i">I</span>
                <span className="wd-btn u">U</span>
                <span
                  className={`wd-box wd-space${spacingUnspecified ? ' muted' : ''}${changed('spacing')}`}
                  title={spacingUnspecified ? `${entry.name}: line spacing ${NOT_SPECIFIED}` : undefined}
                >
                  {layout.lineSpacing ? SPACING_LABEL[layout.lineSpacing] : 'Not specified'}
                </span>
              </div>
              <div className="wd-lbl">Paragraph{spacingUnspecified ? ' (yours)' : ''}</div>
            </div>
            <div className="wd-grp">
              <div className="wd-row">
                <span className={`wd-box${showLineNos ? ' on' : ''}${changed('lineNumbers')}`}>
                  {showLineNos ? 'Line numbers: on' : 'Line numbers: off'}
                </span>
                {layout.marginMm && (
                  <span className={`wd-box${changed('margins')}`}>{layout.marginMm} mm</span>
                )}
              </div>
              <div className="wd-lbl">Layout</div>
            </div>
            <div className="wd-grp">
              <div className="wd-row">
                <span className={`wd-box${entry.isDraft ? ' bad' : ' on'}${changed('citations')}`}>
                  {entry.isDraft ? 'Unformatted' : references.style.toUpperCase()}
                </span>
              </div>
              <div className="wd-lbl">Citations &amp; Bibliography</div>
            </div>
          </div>

          <div className="wd-ruler" aria-hidden="true">
            {Array.from({ length: 21 }).map((_, i) => (
              <i key={i} className={i % 4 === 0 ? 'maj' : undefined} />
            ))}
          </div>

          {/* ---------- PAGE ---------- */}
          <div className="wd-canvas">
            <div className={`wd-page${applying ? ' applying' : ''}`}>
              <div className="wd-body" style={{ ...docStyle, padding: layout.marginMm ? '44px 52px' : '38px 44px' }}>
                {showLineNos && (
                  <div className={`wd-lineno${changed('lineNumbers')}`} aria-hidden="true">
                    {Array.from({ length: 22 }).map((_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                )}
                <p className="wd-h1">
                  Bilateral exertional compartment syndrome of the forearms: a case report
                </p>
                <p className="wd-auth">K. Parhar, MD; M. Kaur, MD; S. Lal, MS</p>
                <p className="wd-p">
                  A 24-year-old competitive sport climber presented with bilateral forearm pain and paresthesia after
                  sustained gripping. Symptoms resolved at rest and recurred reproducibly on exertion, having been
                  managed as tendinopathy for eleven months before referral.
                </p>
                <p className="wd-p">
                  Intracompartmental pressure testing confirmed the diagnosis, as previously described
                  <Citation entry={entry} />
                </p>
                <p className="wd-p">
                  Fasciotomy of the volar and dorsal compartments was performed bilaterally. Pressures normalised
                  intraoperatively and the patient returned to competitive climbing at twelve weeks.
                </p>
                <p className="wd-p wd-dim">
                  Exertional compartment syndrome of the forearm remains under-recognised in climbing athletes, where
                  sustained isometric gripping produces a physiology closer to the chronic leg presentation than to the
                  acute traumatic one.
                </p>
              </div>
              {layout.marginMm && <span className="wd-margin-tag">{layout.marginMm} mm margins</span>}
            </div>
          </div>

          {/* ---------- STATUS BAR ---------- */}
          <div className="wd-status">
            <span>Page 1 of 7</span>
            <span>1,842 words</span>
            <span className="wd-spec">
              {entry.isDraft ? 'No journal applied' : entry.label} ·{' '}
              {layout.lineSpacing ? SPACING_LABEL[layout.lineSpacing].toLowerCase() : 'spacing kept'} ·{' '}
              {entry.isDraft ? 'unformatted refs' : references.style.toUpperCase()}
              {references.etAlThreshold === 'all'
                ? ' · all authors listed'
                : references.etAlThreshold
                  ? ` · et al. past ${references.etAlThreshold}`
                  : ''}
              {references.maxCount ? ` · max ${references.maxCount} refs` : ''}
            </span>
          </div>
        </div>

        {/* ---------- WHAT CHANGED ---------- */}
        <aside className="wd-changes" aria-live="polite">
          <div className="wd-changes-head">
            {entry.isDraft ? 'Your draft' : `Applied · ${entry.label}`}
          </div>
          {changes.length === 0 ? (
            <p className="wd-changes-empty">
              {entry.isDraft
                ? 'This is your manuscript before anything is applied. Pick a journal to see what changes.'
                : 'No changes to show yet.'}
            </p>
          ) : (
            <ul className="wd-changes-list">
              {changes.map((c) => (
                <li key={c.key} className={flash ? 'lit' : undefined}>
                  <span className="k">{FIELD_LABEL[c.key]}</span>
                  <span className="v">
                    <s>{c.from}</s>
                    <i>→</i>
                    <b>{c.to}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!entry.isDraft && (
            <p className="wd-changes-src">
              {fontUnspecified || spacingUnspecified ? (
                <>
                  <strong>{entry.name}</strong> publishes no rule for the greyed fields above, so the Studio keeps
                  yours and notes it in the report. It never invents a rule to fill a gap.
                </>
              ) : (
                <>
                  Read from <strong>{entry.name}</strong>&apos;s own Guide for Authors.
                </>
              )}{' '}
              {entry.guidelinesUrl && (
                <a href={entry.guidelinesUrl} target="_blank" rel="noopener noreferrer">
                  Guide ↗
                </a>
              )}
              {entry.verifiedDate ? ` · verified ${entry.verifiedDate}` : ''}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
