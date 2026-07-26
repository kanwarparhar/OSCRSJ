'use client'

// Finder v2 — the manuscript profile card.
//
// This card is the product's credibility. Every row shows the value AND the
// verbatim sentence we read it from, so an author can check our work in one
// glance. Three states are rendered honestly and differently:
//
//   value + quote   → the fact, with the sentence in mono beneath it
//   null            → a dash and "Not stated in the text we read."
//   quoteRejected   → we say the model could not point at it, and that we
//                     dropped it. A rejected field is disclosed, never hidden,
//                     because a silently missing row looks identical to a fact
//                     the manuscript never contained.

import { FINDER_V2, finderDisagreementLine } from '../_copy'
import type { ManuscriptProfile, ProfileField } from '@/lib/finder/profileTypes'

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

function display(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString('en-US')
  return DESIGN_LABELS[String(value)] ?? String(value)
}

function Row({ label, field, suffix }: { label: string; field: ProfileField<unknown>; suffix?: string }) {
  const hasValue = field.value !== null && field.value !== undefined
  return (
    <div className="border-t border-fmt-hairline py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm text-fmt-ink-2">{label}</span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-fmt-ink">
            {display(field.value)}
            {hasValue && suffix ? ` ${suffix}` : ''}
          </span>
          {hasValue && field.confidence && (
            <span className="rounded-full border border-fmt-hairline bg-fmt-surface px-2 py-0.5 text-[11px] text-fmt-ink-2">
              {field.confidence === 'high' ? FINDER_V2.confidenceHigh : FINDER_V2.confidenceLow}
            </span>
          )}
        </span>
      </div>
      {hasValue && field.quote && (
        <p className="mt-1.5 break-words font-fmt-mono text-xs leading-relaxed text-fmt-ink-3">
          &ldquo;{field.quote}&rdquo;
        </p>
      )}
      {!hasValue && (
        <p className="mt-1 text-xs text-fmt-ink-3">
          {field.quoteRejected ? FINDER_V2.profileRejected : FINDER_V2.profileNull}
        </p>
      )}
    </div>
  )
}

export default function FinderProfileCard({ profile }: { profile: ManuscriptProfile }) {
  return (
    <div className="rounded-xl border border-fmt-hairline bg-white p-6">
      <h3 className="font-fmt-display text-xl text-fmt-ink">{FINDER_V2.profileHeading}</h3>

      {profile.selfReported && (
        <p className="mt-3 rounded-lg border border-fmt-hairline bg-fmt-surface px-4 py-2.5 text-sm text-fmt-ink-2">
          {FINDER_V2.selfReportedBanner}
        </p>
      )}
      {profile.truncated && (
        <p className="mt-3 font-fmt-mono text-xs text-fmt-ink-3">{FINDER_V2.truncationNote}</p>
      )}
      {profile.extractionError && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-[#F0DFC0] bg-[#FBF3E4] px-4 py-2.5 text-sm text-fmt-ink"
        >
          We could not read the structure of this manuscript automatically, so the profile below is empty. The ladder
          still uses your own answers. You can also try the no-upload path.
        </p>
      )}

      <div className="mt-4">
        <Row label="Study design" field={profile.design} />
        <Row label="Patients analyzed" field={profile.sampleSize} />
        <Row label="Comparison group" field={profile.comparative} />
        <Row label="Multicenter" field={profile.multicenter} />
        <Row label="Follow-up" field={profile.followUpMonths} suffix="months" />
        <Row label="Statistics reported" field={profile.statsReported} />
        <Row label="Novelty claim in the text" field={profile.noveltyClaim} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-fmt-hairline pt-3">
        <span className="text-sm text-fmt-ink-2">Level of evidence</span>
        <span className="font-fmt-mono text-sm text-fmt-ink">
          {profile.evidenceLevel ? LEVEL_NUMERALS[profile.evidenceLevel] : '—'}
        </span>
      </div>
      {profile.evidenceLevel === null && (
        <p className="mt-1 text-xs text-fmt-ink-3">
          This design does not carry a level of evidence, so we did not assign one.
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
