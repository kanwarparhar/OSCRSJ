// Shared types for the renderer-extracted metadata payload (Sushant
// Session 58, 2026-05-16). Mirrors the renderer's
// lib/renderer/extractMetadata.ts ExtractedFields shape so both sides
// type-check against the same contract.
//
// Why duplicated rather than imported: the renderer repo and OSCRSJ
// repo are independent Next.js apps with separate tsconfig.json
// files. Sharing the type lives in this file in the OSCRSJ repo;
// the renderer's source-of-truth is its own definition. Drift is
// caught at runtime by the route handler's body parsing (extra
// fields are ignored, missing fields surface as undefined / 'none'
// confidence in the editor).

import type { PatientConsentVariant } from '@/lib/types/database'

export type ExtractionConfidence = 'high' | 'amber' | 'low' | 'none'

export interface ExtractedField {
  value: string
  confidence: ExtractionConfidence
  score: number
  source: 'native_heading' | 'bold_paragraph' | 'inline_pattern' | 'none'
}

export interface AbstractSectionExtraction {
  label: string
  text: string
  score: number
  confidence: ExtractionConfidence
  source: 'native_heading' | 'bold_paragraph' | 'none'
}

export interface PatientConsentExtraction {
  statement: string
  variant_guess: PatientConsentVariant | null
  variant_confidence: ExtractionConfidence
  irb_institution: string
  irb_protocol: string
  score: number
  confidence: ExtractionConfidence
  source: 'native_heading' | 'bold_paragraph' | 'inline_pattern' | 'none'
}

export interface ExtractedFields {
  abstract_sections: AbstractSectionExtraction[]
  abstract_unstructured: ExtractedField
  conflict_of_interest: ExtractedField
  funding: ExtractedField
  irb: { statement: ExtractedField; protocol_number: string | null }
  patient_consent: PatientConsentExtraction
  acknowledgments: ExtractedField
}

export interface ExtractResponse {
  ok: boolean
  fields?: ExtractedFields
  source_file_type?: 'manuscript' | 'blinded_manuscript'
  pandoc_version?: string | null
  source?: 'docx-extract'
  extracted_at?: string
  error?: string
}
