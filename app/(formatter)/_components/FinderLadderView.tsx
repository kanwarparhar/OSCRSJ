'use client'

// Finder v2 — the reach / target / safety ladder.
//
// Every claim on a slot card traces to a value the engine holds: the band, the
// SJR standing, the constraint checks, the journal's own words about review
// speed. Nothing here is model-written prose, and the disclaimer under the
// ladder says plainly that this is tier alignment and not a prediction. Do not
// add a score, a percentage, or a "likelihood of acceptance" anywhere on these
// cards.
//
// COLOUR DOCTRINE (2026-07-26). Colour carries ONE meaning on this page: which
// band a journal sits in. Reach is the accent brown, target is the green already
// used for "fits", safety is neutral ink. Nothing else is coloured except the
// formatting-fit checks, which keep their long-standing fit/near/over scale
// inside a collapsed section. A stat chip is never coloured by whether its value
// is "good" — an APC of $3,000 is a fact, not a warning, and colouring it red
// would be us editorialising about another journal's business model.
//
// STAT ROW. SJR, quartile and category rank come from the Scimago pull and exist
// for every ranked journal. APC and decision time are verified from each
// journal's own pages and are frequently null; those render as an honest dash
// with a hint, never as a zero or a guess. Journal Impact Factor is Clarivate
// property and must never appear here.

import { FINDER_V2, FINDER_OSCRSJ_CARD } from '../_copy'
import { INSTRUMENT_TRUST_LINE } from './FinderProfileCard'
import { describeCheck } from '@/lib/finder/match'
import { SJR_CATEGORY, SJR_CATEGORY_SIZE } from '@/lib/finder/sjrData'
import type { LadderBand, LadderResult, LadderSlot } from '@/lib/finder/profileTypes'
import type { ConstraintCheck, JournalMeta } from '@/lib/finder/types'

const CHECK_COLOR: Record<ConstraintCheck['status'], string> = {
  fit: 'text-fmt-ok',
  near: 'text-fmt-warn',
  over: 'text-fmt-bad',
}

interface BandStyle {
  chip: string
  rail: string
  wash: string
  marker: string
}

const BAND: Record<LadderBand, BandStyle> = {
  reach: {
    chip: 'border-transparent bg-fmt-accent text-white',
    rail: 'bg-fmt-accent',
    wash: 'bg-fmt-accent-wash',
    marker: 'bg-fmt-accent',
  },
  target: {
    chip: 'border-transparent bg-[#E8F5EE] text-fmt-ok',
    rail: 'bg-fmt-ok',
    wash: 'bg-[#F3FAF6]',
    marker: 'bg-fmt-ok',
  },
  safety: {
    chip: 'border-fmt-hairline bg-white text-fmt-ink-2',
    rail: 'bg-fmt-ink-3',
    wash: 'bg-fmt-surface',
    marker: 'bg-fmt-ink-3',
  },
}

const BAND_ORDER: LadderBand[] = ['reach', 'target', 'safety']

function apcLabel(apc: number | null, oa: JournalMeta['oa_model']): string | null {
  if (apc === 0) return 'No APC'
  if (apc === null) return oa === 'subscription' ? 'None (subscription)' : null
  return `$${apc.toLocaleString('en-US')}`
}

function oaLabel(oa: JournalMeta['oa_model']): string | null {
  if (oa === 'oa') return 'Open access'
  if (oa === 'hybrid') return 'Hybrid'
  if (oa === 'subscription') return 'Subscription'
  return null
}

/**
 * One stat. A null value renders the dash AND carries the reason on hover,
 * because a bare "—" in a row of numbers reads as "this journal has none"
 * rather than "we have not verified one".
 */
function Stat({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-fmt-ink-3">{label}</p>
      <p
        className={`mt-0.5 truncate font-fmt-mono text-xs ${value ? 'text-fmt-ink' : 'text-fmt-ink-3'}`}
        title={value ? undefined : FINDER_V2.statUnknownHint}
      >
        {value ?? FINDER_V2.statUnknown}
      </p>
      {value && hint && <p className="mt-0.5 truncate text-[10px] text-fmt-ink-3">{hint}</p>}
    </div>
  )
}

/** Where this journal sits within the eligible field, as a rail with a marker. */
function PositionMeter({ percentile, band }: { percentile: number | null; band: LadderBand }) {
  if (percentile === null) return null
  const pct = Math.round(percentile * 100)
  return (
    <div className="mt-3">
      <div className="relative h-1 w-full rounded-full bg-fmt-hairline">
        <span
          aria-hidden="true"
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${BAND[band].marker}`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <p className="mt-1 font-fmt-mono text-[10px] text-fmt-ink-3">
        Standing among the journals eligible for your article type — right is more selective
      </p>
    </div>
  )
}

function SlotCard({ slot, onFormat }: { slot: LadderSlot; onFormat: (slot: LadderSlot) => void }) {
  const m = slot.meta
  const style = BAND[slot.band]

  return (
    <div className="relative overflow-hidden rounded-xl border border-fmt-hairline bg-white">
      <div aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${style.rail}`} />

      <div className={`flex flex-wrap items-center gap-2 border-b border-fmt-hairline py-2 pl-5 pr-4 ${style.wash}`}>
        <span
          className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${style.chip}`}
        >
          {FINDER_V2.bandLabels[slot.band]}
        </span>
        <span className="text-[11px] text-fmt-ink-2">{FINDER_V2.bandSubtitles[slot.band]}</span>
        {m.sjr.quartile && (
          <span className="ml-auto inline-block rounded-full border border-fmt-hairline bg-white px-2 py-0.5 font-fmt-mono text-[10px] font-medium text-fmt-ink-2">
            {m.sjr.quartile}
          </span>
        )}
        {slot.sjrUnranked && (
          <span className="ml-auto inline-block rounded-full border border-fmt-hairline bg-white px-2.5 py-0.5 text-[10px] font-medium text-fmt-ink-2">
            {FINDER_V2.notRankedChip}
          </span>
        )}
      </div>

      <div className="p-5 pl-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* flex-1 so a long journal name shrinks this column rather than pushing
              the action button onto its own line (Franklin, Session 100). */}
          <div className="min-w-0 flex-1">
            <h4 className="font-fmt-display text-lg leading-snug text-fmt-ink">{slot.name}</h4>
            {slot.scopeMismatch && (
              <span className="mt-1 inline-block rounded-full border border-transparent bg-[#FBF3E4] px-2.5 py-0.5 text-[11px] font-medium text-fmt-warn">
                Outside stated scope
              </span>
            )}
          </div>
          <button type="button" onClick={() => onFormat(slot)} className="btn btn-secondary flex-shrink-0 text-sm">
            Format for this journal →
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-fmt-ink-2">{slot.why}</p>

        <PositionMeter percentile={slot.percentile} band={slot.band} />

        {/* The numbers an author actually compares journals on. Everything here
            is either from the Scimago pull or verified from the journal's own
            pages; unverified cells stay honest rather than plausible. */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-fmt-hairline pt-3 sm:grid-cols-4">
          <Stat
            label={FINDER_V2.statSjr}
            value={m.sjr.sjr === null ? null : m.sjr.sjr.toFixed(3)}
            hint={m.sjr.categoryRank ? `rank ${m.sjr.categoryRank} of ${SJR_CATEGORY_SIZE}` : undefined}
          />
          <Stat label="Access" value={oaLabel(m.oa_model)} />
          <Stat label={FINDER_V2.statApc} value={apcLabel(m.apc_usd, m.oa_model)} />
          <Stat label={FINDER_V2.statIndexing} value={m.indexing.length ? m.indexing.join(' · ') : null} />
        </div>

        {/* The journal's own words about its speed, never normalized to a number:
            publishers measure different things and a bare "12 days" invents a
            comparability the sources do not support (Janine, Session 99). */}
        <div className="mt-3 border-t border-fmt-hairline pt-3">
          <p className="text-[10px] uppercase tracking-wide text-fmt-ink-3">{FINDER_V2.statSpeed}</p>
          <p
            className={`mt-0.5 font-fmt-mono text-[11px] leading-relaxed ${
              m.review_speed ? 'text-fmt-ink-2' : 'text-fmt-ink-3'
            }`}
          >
            {m.review_speed ?? `${FINDER_V2.statUnknown} ${FINDER_V2.statUnknownHint}`}
          </p>
        </div>

        {slot.borrowNote && (
          <p className="mt-3 rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2 text-xs text-fmt-ink-2">
            {slot.borrowNote}
          </p>
        )}

        {slot.band === 'reach' && (
          <p className="mt-3 text-xs leading-relaxed text-fmt-ink-3">{FINDER_V2.reachExpectation}</p>
        )}

        {slot.strengthen && (
          <p className="mt-3 border-l-2 border-fmt-accent pl-3 text-sm leading-relaxed text-fmt-ink-2">
            {slot.strengthen}
          </p>
        )}

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

        <div className="mt-3 flex justify-end border-t border-fmt-hairline pt-3">
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
    </div>
  )
}

/**
 * The OSCRSJ card. Rendered OUTSIDE the ladder, always, and labelled as ours.
 * Its visibility is a pure function of article type and scope — see
 * showOscrsjCard in lib/finder/ladder.ts, which deliberately does not take the
 * profile as an argument. The dashed border is deliberate: it must not read as
 * a sixth rung.
 */
function OscrsjCard({ articleTypePhrase, onFormat }: { articleTypePhrase: string; onFormat: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-fmt-hairline bg-fmt-surface p-5">
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
  // Grouped by band with a section header, so the five cards read as a ladder
  // rather than a list that happens to be sorted.
  const byBand = BAND_ORDER.map((band) => ({ band, slots: ladder.slots.filter((s) => s.band === band) })).filter(
    (g) => g.slots.length > 0,
  )

  return (
    <div className="space-y-6">
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

      {byBand.map(({ band, slots }) => (
        <section key={band}>
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="font-fmt-display text-sm font-semibold uppercase tracking-wide text-fmt-ink">
              {FINDER_V2.bandLabels[band]}
            </h3>
            <span className="text-xs text-fmt-ink-3">{FINDER_V2.bandSubtitles[band]}</span>
            <span aria-hidden="true" className="ml-2 h-px flex-1 bg-fmt-hairline" />
          </div>
          <div className="space-y-3">
            {slots.map((slot) => (
              <SlotCard key={slot.slug} slot={slot} onFormat={onFormat} />
            ))}
          </div>
        </section>
      ))}

      <p className="rounded-xl border border-fmt-hairline bg-fmt-surface px-4 py-3 text-xs leading-relaxed text-fmt-ink-2">
        {FINDER_V2.ladderDisclaimer}
        {/* The one additive line this phase adds to the disclaimer. It names the
            instruments, says what they are for, and closes on "not a prediction"
            — because a page that ranks journals by a manuscript's quality score
            will be read as a forecast unless it says otherwise, in the same
            breath. Local rather than in _copy.ts: see the note in
            FinderProfileCard.tsx. */}{' '}
        {INSTRUMENT_TRUST_LINE}
      </p>

      {ladder.showOscrsjCard && <OscrsjCard articleTypePhrase={articleTypePhrase} onFormat={onFormatOscrsj} />}

      <p className="font-fmt-mono text-[11px] leading-relaxed text-fmt-ink-3">
        Journal standings: SJR {sjrYear ?? 'year not recorded'}, Scimago category {SJR_CATEGORY} ({SJR_CATEGORY_SIZE}{' '}
        journals). {FINDER_V2.noImpactFactorNote} Unknown values render as a dash; we do not guess.
      </p>
    </div>
  )
}
