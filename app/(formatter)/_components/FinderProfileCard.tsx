'use client'

// Finder v2 — the manuscript profile card.
//
// This card is the product's credibility. Every row shows the value AND the
// verbatim sentence we read it from, so an author can check our work in one
// glance. Four states are rendered honestly and differently:
//
//   value + quote   → the fact, with the sentence in mono beneath it
//   null            → a dash and "Not stated in the text we read."
//   quoteRejected   → we say the model could not point at it, and that we
//                     dropped it. A rejected field is disclosed, never hidden,
//                     because a silently missing row looks identical to a fact
//                     the manuscript never contained.
//   authorEdited    → the author corrected us. The value is USED, and it is
//                     labelled as theirs with the quote gone. We never re-dress
//                     an author's correction as something we read.
//
// EDITING DOCTRINE (2026-07-26). Extraction is a language model reading nine
// thousand words; it will sometimes be wrong, and an author who cannot fix it
// watches a wrong ladder get built on a number they can see is wrong. So every
// observed characteristic is correctable — except the novelty claim, which is a
// report on what the MANUSCRIPT says and would become fiction if typed in here.
// Corrections change the visual language of the row on purpose: green "verified"
// means we can quote it, brown "you corrected this" means you told us.

import { useState } from 'react'
import { FINDER_V2, finderDisagreementLine } from '../_copy'
import {
  EDITABLE_FIELD_LABELS,
  STUDY_DESIGNS,
  type EditableProfileField,
  type ManuscriptProfile,
  type ProfileEdits,
  type ProfileField,
} from '@/lib/finder/profileTypes'

const DESIGN_LABELS: Record<string, string> = {
  rct: 'Randomized controlled trial',
  prospective_cohort: 'Prospective cohort',
  retrospective_comparative: 'Retrospective comparative',
  case_control: 'Case control',
  case_series: 'Case series',
  case_report: 'Case report',
  systematic_review: 'Systematic review',
  meta_analysis: 'Meta-analysis',
  narrative_review: 'Narrative review',
  technical_note: 'Technical note',
  basic_science: 'Basic science',
  other: 'Other',
}

const LEVEL_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V']

/** Plain-language gloss for each level, so the numeral means something. */
const LEVEL_GLOSS: Record<number, string> = {
  1: 'Highest — randomized trial, or systematic review of trials',
  2: 'Prospective comparative work',
  3: 'Retrospective comparative or case-control work',
  4: 'Case series',
  5: 'Case report or expert opinion',
}

type FieldState = 'verified' | 'interpreted' | 'edited' | 'rejected' | 'absent'

function stateOf(field: ProfileField<unknown>): FieldState {
  if (field.authorEdited) return field.value === null ? 'absent' : 'edited'
  if (field.value === null) return field.quoteRejected ? 'rejected' : 'absent'
  return field.confidence === 'high' ? 'verified' : 'interpreted'
}

const STATE_CHIP: Record<FieldState, string> = {
  verified: 'border-transparent bg-[#E8F5EE] text-fmt-ok',
  interpreted: 'border-transparent bg-[#FBF3E4] text-fmt-warn',
  edited: 'border-transparent bg-fmt-accent-wash text-fmt-accent-deep',
  rejected: 'border-fmt-hairline bg-fmt-surface text-fmt-ink-2',
  absent: 'border-fmt-hairline bg-fmt-surface text-fmt-ink-3',
}

const STATE_LABEL: Record<FieldState, string> = {
  verified: FINDER_V2.confidenceHigh,
  interpreted: FINDER_V2.confidenceLow,
  edited: FINDER_V2.authorEditedChip,
  rejected: 'unverifiable',
  absent: 'not stated',
}

/** A thin left rail is the fastest way to read a grid of mixed-state cards. */
const STATE_RAIL: Record<FieldState, string> = {
  verified: 'before:bg-fmt-ok',
  interpreted: 'before:bg-fmt-warn',
  edited: 'before:bg-fmt-accent',
  rejected: 'before:bg-fmt-hairline',
  absent: 'before:bg-fmt-hairline',
}

function display(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString('en-US')
  return DESIGN_LABELS[String(value)] ?? String(value)
}

/* ------------------------------------------------------------------ */
/*  Per-field editor                                                    */
/* ------------------------------------------------------------------ */

function Editor({
  fieldKey,
  current,
  onSave,
  onCancel,
}: {
  fieldKey: EditableProfileField
  current: unknown
  onSave: (v: string | number | boolean | null) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<string>(current === null || current === undefined ? '' : String(current))

  const isBool = fieldKey === 'comparative' || fieldKey === 'multicenter' || fieldKey === 'statsReported'
  const isNumber = fieldKey === 'sampleSize' || fieldKey === 'followUpMonths'

  const commit = () => {
    if (draft === '') return onSave(null)
    if (isBool) return onSave(draft === 'true')
    if (isNumber) {
      const n = Number(draft)
      if (!Number.isFinite(n) || n < 0) return onCancel()
      return onSave(n)
    }
    onSave(draft)
  }

  const inputClass =
    'w-full rounded-lg border border-fmt-hairline bg-white px-3 py-2 text-sm text-fmt-ink focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40'

  return (
    <div className="mt-3 rounded-lg border border-fmt-accent/40 bg-fmt-accent-wash p-3">
      <label htmlFor={`edit-${fieldKey}`} className="mb-1.5 block text-xs font-medium text-fmt-ink-2">
        Correct &ldquo;{EDITABLE_FIELD_LABELS[fieldKey]}&rdquo;
      </label>

      {isBool ? (
        <select id={`edit-${fieldKey}`} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass}>
          <option value="">Unknown / not applicable</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : fieldKey === 'design' ? (
        <select id={`edit-${fieldKey}`} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass}>
          <option value="">Unknown</option>
          {STUDY_DESIGNS.map((d) => (
            <option key={d} value={d}>
              {DESIGN_LABELS[d]}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`edit-${fieldKey}`}
          type="number"
          min={0}
          step={fieldKey === 'followUpMonths' ? '0.1' : '1'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={fieldKey === 'followUpMonths' ? 'Months, e.g. 10.3' : 'Number of patients'}
          className={inputClass}
        />
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={commit} className="btn btn-primary text-xs">
          {FINDER_V2.editSaveCta}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary text-xs">
          {FINDER_V2.editCancelCta}
        </button>
        <span className="text-[11px] text-fmt-ink-3">Leave blank to clear this back to unknown.</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  One characteristic                                                  */
/* ------------------------------------------------------------------ */

function FactCard({
  label,
  field,
  suffix,
  fieldKey,
  editing,
  onEdit,
  onSave,
  onCancel,
  readOnlyNote,
}: {
  label: string
  field: ProfileField<unknown>
  suffix?: string
  fieldKey?: EditableProfileField
  editing?: boolean
  onEdit?: () => void
  onSave?: (v: string | number | boolean | null) => void
  onCancel?: () => void
  readOnlyNote?: string
}) {
  const state = stateOf(field)
  const hasValue = field.value !== null && field.value !== undefined

  return (
    <div
      className={`relative h-full overflow-hidden rounded-lg border border-fmt-hairline bg-white p-4 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[''] ${STATE_RAIL[state]}`}
    >
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-fmt-ink-3">{label}</p>
          <p className={`mt-1 font-fmt-display text-lg leading-snug ${hasValue ? 'text-fmt-ink' : 'text-fmt-ink-3'}`}>
            {display(field.value)}
            {hasValue && suffix ? <span className="text-sm font-normal text-fmt-ink-2"> {suffix}</span> : null}
          </p>
        </div>
        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATE_CHIP[state]}`}>
          {STATE_LABEL[state]}
        </span>
      </div>

      <div className="mt-2 pl-2">
        {state === 'edited' && <p className="text-xs leading-relaxed text-fmt-ink-2">{FINDER_V2.authorEditedNote}</p>}
        {(state === 'verified' || state === 'interpreted') && field.quote && (
          <p className="break-words border-l-2 border-fmt-hairline pl-2.5 font-fmt-mono text-[11px] leading-relaxed text-fmt-ink-3">
            {field.quote}
          </p>
        )}
        {state === 'rejected' && <p className="text-xs text-fmt-ink-3">{FINDER_V2.profileRejected}</p>}
        {state === 'absent' && <p className="text-xs text-fmt-ink-3">{FINDER_V2.profileNull}</p>}
        {readOnlyNote && <p className="mt-1.5 text-[11px] leading-relaxed text-fmt-ink-3">{readOnlyNote}</p>}
      </div>

      {fieldKey && !editing && (
        <div className="mt-2 pl-2">
          <button
            type="button"
            onClick={onEdit}
            className="font-fmt-mono text-[11px] text-fmt-accent underline underline-offset-2 hover:text-fmt-accent-deep"
          >
            {FINDER_V2.editCta}
          </button>
        </div>
      )}

      {fieldKey && editing && onSave && onCancel && (
        <div className="pl-2">
          <Editor fieldKey={fieldKey} current={field.value} onSave={onSave} onCancel={onCancel} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  The card                                                            */
/* ------------------------------------------------------------------ */

export default function FinderProfileCard({
  profile,
  edits,
  onEditsChange,
}: {
  profile: ManuscriptProfile
  /** Omit both to render read-only (the results-page recap uses this). */
  edits?: ProfileEdits
  onEditsChange?: (next: ProfileEdits) => void
}) {
  const [openField, setOpenField] = useState<EditableProfileField | null>(null)
  const editable = typeof onEditsChange === 'function'

  const save = (key: EditableProfileField) => (v: string | number | boolean | null) => {
    onEditsChange?.({ ...(edits ?? {}), [key]: v })
    setOpenField(null)
  }

  const editProps = (key: EditableProfileField) =>
    editable
      ? {
          fieldKey: key,
          editing: openField === key,
          onEdit: () => setOpenField(key),
          onSave: save(key),
          onCancel: () => setOpenField(null),
        }
      : {}

  const observed = [
    profile.design,
    profile.sampleSize,
    profile.comparative,
    profile.multicenter,
    profile.followUpMonths,
    profile.statsReported,
    profile.noveltyClaim,
  ]
  const verifiedCount = observed.filter((f) => !f.authorEdited && f.value !== null && f.confidence === 'high').length

  return (
    <div className="rounded-xl border border-fmt-hairline bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-fmt-display text-xl text-fmt-ink">{FINDER_V2.profileHeading}</h3>
          {editable && (
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-fmt-ink-2">{FINDER_V2.profileSub}</p>
          )}
        </div>

        {/* Level of evidence promoted out of the footer: it is the single value
            that most determines which tier this manuscript competes in. */}
        <div className="flex-shrink-0 rounded-lg border border-fmt-hairline bg-fmt-surface px-4 py-2.5 text-right">
          <p className="text-[10px] uppercase tracking-wide text-fmt-ink-3">Level of evidence</p>
          <p className="font-fmt-display text-2xl leading-tight text-fmt-ink">
            {profile.evidenceLevel ? LEVEL_NUMERALS[profile.evidenceLevel] : '—'}
          </p>
        </div>
      </div>

      <p className="mt-2 font-fmt-mono text-[11px] leading-relaxed text-fmt-ink-3">
        {profile.evidenceLevel
          ? LEVEL_GLOSS[profile.evidenceLevel]
          : 'This design does not carry a level of evidence, so we did not assign one.'}
        {' · '}
        {FINDER_V2.verifiedCountLabel(verifiedCount, observed.length)}
      </p>

      {profile.selfReported && (
        <p className="mt-3 rounded-lg border border-fmt-hairline bg-fmt-surface px-4 py-2.5 text-sm text-fmt-ink-2">
          {FINDER_V2.selfReportedBanner}
        </p>
      )}
      {profile.truncated && <p className="mt-3 font-fmt-mono text-xs text-fmt-ink-3">{FINDER_V2.truncationNote}</p>}
      {profile.extractionError && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-[#F0DFC0] bg-[#FBF3E4] px-4 py-2.5 text-sm leading-relaxed text-fmt-ink"
        >
          We could not read the structure of this manuscript automatically, so the values below are empty. You can fill
          them in yourself with the Correct links, and the ladder will use what you enter.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FactCard label="Study design" field={profile.design} {...editProps('design')} />
        <FactCard label="Patients analyzed" field={profile.sampleSize} {...editProps('sampleSize')} />
        <FactCard label="Comparison group" field={profile.comparative} {...editProps('comparative')} />
        <FactCard label="Multicenter" field={profile.multicenter} {...editProps('multicenter')} />
        <FactCard label="Follow-up" field={profile.followUpMonths} suffix="months" {...editProps('followUpMonths')} />
        <FactCard label="Statistics reported" field={profile.statsReported} {...editProps('statsReported')} />
        <div className="sm:col-span-2">
          <FactCard
            label="Novelty claim in the text"
            field={profile.noveltyClaim}
            readOnlyNote={editable ? FINDER_V2.noveltyReadOnlyNote : undefined}
          />
        </div>
      </div>

      {profile.authorEditedFields.length > 0 && (
        <p className="mt-4 rounded-lg border border-fmt-hairline bg-fmt-accent-wash px-4 py-2.5 text-sm leading-relaxed text-fmt-ink">
          You corrected{' '}
          <strong>{profile.authorEditedFields.map((f) => EDITABLE_FIELD_LABELS[f]).join(', ')}</strong>. Those values are
          used in your ladder and are marked as yours, not as something we read.
        </p>
      )}

      {profile.disagreements.map((field) => (
        <p
          key={field}
          className="mt-3 rounded-lg border border-[#F0DFC0] bg-[#FBF3E4] px-4 py-2.5 text-sm leading-relaxed text-fmt-ink"
        >
          {finderDisagreementLine(field)}
        </p>
      ))}
    </div>
  )
}
