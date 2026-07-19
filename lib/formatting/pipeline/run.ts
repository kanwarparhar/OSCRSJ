// Pipeline stage runner (Sushant, Session C). One stage per advance() call,
// each ≤ the Vercel Hobby ~50s budget. The manuscript is re-ingested from
// Storage each stage (deterministic, cheap); only the LLM/network-derived data
// (parsed refs, verified refs, extracted metadata, cost) is persisted between
// calls as formatting/<jobId>/state.json. The reference-verify stage is
// resumable via stage_cursor. Every stage is wrapped so a failure lands the job
// in 'failed' with an actionable message rather than throwing to the route.

import PizZip from 'pizzip'
import { getJob, updateJob, downloadObject, uploadObject, readJobMeta } from './jobs'
import { storagePaths, outputBaseName } from './api'
import { getJournal } from '../journalList'
import { SCHEMA_VERSION, type ArticleType } from '../rulesSchema'
import { ingestDocx } from '../ooxml/ingest'
import { applyLayout } from '../ooxml/layout'
import { blindManuscript } from '../ooxml/blinding'
import { renumberCitations } from '../references/renumber'
import { buildFormattedReferences, hasStyleCaveat } from '../references/formattedList'
import { emitDocxBuffer } from '../ooxml/emit'
import { extractBodyText, PART } from '../ooxml/docx'
import { assertBodyImmutable } from './immutability'
import { parseReferences } from '../references/parse'
import { verifyReferences } from '../references/verify'
import { extractTitlePage } from './extract'
import { analyze } from './analyze'
import { buildReport, renderReportDocx } from '../report'
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
}

const STATE_PATH = (jobId: string) => `${jobId}/state.json`

const emptyState = (): PipelineState => ({
  cslReferences: [],
  verifiedReferences: [],
  titlePageData: { title: null, runningTitle: null, authors: [], affiliations: [], correspondingAuthor: null, keywords: [] },
  cost: { deepseekTokens: 0, usd: 0 },
})

async function loadState(jobId: string): Promise<PipelineState> {
  const buf = await downloadObject(STATE_PATH(jobId))
  if (!buf) return emptyState()
  try {
    return { ...emptyState(), ...(JSON.parse(buf.toString('utf8')) as Partial<PipelineState>) }
  } catch {
    return emptyState()
  }
}

async function saveState(jobId: string, state: PipelineState): Promise<void> {
  await uploadObject(STATE_PATH(jobId), Buffer.from(JSON.stringify(state)), 'application/json')
}

async function fail(jobId: string, stage: JobStatus, message: string): Promise<AdvanceOutcome> {
  await updateJob(jobId, { status: 'failed', error: { stage, code: 'stage_failed', message } })
  return { status: 'failed', error: message }
}

export interface AdvanceOutcome {
  status: JobStatus
  error?: string
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
  const job = await getJob(jobId)
  if (!job) return { status: 'failed', error: 'Job not found' }
  const rules = getJournal(job.journal_id)
  if (!rules) return fail(jobId, job.status, 'Unknown target journal.')
  const articleType = (job.article_type ?? 'case_report') as ArticleType

  try {
    switch (job.status) {
      // ---- parse: download + ingest + hazard check ----
      case 'uploaded': {
        const input = await downloadObject(storagePaths.input(jobId))
        if (!input) return fail(jobId, 'uploaded', 'Uploaded file not found. Please re-upload.')
        const { model } = await ingestDocx(new Uint8Array(input))
        const fatal = model.hazards.find((h) => h.fatal)
        if (fatal) return fail(jobId, 'parsed', fatal.message)
        await updateJob(jobId, { status: 'parsed' })
        return { status: 'parsed' }
      }

      // ---- extract: parse references + title-page metadata (DeepSeek) ----
      case 'parsed': {
        const input = await downloadObject(storagePaths.input(jobId))
        if (!input) return fail(jobId, 'parsed', 'Uploaded file not found.')
        const { model } = await ingestDocx(new Uint8Array(input))
        const parsed = await parseReferences(model.rawReferences)
        const front = model.bodyText.slice(0, 6000)
        const meta = await extractTitlePage(front)
        const state = emptyState()
        state.cslReferences = parsed.references
        state.titlePageData = meta.data
        state.cost = {
          deepseekTokens:
            parsed.usage.promptTokens + parsed.usage.completionTokens + meta.usage.promptTokens + meta.usage.completionTokens,
          usd: parsed.usage.estCostUsd + meta.usage.estCostUsd,
        }
        await saveState(jobId, state)
        await updateJob(jobId, { status: 'extracted' })
        return { status: 'extracted' }
      }

      // ---- verify: Crossref/PubMed, resumable ----
      case 'extracted': {
        const state = await loadState(jobId)
        const cursor = job.stage_cursor?.references_verified ?? 0
        const batch = await verifyReferences(state.cslReferences, cursor)
        state.verifiedReferences = [...state.verifiedReferences.slice(0, cursor), ...batch.verified]
        await saveState(jobId, state)
        if (batch.nextCursor != null) {
          // more to do — stay on 'extracted', advance() will resume from the cursor
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
        const input = await downloadObject(storagePaths.input(jobId))
        if (!input) return fail(jobId, 'verified', 'Uploaded file not found.')
        const state = await loadState(jobId)
        const { docx, model } = await ingestDocx(new Uint8Array(input))
        const before = model.bodyText
        const ctx = { rules, articleType }

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
        const referenceAudit = state.verifiedReferences.map((v, i) => auditRow(v, i + 1))

        // outputs — user-facing names are the original filename + _<journal abbrev>
        const meta = await readJobMeta(jobId)
        const baseName = outputBaseName(meta?.originalFilename, job.journal_id)
        const manuscript = emitDocxBuffer(docx)
        const outputs: JobOutputPaths = {
          manuscript: storagePaths.outputManuscript(jobId),
        }
        await uploadObject(
          storagePaths.outputManuscript(jobId),
          manuscript,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

        // Title-page generation removed (Kanwar directive 2026-07-11): the tool
        // no longer emits a title-page file — authors prepare their own. When
        // the journal requires one, remind them in the report instead.
        if (rules.blinding.separate_title_page) {
          allSuggestions.push({
            title: 'Provide a separate title page',
            location: null,
            detail: `${rules.identity.name} requires a separate title page uploaded as its own file. Include: ${rules.title_page.elements.join(', ')}.`,
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
          checklist,
          cost: state.cost,
        })
        const reportDocx = renderReportDocx(report)
        outputs.report_docx = storagePaths.outputReportDocx(jobId)
        await uploadObject(storagePaths.outputReportDocx(jobId), reportDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

        // zip bundle
        const zip = new PizZip()
        zip.file(`${baseName}.docx`, Buffer.from(manuscript))
        zip.file(`${baseName}_report.docx`, Buffer.from(reportDocx))
        const zipBytes = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
        outputs.zip = storagePaths.outputZip(jobId)
        await uploadObject(storagePaths.outputZip(jobId), zipBytes, 'application/zip')

        await updateJob(jobId, { status: 'rendered', report, output_paths: outputs })
        return { status: 'rendered' }
      }

      // ---- complete: results are delivered on-page (no email; Kanwar
      // directive 2026-07-11 — the email address is collected for the usage
      // log only) ----
      case 'rendered': {
        await updateJob(jobId, { status: 'complete' })
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
