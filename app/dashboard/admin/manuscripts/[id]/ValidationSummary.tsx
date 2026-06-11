'use client'

import { useState } from 'react'
import type { ValidationRow } from '@/lib/publish/synthesize'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface Props {
  errors: ValidationRow[]
  warnings: ValidationRow[]
  isPending: boolean
  onForceRefresh: () => void
  acknowledged: Set<string>
  onAcknowledge: (rule: string, checked: boolean) => void
  onOpenPreview: () => void
  onRenderPublish: () => void
  previewDisabled: boolean
  previewDisabledReason: string | null
  renderDisabled: boolean
  renderDisabledReason: string | null
  // Phase 1.5 auto-expand-on-jump (Session 80). Collapsed sections unmount
  // their children, so this component's local querySelector jump silently
  // no-ops when the target's section is collapsed. When provided, the parent
  // (which owns collapse state) handles expand + scroll + flash itself.
  onJumpToFix?: (targetField: string) => void
}

// §5 Pre-Render Validation Summary — Franklin §5 wireframe.
// Three-tier red/amber/green + acknowledged checkboxes + two CTAs
// (Open preview · Render published PDF) at the bottom of the card.
// Sticky desktop-only chip lives separately in MetadataEditorForm.
export default function ValidationSummary({
  errors,
  warnings,
  isPending,
  onForceRefresh,
  acknowledged,
  onAcknowledge,
  onOpenPreview,
  onRenderPublish,
  previewDisabled,
  previewDisabledReason,
  renderDisabled,
  renderDisabledReason,
  onJumpToFix,
}: Props) {
  const allClear = errors.length === 0 && warnings.length === 0

  return (
    <div className="validation-card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-lg text-brown-dark">
            §5 — Pre-Render Validation Summary
          </h3>
          <p className="text-xs text-brown italic mt-1">
            Live synthesizer dry-run. Updates 500ms after each edit.
          </p>
        </div>
        <button
          type="button"
          onClick={onForceRefresh}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-xs text-brown-dark hover:text-peach-dark disabled:opacity-40"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Running…' : 'Run dry-run now'}
        </button>
      </div>

      {errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-900 flex items-center gap-2">
            <XCircleIcon className="w-4 h-4" />
            Errors ({errors.length}) — must fix before render
          </p>
          <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
            {errors.map((r, i) => (
              <ValidationRowDisplay
                key={`err-${i}`}
                row={r}
                tier="error"
                acknowledged={null}
                onAcknowledge={() => {}}
                onJumpToFix={onJumpToFix}
              />
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4" />
            Warnings ({warnings.length}) — render proceeds; acknowledge to enable Render
          </p>
          <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
            {warnings.map((r, i) => (
              <ValidationRowDisplay
                key={`warn-${i}`}
                row={r}
                tier="warning"
                acknowledged={acknowledged.has(r.rule)}
                onAcknowledge={(checked) => onAcknowledge(r.rule, checked)}
                onJumpToFix={onJumpToFix}
              />
            ))}
          </div>
        </div>
      )}

      {allClear && (
        <div className="validation-row-clear">
          <p className="font-medium flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4" />
            All validators clear
          </p>
          <p className="text-xs mt-1">
            The manuscript passes every synthesizer rule. Open preview or render the published PDF when ready.
          </p>
        </div>
      )}

      {!allClear && errors.length === 0 && warnings.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-brown">
            {acknowledged.size} of {warnings.length} warnings acknowledged.
            {acknowledged.size < warnings.length && ' Acknowledge all to enable Render published PDF.'}
          </p>
        </div>
      )}

      <div className="pt-3 border-t border-border flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={onOpenPreview}
          disabled={previewDisabled}
          title={previewDisabledReason || ''}
          className={`btn-primary-light ${previewDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Open preview ↗
        </button>
        <button
          type="button"
          onClick={onRenderPublish}
          disabled={renderDisabled}
          title={renderDisabledReason || ''}
          className={`btn-primary-light ${renderDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Render published PDF →
        </button>
        {(previewDisabledReason || renderDisabledReason) && (
          <p className="text-xs text-brown italic">
            {previewDisabledReason || renderDisabledReason}
          </p>
        )}
      </div>
    </div>
  )
}

function ValidationRowDisplay({
  row,
  tier,
  acknowledged,
  onAcknowledge,
  onJumpToFix,
}: {
  row: ValidationRow
  tier: 'error' | 'warning'
  acknowledged: boolean | null
  onAcknowledge: (checked: boolean) => void
  onJumpToFix?: (targetField: string) => void
}) {
  const className =
    tier === 'error' ? 'validation-row-error' : 'validation-row-warning'

  function jumpToFix() {
    if (!row.targetField) return
    if (onJumpToFix) {
      // Parent-owned jump: handles auto-expanding a collapsed section
      // before scrolling (Phase 1.5, Session 80).
      onJumpToFix(row.targetField)
      return
    }
    const el = document.querySelector(`[data-target="${row.targetField}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2')
      }, 1500)
      if (typeof (el as HTMLInputElement).focus === 'function') {
        try {
          ;(el as HTMLInputElement).focus({ preventScroll: true })
        } catch {
          // no-op
        }
      }
    }
  }

  return (
    <div className={className}>
      <div className="flex-1">
        <p>{row.message}</p>
        {acknowledged !== null && (
          <label className="inline-flex items-center gap-1.5 text-xs mt-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onAcknowledge(e.target.checked)}
              className="accent-amber-600"
            />
            <span>Acknowledged</span>
          </label>
        )}
      </div>
      {row.targetField && (
        <button
          type="button"
          onClick={jumpToFix}
          className="validation-jump-link"
        >
          Jump to fix ↗
        </button>
      )}
    </div>
  )
}
