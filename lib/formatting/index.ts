// Public surface for the Manuscript Formatting Service (Sushant, Session 87).
// Re-exports the rules schema + core types + the pipeline state machine so
// callers import from one place. Engine transforms are imported directly from
// their modules by the pipeline stages (Session B/C).

export {
  journalRulesSchema,
  SCHEMA_VERSION,
  ARTICLE_TYPES,
  TITLE_PAGE_ELEMENTS,
  DECLARATION_ELEMENTS,
} from './rulesSchema'
export type { JournalRules, ArticleType, TitlePageElement, DeclarationElement } from './rulesSchema'

export * from './types'
export {
  JOB_STATUSES,
  TERMINAL_STATUSES,
  STAGE_TRANSITIONS,
  NEXT_STATUS,
  isTerminal,
  canTransition,
} from './pipeline/stages'
export type {
  JobStatus,
  FormattingJob,
  JobError,
  JobOutputPaths,
  StageCursor,
  StageContext,
  StageResult,
  StageRunner,
  StageRegistry,
} from './pipeline/stages'

import { journalRulesSchema } from './rulesSchema'
import type { JournalRules } from './rulesSchema'

/**
 * Validate an untrusted object (parsed journal JSON) into a JournalRules.
 * Throws a ZodError if the object does not satisfy the schema. Used by the
 * build-time validator (`scripts/validate-journal-rules.ts`) and, in Session C,
 * by the runtime rules loader.
 */
export function parseJournalRules(data: unknown): JournalRules {
  return journalRulesSchema.parse(data)
}
