// Pipeline stage runner (Sushant, Session C). One stage per advance() call,
// each ≤ the Vercel Hobby ~50s budget. The manuscript is re-ingested from
// Storage each stage (deterministic, cheap); only the LLM/network-derived data
// (parsed refs, verified refs, extracted metadata, cost) is persisted between
// calls as formatting/<jobId>/state.json. The reference-verify stage is
// resumable via stage_cursor. Every stage is wrapped so a failure lands the job
// in 'failed' with an actionable message rather than throwing to the route.

import PizZip from 'pizzip'
import { getJob, updateJob, claimStage, downloadObject, uploadObject, readJobMeta } from './jobs'
import { isTerminal, stripLock } from './stages'
import type { StageCursor } from './stages'
import { storagePaths, outputBaseName, capReferences, MAX_MANUSCRIPT_BYTES } from './api'
import { getJournal } from '../journalList'
import { SCHEMA_VERSION, type ArticleType } from '../rulesSchema'
import { ingestDocx } from '../ooxml/ingest'
import { applyLayout } from '../ooxml/layout'
import { blindManuscript } from '../ooxml/blinding'
import { buildTitlePage } from '../ooxml/titlePage'
import { renumberCitations } from '../references/renumber'
import { buildFormattedReferences, hasStyleCaveat } from '../references/formattedList'
import { emitDocxBuffer } from '../ooxml/emit'
import { extractBodyText, PART } from '../ooxml/docx'
import { assertBodyImmutable } from './immutability'
import { parseReferences } from '../references/parse'
import { verifyReferences } from '../references/verify'
import { extractTitlePage } from './extract'
import { analyze, analyzeFigures } from './analyze'
import { buildReport, renderReportDocx, studyDesignForArticleType } from '../report'
import { extractMethodology } from '@/lib/quality/extract'
import type { MethodologyScore } from '@/lib/quality/types'
import type { JobStatus, JobOutputPaths } from './stages'
import type {
  CslReference,
  VerifiedReference,
  ExtractedTitlePageData,
  ReportChange,
  ReportSuggestion,
  ReferenceAuditRow,
} from '../types'

interface PipelineState {
  cslReferences: CslReference[]
  verifiedReferences: VerifiedReference[]
  titlePageData: ExtractedTitlePageData
  cost: { deepseekTokens: number; usd: number }
  /**
   * User-facing degradation notes (2026-07-22, Part D). Anything the pipeline
   * could not do this run — a DeepSeek outage, a capped reference list — is
   * recorded here and rendered into the report, instead of being discarded and
   * leaving the author to wonder why a section is silently thin.
   */
  degradedNotes?: string[]
}

const STATE_PATH = (jobId: string) => `${jobId}/state.json`

/** Parse-stage self-budget (mirrors verify.ts BUDGET_MS): stop starting new
 *  DeepSeek batches past this and hand back a cursor. */
const PARSE_BUDGET_MS = 40_000

/** Minimum budget left to attempt the title-page extraction in the same call. */
const TITLE_PAGE_RESERVE_MS = 15_000

/**
 * Grading budget for the render stage (2026-07-26).
 *
 * Shorter than the 40s the grading call allows itself elsewhere, because here it
 * is a passenger. The render stage still has to run every transform, the
 * immutability gate and four Storage uploads inside the same ~50s function
 * budget, and those produce the thing the author actually came for. Grading gets
 * whatever is left over and is skipped outright if the stage has already spent
 * RENDER_GRADING_MAX_START_MS getting to this point -- an ungraded report is a
 * missing section, whereas a killed function is a job the user has to retry.
 */
const RENDER_GRADING_TIMEOUT_MS = 20_000
const RENDER_GRADING_MAX_START_MS = 12_000

/**
 * Grade the manuscript, or return undefined and say why in the log.
 *
 * FAILURE IS ISOLATED HERE AND NOWHERE ELSE. extractMethodology already degrades
 * internally rather than throwing, but "already" is not "guaranteed" -- it
 * reaches the network, and a formatting job must not be able to fail because a
 * quality score did not arrive. So this wraps it anyway, catches everything, and
 * returns undefined on any problem. The report then simply has no methodology
 * section, which is the same outcome as a journal whose article type carries no
 * validated instrument, and which every renderer already handles.
 */
async function gradeQuietly(
  bodyText: string,
  articleType: ArticleType,
  elapsedMs: number,
): Promise<MethodologyScore | undefined> {
  const design = studyDesignForArticleType(articleType)
  // No design we can honestly claim from the article type. Not an error, and not
  // worth a network call: see DESIGN_BY_ARTICLE_TYPE in report.ts.
  if (design === null) return undefined
  if (elapsedMs > RENDER_GRADING_MAX_START_MS) {
    console.warn('[formatting] skipped methodology grading: render stage near budget')
    return undefined
  }
  try {
    const { score } = await extractMethodology(bodyText, design, null, {
      timeoutMs: RENDER_GRADING_TIMEOUT_MS,
    })
    if (score.gradingError) {
      console.warn(`[formatting] methodology grading degraded: ${score.gradingError}`)
      return undefined
    }
    return score
  } catch (e) {
    console.warn(
      `[formatting] methodology grading threw: ${e instanceof Error ? e.message : String(e)}`,
    )
    return undefined
  }
}

const emptyState = (): PipelineState => ({
  cslReferences: [],
  verifiedReferences: [],
  titlePageData: { title: null, runningTitle: null, authors: [], affiliations: [], correspondingAuthor: null, keywords: [] },
  cost: { deepseekTokens: 0, usd: 0 },
  degradedNotes: [],
})

const addDegradedNote = (state: PipelineState, note: string): void => {
  state.degradedNotes = state.degradedNotes ?? []
  if (!state.degradedNotes.includes(note)) state.degradedNotes.push(note)
}

async function loadState(jobId: string): Promise<PipelineState> {
  const buf = await downloadObject(STATE_PATH(jobId))
  if (!buf) return emptyState()
  try {
    return { ...emptyState(), ...(JSON.parse(buf.toString('utf8')) as Partial<PipelineState>) }
  } catch {
    return emptyState()
  }
}

/**
 * Persist pipeline state. Returns false on a failed write (2026-07-22, Part
 * D — the boolean was previously discarded): the caller must NOT advance the
 * status over lost state, because the next stage would then run against stale
 * or missing data after real LLM spend.
 */
async function saveState(jobId: string, state: PipelineState): Promise<boolean> {
  return uploadObject(STATE_PATH(jobId), Buffer.from(JSON.stringify(state)), 'application/json')
}

/**
 * A retryable (non-terminal) advance failure: status is left untouched so the
 * client can try again, and the stage lock is released best-effort so the
 * retry is not stalled behind our own claim.
 */
async function retryable(job: { id: string; status: JobStatus; stage_cursor: StageCursor | null }, message: string): Promise<AdvanceOutcome> {
  await updateJob(job.id, { stage_cursor: stripLock(job.stage_cursor) })
  return { status: job.status, error: message }
}

async function fail(jobId: string, stage: JobStatus, message: string): Promise<AdvanceOutcome> {
  // stage_cursor: null also releases the stage lock (terminal state).
  await updateJob(jobId, {
    status: 'failed',
    error: { stage, code: 'stage_failed', message },
    stage_cursor: null,
  })
  return { status: 'failed', error: message }
}

export interface AdvanceOutcome {
  status: JobStatus
  error?: string
  /** True when another caller holds the stage lock — nothing was run. */
  inProgress?: boolean
}

/** Display names for the verification sources (the raw values are lowercase). */
const SOURCE_LABEL: Record<VerifiedReference['source'], string> = {
  crossref: 'Crossref',
  pubmed: 'PubMed',
  none: 'no source',
}

function auditRow(v: VerifiedReference, index: number): ReferenceAuditRow {
  const r = v.reference
  // "Corrected" overclaimed: nothing was corrected anywhere the author could
  // use it, because the engine never edits the manuscript body. What actually
  // happens is that the enriched record is rendered into the formatted list
  // below the audit table — so the copy points there (Session 97, Part A).
  const changed =
    v.status === 'corrected'
      ? `Verified against ${SOURCE_LABEL[v.source]} — formatted version below`
      : v.status === 'verified'
        ? `Verified against ${SOURCE_LABEL[v.source]}`
        : v.status === 'possibly-retracted'
          ? 'Possibly retracted — verify before citing'
          : 'Could not verify — check manually'
  return { index, status: v.status, changed, doi: r.doi, pmid: r.pmid }
}


/** Run the single stage appropriate to the job's current status. */
export async function runNextStage(jobId: string): Promise<AdvanceOutcome> {
  let job = await getJob(jobId)
  if (!job) return { status: 'failed', error: 'Job not found' }
  const rules = getJournal(job.journal_id)
  if (!rules) return fail(jobId, job.status, 'Unknown target journal.')
  const articleType = (job.article_type ?? 'case_report') as ArticleType

  // Stage lock (2026-07-22, Part C): exactly one caller runs the stage. A
  // parallel advance (second tab, refresh, retry after a 504) loses the CAS
  // and reports in-progress; the client loop polls again. Every stage-end
  // write below replaces or nulls stage_cursor, which releases the lock; a
  // function killed mid-stage leaves a lock that expires on its own.
  if (!isTerminal(job.status)) {
    const claim = await claimStage(job)
    if (!claim.claimed || !claim.job) return { status: job.status, inProgress: true }
    job = claim.job
  }

  try {
    switch (job.status) {
      // ---- parse: download + ingest + hazard check ----
      case 'uploaded': {
        const input = await downloadObject(storagePaths.input(jobId))
        if (!input) return fail(jobId, 'uploaded', 'Uploaded file not found. Please re-upload.')
        // Server-side upload verification (2026-07-22, Part G2): the signed
        // upload URL bypasses every route, so this is the first place the
        // server sees the bytes. Size cap + zip magic before spending any
        // work on them.
        if (input.length > MAX_MANUSCRIPT_BYTES) {
          return fail(
            jobId,
            'uploaded',
            `The uploaded file is larger than the ${Math.round(MAX_MANUSCRIPT_BYTES / (1024 * 1024))} MB limit. Please upload a smaller .docx.`,
          )
        }
        if (
          input.length < 4 ||
          input[0] !== 0x50 || // P
          input[1] !== 0x4b || // K
          input[2] !== 0x03 ||
          input[3] !== 0x04
        ) {
          return fail(
            jobId,
            'uploaded',
            'The uploaded file is not a Word .docx (it does not have a Word file signature). Please export your manuscript as .docx and re-upload.',
          )
        }
        const { model } = await ingestDocx(new Uint8Array(input))
        const fatal = model.hazards.find((h) => h.fatal)
        if (fatal) return fail(jobId, 'parsed', fatal.message)
        await updateJob(jobId, { status: 'parsed', stage_cursor: null }) // null also releases the lock
        return { status: 'parsed' }
      }

      // ---- extract: parse references + title-page metadata (DeepSeek) ----
      // Resumable with a self-budget (2026-07-22, Part D — the verify-stage
      // pattern): a long reference list is parsed across multiple advance
      // calls via stage_cursor.references_parsed, so a Vercel-killed function
      // never causes a full re-parse (re-spend) from batch 1.
      case 'parsed': {
        const t0 = Date.now()
        const input = await downloadObject(storagePaths.input(jobId))
        if (!input) return fail(jobId, 'parsed', 'Uploaded file not found.')
        const { model } = await ingestDocx(new Uint8Array(input))
        const state = await loadState(jobId) // partial results from a prior call
        const { refs: rawRefs, note: capNote } = capReferences(model.rawReferences)
        if (capNote) addDegradedNote(state, capNote)

        const cursor = job.stage_cursor?.references_parsed ?? 0
        if (cursor < rawRefs.length) {
          const parsed = await parseReferences(rawRefs, {
            startIndex: cursor,
            budgetMs: PARSE_BUDGET_MS,
          })
          state.cslReferences = [...state.cslReferences.slice(0, cursor), ...parsed.references]
          state.cost.deepseekTokens += parsed.usage.promptTokens + parsed.usage.completionTokens
          state.cost.usd += parsed.usage.estCostUsd
          if (parsed.degraded) {
            addDegradedNote(
              state,
              'Some references could not be read by the reference parser this run; they appear verbatim in the reference list and were not verified.',
            )
          }
          if (!(await saveState(jobId, state))) {
            return retryable(job, 'Could not persist parsing progress. Please retry.')
          }
          if (parsed.nextCursor != null) {
            // more to do — stay on 'parsed'; the wholesale cursor write also
            // releases the stage lock
            await updateJob(jobId, {
              stage_cursor: { references_parsed: parsed.nextCursor, parse_total: rawRefs.length },
            })
            return { status: 'parsed' }
          }
        }

        // All references parsed. Run the title-page extraction only if enough
        // budget remains for its call; otherwise hand the cursor back and do
        // it as the sole work of the next advance call.
        if (Date.now() - t0 > PARSE_BUDGET_MS - TITLE_PAGE_RESERVE_MS) {
          await updateJob(jobId, {
            stage_cursor: { references_parsed: rawRefs.length, parse_total: rawRefs.length },
          })
          return { status: 'parsed' }
        }
        const front = model.bodyText.slice(0, 6000)
        const meta = await extractTitlePage(front, { timeoutMs: 40_000 })
        state.titlePageData = meta.data
        state.cost.deepseekTokens += meta.usage.promptTokens + meta.usage.completionTokens
        state.cost.usd += meta.usage.estCostUsd
        if (!(await saveState(jobId, state))) {
          return retryable(job, 'Could not persist parsing progress. Please retry.')
        }
        await updateJob(jobId, { status: 'extracted', stage_cursor: null }) // null also releases the lock
        return { status: 'extracted' }
      }

      // ---- verify: Crossref/PubMed, resumable ----
      case 'extracted': {
        const state = await loadState(jobId)
        const cursor = job.stage_cursor?.references_verified ?? 0
        const batch = await verifyReferences(state.cslReferences, cursor)
        state.verifiedReferences = [...state.verifiedReferences.slice(0, cursor), ...batch.verified]
        if (!(await saveState(jobId, state))) {
          return retryable(job, 'Could not persist verification progress. Please retry.')
        }
        if (batch.nextCursor != null) {
          // more to do — stay on 'extracted', advance() will resume from the
          // cursor. Wholesale cursor replacement also releases the stage lock.
          await updateJob(jobId, {
            stage_cursor: { references_verified: batch.nextCursor, references_total: state.cslReferences.length },
          })
          return { status: 'extracted' }
        }
        await updateJob(jobId, { status: 'verified', stage_cursor: null })
        return { status: 'verified' }
      }

      // ---- render: deterministic format + report + package ----
      case 'verified': {
        const t0 = Date.now()
        const input = await downloadObject(storagePaths.input(jobId))
        if (!input) return fail(jobId, 'verified', 'Uploaded file not found.')
        const state = await loadState(jobId)
        const { docx, model } = await ingestDocx(new Uint8Array(input))
        const before = model.bodyText
        const ctx = { rules, articleType }

        // Methodological grading runs HERE, at the top of the stage, off the
        // body text we have just ingested -- never by re-parsing the .docx, and
        // never after the uploads. Running it early means a slow grading call
        // eats budget that the deterministic work has not spent yet; running it
        // late would risk the function being killed after the manuscript and
        // report were already written but before the status advanced, which
        // turns a missing section into a duplicated run.
        const methodology = await gradeQuietly(before, articleType, Date.now() - t0)

        const layout = applyLayout(docx, model, ctx, { runningTitle: state.titlePageData.runningTitle ?? undefined })
        const blinding = blindManuscript(docx, model, ctx)
        const renumber = renumberCitations(docx, rules)

        // content-immutability gate — the only permitted body delta is the reported markers
        const after = extractBodyText(docx.part(PART.document)!)
        const gate = assertBodyImmutable(before, after, renumber.markerEdits)
        if (!gate.ok) {
          return fail(jobId, 'rendered', `Internal safety check failed (content would have changed): ${gate.diffExcerpt ?? ''}`)
        }

        const changes: ReportChange[] = [...layout.changes, ...blinding.changes]
        const flags: ReportSuggestion[] = [...blinding.flags]
        const { suggestions, checklist } = analyze({
          model,
          rules,
          articleType,
          keywordCount: state.titlePageData.keywords.length || null,
        })
        const allSuggestions = [...flags, ...suggestions]
        // Degradation honesty (2026-07-22, Part D): notes recorded by earlier
        // stages (capped reference list, parser outage) surface in the report
        // instead of leaving a silently thin reference section.
        for (const note of state.degradedNotes ?? []) {
          allSuggestions.push({
            title: 'Processing limitation',
            location: null,
            detail: note,
            suggestedWording: null,
            severity: 'info',
          })
        }
        const referenceAudit = state.verifiedReferences.map((v, i) => auditRow(v, i + 1))

        // outputs — user-facing names are the original filename + _<journal abbrev>
        const meta = await readJobMeta(jobId)
        const baseName = outputBaseName(meta?.originalFilename, job.journal_id)
        let titlePageBytes: Uint8Array | null = null

        // Report-only figure checks. Jobs created before 2026-07-18 have no
        // figure fields in their meta sidecar; they simply produce no flags.
        allSuggestions.push(
          ...analyzeFigures({
            rules,
            articleType,
            figureCount: meta?.figureCount ?? 0,
            figureFilenames: meta?.figureFilenames ?? [],
          }),
        )
        const manuscript = emitDocxBuffer(docx)
        const outputs: JobOutputPaths = {
          manuscript: storagePaths.outputManuscript(jobId),
        }
        await uploadObject(
          storagePaths.outputManuscript(jobId),
          manuscript,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

        // Title-page generation was removed 2026-07-11 and REINSTATED 2026-07-18
        // (Kanwar approval, Session 97 Part H): in both live assessment runs the
        // #1 action-required item was "provide a separate title page", while
        // buildTitlePage sat complete and uncalled.
        //
        // It is a SEPARATE FILE, never merged into the manuscript, so the
        // content-immutability gate above is untouched by it. Fields we could
        // not extract render as bracketed prompts, never invented values — a
        // pre-blinded upload yields a mostly-placeholder file, which is a
        // useful skeleton and is described as a draft, not a finished page.
        if (rules.blinding.separate_title_page) {
          const titlePage = buildTitlePage(state.titlePageData, ctx)
          outputs.title_page = storagePaths.outputTitlePage(jobId)
          await uploadObject(
            storagePaths.outputTitlePage(jobId),
            Buffer.from(titlePage.bytes),
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          )
          titlePageBytes = titlePage.bytes
          const n = titlePage.placeholders.length
          allSuggestions.push({
            title: 'Provide a separate title page',
            location: null,
            detail:
              `${rules.identity.name} requires a separate title page uploaded as its own file. ` +
              `We generated a starting draft (${baseName}_title-page.docx) in the journal's element order` +
              (n > 0
                ? `, with ${n} field${n === 1 ? '' : 's'} left as a bracketed prompt because we could not read ${n === 1 ? 'it' : 'them'} from your manuscript. Fill every bracket and verify every other field before submitting.`
                : '. Verify every field before submitting.'),
            suggestedWording: null,
            severity: 'action-required',
          })
        }

        const report = buildReport({
          journalName: rules.identity.name,
          verifiedDate: rules.identity.verified_date,
          guidelinesUrl: rules.identity.guidelines_url,
          rulesVersion: SCHEMA_VERSION,
          changes,
          suggestions: allSuggestions,
          referenceAudit,
          formattedReferences: buildFormattedReferences(state.verifiedReferences, rules),
          styleCaveat: hasStyleCaveat(rules),
          // 26 of 75 journals prescribe no manuscript layout at all. The layout
          // transform is then a deliberate no-op, and saying so beats leaving
          // the author to wonder why "formatting" changed nothing.
          layoutNotPrescribed:
            rules.layout.page_size === null &&
            rules.layout.font.family === null &&
            rules.layout.font.size_pt === null &&
            rules.layout.margins_mm === null &&
            rules.layout.line_spacing === null,
          checklist,
          methodology,
          cost: state.cost,
        })
        const reportDocx = renderReportDocx(report)
        outputs.report_docx = storagePaths.outputReportDocx(jobId)
        await uploadObject(storagePaths.outputReportDocx(jobId), reportDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

        // zip bundle
        const zip = new PizZip()
        zip.file(`${baseName}.docx`, Buffer.from(manuscript))
        zip.file(`${baseName}_report.docx`, Buffer.from(reportDocx))
        if (titlePageBytes) zip.file(`${baseName}_title-page.docx`, Buffer.from(titlePageBytes))
        const zipBytes = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
        outputs.zip = storagePaths.outputZip(jobId)
        await uploadObject(storagePaths.outputZip(jobId), zipBytes, 'application/zip')

        await updateJob(jobId, { status: 'rendered', report, output_paths: outputs, stage_cursor: null })
        return { status: 'rendered' }
      }

      // ---- complete: results are delivered on-page (no email; Kanwar
      // directive 2026-07-11 — the email address is collected for the usage
      // log only) ----
      case 'rendered': {
        await updateJob(jobId, { status: 'complete', stage_cursor: null })
        return { status: 'complete' }
      }

      case 'complete':
      case 'failed':
        return { status: job.status }
    }
  } catch (e) {
    return fail(jobId, job.status, e instanceof Error ? e.message : 'Unexpected pipeline error.')
  }
}
