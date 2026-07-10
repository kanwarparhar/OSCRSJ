// DeepSeek prompts — versioned, unit-tested (Sushant, Session 87 scaffold).
//
// DOCTRINE (build brief + OSCRSJ AI Layer): every DeepSeek prompt is authored
// at BUILD time and versioned here. At run time DeepSeek executes only these
// exact prompts — nothing about pipeline behaviour is improvised. DeepSeek does
// UNDERSTANDING ONLY (section classification, metadata extraction, reference
// parsing). Temperature 0, JSON mode, with the output JSON schema embedded in
// every prompt. Every output is zod-validated; on validation failure retry once
// then flag-and-degrade — never guess. NO prompt is ever used in the emit path.
//
// Prompt bodies + golden input/output fixtures land in Session B.

export interface PromptSpec {
  /** Stable id used in logs + fixtures. */
  id: 'section_classify' | 'metadata_extract' | 'reference_parse'
  version: string
  /** System message establishing the understanding-only, JSON-out contract. */
  system: string
  /** Builds the user message for a given input payload. */
  buildUser: (input: string) => string
  /** Sampling is always deterministic for repeatability. */
  temperature: 0
  /** Enforce provider JSON mode. */
  jsonMode: true
}

const NOT_READY = (id: string) => (): string => {
  throw new Error(`prompt "${id}" body not authored — Session B`)
}

export const SECTION_CLASSIFY: PromptSpec = {
  id: 'section_classify',
  version: '0.0.0',
  system: '', // TODO(Session B)
  buildUser: NOT_READY('section_classify'),
  temperature: 0,
  jsonMode: true,
}

export const METADATA_EXTRACT: PromptSpec = {
  id: 'metadata_extract',
  version: '0.0.0',
  system: '', // TODO(Session B)
  buildUser: NOT_READY('metadata_extract'),
  temperature: 0,
  jsonMode: true,
}

export const REFERENCE_PARSE: PromptSpec = {
  id: 'reference_parse',
  version: '0.0.0',
  system: '', // TODO(Session B)
  buildUser: NOT_READY('reference_parse'),
  temperature: 0,
  jsonMode: true,
}

export const ALL_PROMPTS: PromptSpec[] = [SECTION_CLASSIFY, METADATA_EXTRACT, REFERENCE_PARSE]
