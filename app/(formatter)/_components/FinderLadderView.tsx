'use client'

// Finder v2 — the reach / target / safety ladder.
//
// Every claim on a slot card traces to a value the engine holds: the band, the
// SJR standing, the constraint checks, the journal's own words about review
// speed. Nothing here is model-written prose, and the disclaimer under the
// ladder says plainly that this is tier alignment and not a prediction. Do not
// add a score, a percentage, or a "likelihood of acceptance" anywhere on these
// cards.

import { FINDER_V2, FINDER_OSCRSJ_CARD } from '../_copy'
import { describeCheck } from '@/lib/finder/match'
import { SJR_CATEGORY } from '@/lib/finder/sjrData'
import type { LadderBand, LadderResult, LadderSlot } from '@/lib/finder/profileTypes'
import type { ConstraintCheck } from '@/lib/finder/types'

const CHECK_COLOR: Record<ConstraintCheck['status'], string> = {
  fit: 'text-fmt-ok',
  near: 'text-fmt-warn',
  over: 'text-fmt-bad',
}

const BAND_CHIP: Record<LadderBand, string> = {
  reach: 'border-transparent bg-[#EDE9FB] text-fmt-accent-deep',
  target: 'border-transparent bg-[#E8F5EE] text-fmt-ok',
  safety: 'border-fmt-hairline bg-fmt-surface text-fmt-ink-2',
}

function apcLabel(apc: number | null, oa: string | null): string {
  if (apc === 0) return 'No APC'
  if (apc === null) return oa === 'subscription' ? 'Subscription' : '—'
  return `APC $${apc.toLocaleString('en-US')}`
}

function SlotCard({ slot, onFormat }: { slot: LadderSlot; onFormat: (slot: LadderSlot) => void }) {
  const m = slot.meta
  const metaBits = [
    m.indexing.length ? m.indexing.join(' · ') : '—',
    m.oa_model === 'oa' ? 'Open access' : m.oa_model === 'hybrid' ? 'Hybrid' : m.oa_model === 'subscription' ? 'Subscription' : '—',
    apcLabel(m.apc_usd, m.oa_model),
  ]

  return (
    <div className="rounded-xl border border-fmt-hairline bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* flex-1 so a long journal name shrinks this column rather than pushing
            the action button onto its own line (Franklin, Session 100). */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${BAND_CHIP[slot.band]}`}>
              {FINDER_V2.bandLabels[slot.band]}
            </span>
            <span className="text-[11px] text-fmt-ink-3">{FINDER_V2.bandSubtitles[slot.band]}</span>
            {slot.sjrUnranked && (
              <span className="inline-block rounded-full border border-fmt-hairline bg-fmt-surface px-2.5 py-0.5 text-[11px] font-medium text-fmt-ink-2">
                {FINDER_V2.notRankedChip}
              </span>
            )}
            {slot.scopeMismatch && (
              <span className="inline-block rounded-full border border-transparent bg-[#FBF3E4] px-2.5 py-0.5 text-[11px] font-medium text-fmt-warn">
                Outside stated scope
              </span>
            )}
          </div>
          <h4 className="mt-1.5 font-fmt-display text-lg text-fmt-ink">{slot.name}</h4>
        </div>
        <button type="button" onClick={() => onFormat(slot)} className="btn btn-secondary flex-shrink-0 text-sm">
          Format for this journal →
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-fmt-ink-2">{slot.why}</p>

      {slot.borrowNote && (
        <p className="mt-2 rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2 text-xs text-fmt-ink-2">
          {slot.borrowNote}
        </p>
      )}

      {slot.band === 'reach' && (
        <p className="mt-2 text-xs leading-relaxed text-fmt-ink-3">{FINDER_V2.reachExpectation}</p>
      )}

      {slot.strengthen && (
        <p className="mt-2 border-l-2 border-fmt-accent pl-3 text-sm leading-relaxed text-fmt-ink-2">
          {slot.strengthen}
        </p>
      )}

      {/* The journal's own words about its speed, never normalized to a number:
          publishers measure different things and a bare "12 days" invents a
          comparability the sources do not support (Janine, Session 99). */}
      {m.review_speed && <p className="mt-2 font-fmt-mono text-xs text-fmt-ink-3">{m.review_speed}</p>}

      <details className="mt-3 border-t border-fmt-hairline pt-3">
        <summary className="cursor-pointer text-xs font-medium text-fmt-ink-2">Formatting fit</summary>
        {slot.checks.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-fmt-mono text-xs">
            {slot.checks.map((c) => (
              <span key={c.key} className={CHECK_COLOR[c.status]}>
                <span className="text-fmt-ink-3">{c.label}:</span> {describeCheck(c)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 font-fmt-mono text-xs text-fmt-ink-3">
            {slot.checkedCount === 0
              ? 'No stated limit of this journal could be checked against what we read.'
              : 'Every stated limit we could check is satisfied.'}
          </p>
        )}
      </details>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-fmt-hairline pt-3">
        <p className="font-fmt-mono text-[11px] text-fmt-ink-3">{metaBits.join('  ·  ')}</p>
        <a
          href={slot.guidelinesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-fmt-mono text-[11px] text-fmt-ink-2 underline hover:text-fmt-accent-deep"
        >
          Guide for Authors ↗
        </a>
      </div>
    </div>
  )
}

/**
 * The OSCRSJ card. Rendered OUTSIDE the ladder, always, and labelled as ours.
 * Its visibility is a pure function of article type and scope — see
 * showOscrsjCard in lib/finder/ladder.ts, which deliberately does not take the
 * profile as an argument.
 */
function OscrsjCard({ articleTypePhrase, onFormat }: { articleTypePhrase: string; onFormat: () => void }) {
  return (
    <div className="rounded-xl border border-fmt-hairline bg-fmt-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-fmt-ink-3">{FINDER_OSCRSJ_CARD.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-fmt-ink-2">{FINDER_OSCRSJ_CARD.body(articleTypePhrase)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href="/guide-for-authors"
          target="_blank"
          rel="noopener noreferrer"
          className="font-fmt-mono text-[11px] text-fmt-ink-2 underline hover:text-fmt-accent-deep"
        >
          {FINDER_OSCRSJ_CARD.action}
        </a>
        <button type="button" onClick={onFormat} className="btn btn-secondary text-sm">
          Format for this journal →
        </button>
      </div>
    </div>
  )
}

export default function FinderLadderView({
  ladder,
  articleTypePhrase,
  sjrYear,
  onFormat,
  onFormatOscrsj,
}: {
  ladder: LadderResult
  articleTypePhrase: string
  sjrYear: number | null
  onFormat: (slot: LadderSlot) => void
  onFormatOscrsj: () => void
}) {
  return (
    <div className="space-y-4">
      {ladder.smallSetNote && (
        <p className="rounded-xl border border-fmt-hairline bg-fmt-surface px-4 py-3 text-sm text-fmt-ink">
          {ladder.smallSetNote}
        </p>
      )}

      {ladder.slots.length === 0 && (
        <p className="rounded-xl border border-fmt-hairline bg-white p-5 text-sm text-fmt-ink-2">
          No journal in our registry accepts this article type in this scope, so there is no ladder to show. The full
          eligibility list below explains why for each journal.
        </p>
      )}

      {ladder.slots.map((slot) => (
        <SlotCard key={slot.slug} slot={slot} onFormat={onFormat} />
      ))}

      <p className="rounded-xl border border-fmt-hairline bg-fmt-surface px-4 py-3 text-xs leading-relaxed text-fmt-ink-2">
        {FINDER_V2.ladderDisclaimer}
      </p>

      {ladder.showOscrsjCard && <OscrsjCard articleTypePhrase={articleTypePhrase} onFormat={onFormatOscrsj} />}

      <p className="font-fmt-mono text-[11px] leading-relaxed text-fmt-ink-3">
        Journal standings: SJR {sjrYear ?? 'year not recorded'}, Scimago category {SJR_CATEGORY}. Unknown values render
        as a dash; we do not guess.
      </p>
    </div>
  )
}
