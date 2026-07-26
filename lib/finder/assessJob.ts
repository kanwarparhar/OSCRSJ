// Finder v2 — server-side glue for assessment jobs (2026-07-25).
//
// Kept OUT of lib/finder/assess.ts on purpose: assess.ts is pure and its unit
// tests must not drag in Supabase, the rule registry or the OOXML stack. This
// module is the only place the assessment touches storage or the database.
//
// Storage layout deliberately matches a formatter job — see the header of
// app/api/finder/assess/route.ts for why that is load-bearing for retention.

import { ARTICLE_TYPES, SCHEMA_VERSION, type ArticleType } from '@/lib/formatting/rulesSchema'
import { ingestDocx } from '@/lib/formatting/ooxml/ingest'
import { JOURNALS, journalAbbrev } from '@/lib/formatting/journalList'
import { admin, downloadObject, updateJob, uploadObject } from '@/lib/formatting/pipeline/jobs'
import { MAX_MANUSCRIPT_BYTES, storagePaths } from '@/lib/formatting/pipeline/api'
import type { FormattingJob } from '@/lib/formatting/pipeline/stages'
import { appendRowToSheet } from '@/lib/integrations/googleSheets'
import {
  contentHash,
  extractMethodology,
  selectInstrument,
  truncateForExtraction,
  withQualityCache,
  type MethodologyScore,
  type QualityCacheStore,
  type ReadinessChecklist,
} from '@/lib/quality'
import { getJournalMeta } from './journalMeta'
import { extractProfile, buildSelfReportedProfile, finalizeProfile, applyProfileEdits } from './assess'
import { buildLadder } from './ladder'
import {
  AUTHOR_PRIORITIES,
  type LadderResult,
  type ManuscriptProfile,
  type ProfileEdits,
  type SelfAssessment,
} from './profileTypes'
import { computeUncheckedStats } from './match'
import {
  SCOPE_TAGS,
  type ManuscriptStats,
  type MatchableJournal,
  type ScopeTag,
  type UncheckedStat,
} from './types'

/** Value written to formatting_jobs.kind, and the journal_id sentinel. */
export const FINDER_ASSESS_KIND = 'finder_assess'

// ---------------------------------------------------------------------------
// Methodological quality grading
// ---------------------------------------------------------------------------

/**
 * Supabase-backed grade cache (migration 032).
 *
 * lib/quality/ cannot reach Supabase without forfeiting the portability that
 * lets OSCRSJ's own submission intake import it, so the store is built here and
 * injected. When the Formatter wires grading in too (Phase 4) this should move
 * somewhere both can import rather than being duplicated.
 *
 * Every path swallows its own errors: withQualityCache treats a throwing store
 * as a miss, and a cache that can fail a user's run is worse than no cache.
 */
function qualityCacheStore(): QualityCacheStore {
  // `quality_cache` is not in the generated types in lib/types/database.ts,
  // which are regenerated only after a migration is applied to the live
  // database — and 032 is Kanwar's to run. The same escape hatch is used for
  // formatting_jobs in lib/formatting/pipeline/jobs.ts. Narrowed to this table.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = () => (admin() as any).from('quality_cache')

  return {
    async get(hash) {
      const { data, error } = await table().select('score').eq('content_hash', hash).maybeSingle()
      if (error || !data) return null
      return (data as { score: MethodologyScore }).score ?? null
    },
    async set(hash, instrumentId, score) {
      await table().upsert({ content_hash: hash, instrument_id: instrumentId, score }, { onConflict: 'content_hash' })
    },
  }
}

/**
 * Grade a manuscript against the instrument its extracted design selects.
 *
 * FAILURE-ISOLATED BY CONSTRUCTION. Grading is strictly additive to an
 * assessment that already works, so nothing it does may fail the job. Anything
 * that escapes extractMethodology's own degradation path is caught here and the
 * run continues with no score at all — which the profile already models as
 * `methodologyScore: null` and the anchor already treats as zero movement.
 *
 * The cache key is the TRUNCATED text, because that is what the model actually
 * saw; hashing the full body would collide two manuscripts that differ only in
 * the omitted middle.
 */
async function gradeManuscript(
  bodyText: string,
  profile: ManuscriptProfile,
): Promise<{ score: MethodologyScore | null; readiness: ReadinessChecklist | undefined }> {
  try {
    const design = profile.design.value
    const comparative = profile.comparative.value
    const def = selectInstrument(design, comparative)
    const { text } = truncateForExtraction(bodyText)
    const hash = contentHash(text, def.id)

    // Readiness is never cached: it is cheap, it rides the same call, and it is
    // the half an author is most likely to fix and immediately re-check.
    let readiness: ReadinessChecklist | undefined
    const { score } = await withQualityCache(qualityCacheStore(), hash, def.id, async () => {
      const result = await extractMethodology(bodyText, design, comparative)
      readiness = result.readiness
      return result.score
    })
    return { score, readiness }
  } catch {
    return { score: null, readiness: undefined }
  }
}

/** Re-derive a profile carrying its instrument grade and readiness checklist. */
function withMethodology(
  profile: ManuscriptProfile,
  selfAssessment: SelfAssessment | null,
  methodologyScore: MethodologyScore | null,
  readiness: ReadinessChecklist | undefined,
): ManuscriptProfile {
  return finalizeProfile(
    {
      design: profile.design,
      sampleSize: profile.sampleSize,
      multicenter: profile.multicenter,
      comparative: profile.comparative,
      followUpMonths: profile.followUpMonths,
      statsReported: profile.statsReported,
      noveltyClaim: profile.noveltyClaim,
    },
    selfAssessment,
    {
      selfReported: profile.selfReported,
      truncated: profile.truncated,
      extractionError: profile.extractionError,
      methodologyScore,
      readiness: readiness ?? profile.readiness,
    },
  )
}

/** Sidecar holding the author's answers. Reaped with the rest of the job. */
const assessInputPath = (jobId: string) => `${jobId}/assess-input.json`

export interface AssessInput {
  selfAssessment: SelfAssessment
  subspecialty: string | null
}

export interface AssessReport {
  profile: ManuscriptProfile
  ladder: LadderResult
  uncheckedStats: UncheckedStat[]
}

/** Coerce untrusted client JSON into a SelfAssessment. Unknown values drop to null. */
export function parseSelfAssessment(raw: unknown): SelfAssessment {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const novelty = ['first_reported', 'uncommon_variant', 'adds_to_known'].includes(String(o.novelty))
    ? (o.novelty as SelfAssessment['novelty'])
    : null
  const strength = [
    'definitive_or_comparative',
    'suggestive_descriptive',
    'negative_or_confirmatory',
  ].includes(String(o.strength))
    ? (o.strength as SelfAssessment['strength'])
    : null
  const priorities = Array.isArray(o.priorities)
    ? (o.priorities.filter(
        (p): p is (typeof AUTHOR_PRIORITIES)[number] =>
          typeof p === 'string' && (AUTHOR_PRIORITIES as readonly string[]).includes(p),
      ) as SelfAssessment['priorities'])
    : []
  // Max two, in the author's own order — that order drives the tie-breaks.
  return { novelty, strength, priorities: priorities.slice(0, 2) }
}

export function parseScopeTag(raw: unknown): ScopeTag | null {
  return typeof raw === 'string' && (SCOPE_TAGS as readonly string[]).includes(raw) ? (raw as ScopeTag) : null
}

export async function writeAssessInput(jobId: string, input: AssessInput): Promise<void> {
  await uploadObject(assessInputPath(jobId), Buffer.from(JSON.stringify(input)), 'application/json')
}

export async function readAssessInput(jobId: string): Promise<AssessInput | null> {
  const buf = await downloadObject(assessInputPath(jobId))
  if (!buf) return null
  try {
    return JSON.parse(buf.toString('utf8')) as AssessInput
  } catch {
    return null
  }
}

/**
 * Tag the row as an assessment job. Returns false when the `kind` column does
 * not exist yet — a not-yet-migrated database must fail loudly and by name,
 * never silently write assessment jobs that look like formatter jobs.
 */
export async function markJobKind(jobId: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin().from('formatting_jobs') as any)
      .update({ kind: FINDER_ASSESS_KIND })
      .eq('id', jobId)
    if (error) {
      console.error('[finder/assess] kind update failed — has migration 030_finder_assess_kind.sql been run?', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[finder/assess] kind update threw — has migration 030_finder_assess_kind.sql been run?', err)
    return false
  }
}

/**
 * Delete a job row we created but could not finish setting up. Used when the
 * kind tag fails on a not-yet-migrated database: without this, every rejected
 * attempt would leave an orphan row that looks like a formatter job and counts
 * against the author's daily rate limit.
 */
export async function deleteJobRow(jobId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin().from('formatting_jobs') as any).delete().eq('id', jobId)
  } catch (err) {
    console.error('[finder/assess] could not roll back job row', jobId, err)
  }
}

/** Build the matchable registry for one article type (same shape v1 uses). */
export function buildMatchable(articleType: ArticleType): MatchableJournal[] {
  return JOURNALS.map((j) => ({
    slug: j.identity.slug,
    name: j.identity.name,
    abbrev: journalAbbrev(j.identity.slug),
    publisher: j.identity.publisher,
    guidelinesUrl: j.identity.guidelines_url,
    verifiedDate: j.identity.verified_date,
    isSelf: j.identity.slug === 'oscrsj',
    articleTypes: j.article_types,
    limits: j.word_limits[articleType] ?? null,
    meta: getJournalMeta(j.identity.slug, j.article_types),
  }))
}

/**
 * Build a ladder for an already-derived profile. Shared by the upload path and
 * the synchronous manual path so both produce identical ladders from identical
 * inputs.
 */
export function ladderFor(
  profile: ManuscriptProfile,
  selfAssessment: SelfAssessment,
  stats: ManuscriptStats,
): AssessReport {
  const journals = buildMatchable(stats.articleType)
  return {
    profile,
    ladder: buildLadder(profile, selfAssessment, stats, { sortBy: 'fit' }, journals),
    uncheckedStats: computeUncheckedStats(stats, journals),
  }
}

/** Tab in the shared "OSCRSJ Form Submissions" Google Sheet. */
const FINDER_SHEET_TAB = 'Finder Submissions'

/**
 * Envelope-only log line. NOTHING from inside the manuscript goes here: no text,
 * no filename, no quote, no email. Study design and the anchor are the two facts
 * that make the ladder auditable after the fact; both are derived, not content.
 * Fire-and-forget — a Sheets outage must never fail an assessment.
 */
export function logAssessment(
  report: AssessReport,
  stats: ManuscriptStats,
  mode: 'upload' | 'manual',
  ip: string | null,
): void {
  const topReach = report.ladder.slots.find((s) => s.band === 'reach')
  void appendRowToSheet({
    sheetName: FINDER_SHEET_TAB,
    row: [
      new Date().toISOString(),
      stats.articleType,
      report.profile.design.value ?? '',
      report.profile.anchor,
      topReach?.slug ?? '(none)',
      report.ladder.eligibleCount,
      mode,
      ip ?? '',
    ],
  })
}

/**
 * Rebuild the ladder for an already-assessed job after the author answers the
 * three questions.
 *
 * The questions are asked AFTER the profile is shown, which is the whole point:
 * an author should see what the text actually supports before rating their own
 * work. So the ladder has to be recomputable from the stored profile. This
 * re-derives the anchor from the SAME verified fields with the new author shift
 * applied, and makes NO new DeepSeek call — re-reading the manuscript to apply a
 * radio button would be both wasteful and non-deterministic.
 */
export async function rebuildLadder(
  job: FormattingJob,
  selfAssessment: SelfAssessment,
  profileEdits: ProfileEdits = {},
): Promise<AssessReport | null> {
  const stored = job.report as unknown as AssessReport | null
  if (!stored?.profile) return null

  const p = stored.profile
  const base = finalizeProfile(
    {
      design: p.design,
      sampleSize: p.sampleSize,
      multicenter: p.multicenter,
      comparative: p.comparative,
      followUpMonths: p.followUpMonths,
      statsReported: p.statsReported,
      noveltyClaim: p.noveltyClaim,
    },
    selfAssessment,
    {
      selfReported: p.selfReported,
      truncated: p.truncated,
      extractionError: p.extractionError,
      // Carried through from the stored assessment. Re-grading here would mean a
      // second DeepSeek call to answer three radio buttons, and dropping it
      // would make the instrument card vanish the moment the author engages with
      // the page. applyProfileEdits below discards the score by itself if a
      // corrected design selects a different instrument.
      methodologyScore: p.methodologyScore ?? null,
      readiness: p.readiness,
    },
  )
  // Corrections are applied to the STORED extraction, never to a re-read of the
  // manuscript: the author is correcting what we showed them, and a second
  // DeepSeek pass could quietly change a field they never touched.
  const profile = applyProfileEdits(base, profileEdits, selfAssessment)

  const input = await readAssessInput(job.id)
  const articleType = (
    job.article_type && (ARTICLE_TYPES as readonly string[]).includes(job.article_type)
      ? job.article_type
      : 'original_research'
  ) as ArticleType
  const stats: ManuscriptStats = {
    articleType,
    wordCount: null,
    abstractWordCount: null,
    figureCount: null,
    tableCount: null,
    referenceCount: null,
    subspecialty: parseScopeTag(input?.subspecialty),
  }

  const report = ladderFor(profile, selfAssessment, stats)
  await writeAssessInput(job.id, { selfAssessment, subspecialty: input?.subspecialty ?? null })
  await updateJob(job.id, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    report: report as any,
    updated_at: new Date().toISOString(),
  } as Partial<FormattingJob>)
  logAssessment(report, stats, 'upload', job.ip)
  return report
}

/**
 * Manual (no-upload) mode: nothing is read, so nothing is presented as read.
 *
 * Author-stated study characteristics are welcome here — in manual mode EVERY
 * value is author-stated, and `selfReported` already labels the whole card. The
 * edits path is what lets a manual user say "retrospective comparative, 124
 * patients, 10 months" instead of getting an all-null profile and a ladder built
 * on an article-type guess.
 */
export function manualAssessment(
  stats: ManuscriptStats,
  selfAssessment: SelfAssessment,
  profileEdits: ProfileEdits = {},
): AssessReport {
  const base = buildSelfReportedProfile(stats.articleType, selfAssessment)
  return ladderFor(applyProfileEdits(base, profileEdits, selfAssessment), selfAssessment, stats)
}

/**
 * Run the assessment for an uploaded job: verify the bytes, read the body,
 * extract a verified profile, build the ladder, persist. Terminal either way —
 * a failure writes a plain message the author can act on.
 */
/**
 * Advance the job's status purely so the waiting screen has something true to
 * report. Best-effort: a failed status write must never fail an assessment that
 * is otherwise fine, so this swallows its error and the client falls back to the
 * elapsed-time view.
 */
async function setStage(jobId: string, status: FormattingJob['status']): Promise<void> {
  try {
    await updateJob(jobId, { status, updated_at: new Date().toISOString() } as Partial<FormattingJob>)
  } catch (err) {
    console.error('[finder/assess] stage write failed (non-fatal)', jobId, status, err)
  }
}

export async function runAssessment(job: FormattingJob): Promise<{ status: 'complete' | 'failed'; message?: string }> {
  const fail = async (message: string) => {
    await updateJob(job.id, {
      status: 'failed',
      error: { stage: job.status, message },
      updated_at: new Date().toISOString(),
    } as Partial<FormattingJob>)
    return { status: 'failed' as const, message }
  }

  const input = await downloadObject(storagePaths.input(job.id))
  if (!input) return fail('Uploaded file not found. Please re-upload.')

  // First point the server sees the bytes — the signed upload URL bypasses every
  // route. Same size cap and zip magic as the formatter (Session 98, Part G2).
  if (input.length > MAX_MANUSCRIPT_BYTES) {
    return fail(
      `The uploaded file is larger than the ${Math.round(MAX_MANUSCRIPT_BYTES / (1024 * 1024))} MB limit. Please upload a smaller .docx.`,
    )
  }
  if (input.length < 4 || input[0] !== 0x50 || input[1] !== 0x4b || input[2] !== 0x03 || input[3] !== 0x04) {
    return fail(
      'The uploaded file is not a Word .docx (it does not have a Word file signature). Please export your manuscript as .docx and re-upload.',
    )
  }

  let bodyText = ''
  try {
    const { model } = await ingestDocx(new Uint8Array(input))
    bodyText = model.bodyText
  } catch (e) {
    return fail(`We could not open this .docx (${e instanceof Error ? e.message : String(e)}).`)
  }
  if (!bodyText.trim()) return fail('We could not read any text from this manuscript.')

  const stored = await readAssessInput(job.id)
  const selfAssessment = stored?.selfAssessment ?? parseSelfAssessment(null)
  const articleType = (
    job.article_type && (ARTICLE_TYPES as readonly string[]).includes(job.article_type)
      ? job.article_type
      : 'original_research'
  ) as ArticleType

  // Extraction degrades honestly: a null profile is disclosed, never fatal.
  //
  // The two stage writes bracketing this call exist ONLY so the waiting screen
  // can show real progress instead of a spinner that means nothing: the client
  // maps status → step (see FINDER_STAGES). Each write marks a step that is
  // STARTING, and is best-effort — a failed write degrades the screen, never the
  // assessment.
  await setStage(job.id, 'extracted')
  const extracted = await extractProfile(bodyText, selfAssessment)
  await setStage(job.id, 'verified')

  // Grading runs after extraction because the extracted DESIGN selects the
  // instrument. It is strictly additive: on any failure the score is null, the
  // anchor moves by exactly zero, and the run is the run we shipped yesterday.
  const graded = await gradeManuscript(bodyText, extracted)
  const profile = withMethodology(extracted, selfAssessment, graded.score, graded.readiness)

  const stats: ManuscriptStats = {
    articleType,
    // The Finder v2 profile is about study characteristics, not formatting
    // counts. Word count is the one number we can read for free and without
    // interpretation; the rest stay null and the sparse-input notice says so.
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    abstractWordCount: null,
    figureCount: null,
    tableCount: null,
    referenceCount: null,
    subspecialty: parseScopeTag(stored?.subspecialty),
  }

  const report = ladderFor(profile, selfAssessment, stats)
  logAssessment(report, stats, 'upload', job.ip)

  await updateJob(job.id, {
    status: 'complete',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    report: report as any,
    rules_version: SCHEMA_VERSION,
    updated_at: new Date().toISOString(),
  } as Partial<FormattingJob>)

  return { status: 'complete' }
}
