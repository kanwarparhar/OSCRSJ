'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  previewMetadataValidation,
  updateManuscriptMetadata,
} from '@/lib/admin/actions'
import type {
  ManuscriptType,
  PatientConsentVariant,
  ManuscriptStatus,
} from '@/lib/types/database'
import type {
  ManuscriptDraftOverlay,
  ValidationRow,
} from '@/lib/publish/synthesize'
import type {
  ExtractedFields,
  ExtractionConfidence,
  ExtractedField,
} from '@/lib/publish/extractedMetadata'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import AuthorCard, { type AuthorState } from './AuthorCard'
import ValidationSummary from './ValidationSummary'
import PreviewRenderCluster from './PreviewRenderCluster'

interface InitialState {
  manuscript_id: string
  status: ManuscriptStatus
  manuscript_type: ManuscriptType | null
  title: string
  running_title: string
  doi: string
  elocation_id: string
  subspecialty: string
  keywords: string[]
  abstract: string
  authors: AuthorState[]
  conflict_of_interest: string
  funding_sources: string[]
  data_availability_statement: string
  ethics_approval_number: string
  ai_tools_used: boolean | null
  ai_tools_details: string
  patient_consent_variant: PatientConsentVariant | null
  patient_consent_statement: string
  patient_consent_irb_institution: string
  patient_consent_irb_protocol: string
  acknowledgments: string
  equal_contribution_statement: string
  handling_editor: {
    display_name: string
    affiliation: string | null
  } | null
  initial_errors: ValidationRow[]
  initial_warnings: ValidationRow[]
  // Phase 1.5 (Session 58) — .docx extraction pre-fill
  extracted: ExtractedFields | null
  extract_error: string | null
  extracted_source_file_type: 'manuscript' | 'blinded_manuscript' | null
}

interface Props {
  initial: InitialState
  rendererUrl: string
}

const CONSENT_OPTIONS: Array<{
  value: PatientConsentVariant
  label: string
  defaultStatement: string
}> = [
  {
    value: 'adult_living',
    label: 'Competent adult patient',
    defaultStatement:
      'Written informed consent was obtained from the patient for publication of this case report and any accompanying images. A copy of the consent form is available on request.',
  },
  {
    value: 'pediatric_minor',
    label: 'Pediatric / minor patient',
    defaultStatement:
      'Written informed consent for publication of this case report and any accompanying images was obtained from the parent(s) or legal guardian(s) of the minor patient. Age-appropriate assent was obtained from the patient where developmentally feasible. A copy of the consent form is available on request.',
  },
  {
    value: 'deceased_next_of_kin',
    label: 'Deceased — next of kin consent',
    defaultStatement:
      "The patient described in this case report is deceased. Written informed consent for publication of this case report and any accompanying images was obtained from the patient's next of kin. A copy of the consent form is available on request.",
  },
  {
    value: 'deceased_irb_waiver',
    label: 'Deceased — IRB waiver',
    defaultStatement:
      'The patient described in this case report is deceased and next of kin could not be reached after reasonable effort. Publication of identifiable case details was authorized by the Institutional Review Board of <institution> under waiver of consent (protocol <IRB-####>).',
  },
  {
    value: 'incapacitated_irb_waiver',
    label: 'Incapacitated — IRB waiver',
    defaultStatement:
      'The patient described in this case report was unable to provide consent due to <emergent / cognitive> circumstances. Publication of identifiable case details was authorized by the Institutional Review Board of <institution> under waiver of consent (protocol <IRB-####>).',
  },
  {
    value: 'deidentified_no_consent_required',
    label: 'De-identified — consent not required',
    defaultStatement:
      'The case described in this report is fully de-identified. No recognizable patient images, dates, or distinguishing demographic details are presented. Per institutional policy and HIPAA Safe Harbor (or applicable regional equivalent), formal informed consent for publication was not required.',
  },
  {
    value: 'not_applicable',
    label: 'Not applicable',
    defaultStatement:
      'This report does not involve identifiable patient data; patient consent was not applicable.',
  },
]

const ABSTRACT_LABEL_SETS: Record<string, string[]> = {
  case_report: ['Introduction', 'Case Presentation', 'Discussion', 'Conclusion'],
  case_series: ['Background', 'Methods', 'Results', 'Discussion', 'Conclusion'],
  review_article: ['Background', 'Methods', 'Results', 'Conclusion'],
  narrative_review: ['Background', 'Scope', 'Findings', 'Conclusion'],
}

// Session 85 — type-aware affordances. The mandatory reporting
// checklist per article type (mirrors /guide-for-authors + the Step 2
// wizard required slots) surfaces as a §1 hint so the editor knows
// which checklist should exist in the Files panel.
const CHECKLIST_BY_TYPE: Record<string, string> = {
  case_report: 'CARE checklist',
  case_series: 'JBI Case Series checklist',
  review_article: 'PRISMA 2020 checklist',
  narrative_review: 'SANRA self-rating',
}

// Article types with no identifiable patients: the §4 patient-consent
// block collapses to a one-line summary for these (expandable — the
// rare narrative review that reproduces identifiable images can still
// set a real variant).
const NO_PATIENT_TYPES = new Set(['review_article', 'narrative_review', 'letter_to_editor'])

const RUNNING_TITLE_MAX = 45

// Round-trip parser: split a single TEXT abstract into labeled
// sections based on canonical anchors. Matches the synthesizer's
// parser shape. Used for both initial load (parse persisted abstract)
// and the "Paste raw abstract → Parse" assist.
function parseAbstractIntoSections(
  text: string,
  labels: string[]
): Record<string, string> {
  const result: Record<string, string> = {}
  labels.forEach((l) => (result[l] = ''))
  if (!text || !labels.length) return result

  const anchors = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const anchorRe = new RegExp(
    `(^|\\n|\\.\\s+|\\;\\s+|\\s)\\s*(${anchors.join('|')})\\s*[:\\.]\\s*`,
    'gi'
  )

  const matches: Array<{ idx: number; label: string }> = []
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(text)) !== null) {
    const matchLabel = labels.find(
      (l) => l.toLowerCase() === m![2].toLowerCase()
    )
    if (matchLabel) {
      matches.push({ idx: m.index + (m[1]?.length ?? 0), label: matchLabel })
    }
  }
  if (matches.length === 0) return result

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx
    const end = i + 1 < matches.length ? matches[i + 1].idx : text.length
    const segment = text.slice(start, end)
    const sectionText = segment
      .replace(
        new RegExp(`^\\s*${matches[i].label}\\s*[:\\.]\\s*`, 'i'),
        ''
      )
      .trim()
    result[matches[i].label] = sectionText
  }
  return result
}

function flattenAbstractSections(sections: Record<string, string>, labels: string[]): string {
  return labels
    .map((l) => {
      const t = (sections[l] || '').trim()
      return t ? `${l}: ${t}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

// ============================================================
// Phase 1.5 (Session 58) — .docx-extracted metadata pre-fill
// ============================================================
//
// PreFillDecision describes what the editor sees on first page-load
// for a single field. Mutable: the editor can click "Use .docx" /
// "Keep DB" / "Dismiss" buttons to flip decisions per field.
//
// Why we don't auto-overwrite DB values that diverge from extraction:
// the DB may carry edits the author made post-submission that aren't
// in the .docx, OR the .docx may be the fresher source (most common
// case after 1-2 revisions). We refuse to guess; the editor decides
// per field.

type PreFillDecision =
  | {
      kind: 'extracted_applied'
      confidence: ExtractionConfidence
      extractedValue: string
      dbOriginal: string
    }
  | {
      kind: 'db_kept_diverges'
      confidence: ExtractionConfidence
      extractedValue: string
      dbValue: string
    }
  | {
      kind: 'db_matches_extraction'
      confidence: ExtractionConfidence
    }
  | { kind: 'no_extraction' }
  | { kind: 'dismissed' }

function valuesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, ' ')
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // Loose match: one is contained in the other AND the shorter is at
  // least 80% of the longer. Catches "DB has summary; .docx has full
  // paragraph" cases where they're substantively the same.
  const shorter = na.length < nb.length ? na : nb
  const longer = na.length < nb.length ? nb : na
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.8) {
    return true
  }
  return false
}

function resolvePrefill(
  dbValue: string,
  extracted: ExtractedField | null | undefined
): PreFillDecision {
  if (
    !extracted ||
    extracted.confidence === 'none' ||
    extracted.confidence === 'low' ||
    !extracted.value.trim()
  ) {
    return { kind: 'no_extraction' }
  }
  const dbTrim = dbValue.trim()
  if (!dbTrim) {
    return {
      kind: 'extracted_applied',
      confidence: extracted.confidence,
      extractedValue: extracted.value,
      dbOriginal: dbValue,
    }
  }
  if (valuesMatch(dbValue, extracted.value)) {
    return { kind: 'db_matches_extraction', confidence: extracted.confidence }
  }
  return {
    kind: 'db_kept_diverges',
    confidence: extracted.confidence,
    extractedValue: extracted.value,
    dbValue,
  }
}

interface InitialDecisions {
  conflict_of_interest: PreFillDecision
  funding: PreFillDecision
  ethics_approval_number: PreFillDecision
  patient_consent_variant: PreFillDecision
  patient_consent_statement: PreFillDecision
  patient_consent_irb_institution: PreFillDecision
  patient_consent_irb_protocol: PreFillDecision
  acknowledgments: PreFillDecision
  abstract_sections: Record<string, PreFillDecision>
}

function computeInitialDecisions(
  initial: InitialState
): InitialDecisions {
  const ex = initial.extracted
  if (!ex) {
    return {
      conflict_of_interest: { kind: 'no_extraction' },
      funding: { kind: 'no_extraction' },
      ethics_approval_number: { kind: 'no_extraction' },
      patient_consent_variant: { kind: 'no_extraction' },
      patient_consent_statement: { kind: 'no_extraction' },
      patient_consent_irb_institution: { kind: 'no_extraction' },
      patient_consent_irb_protocol: { kind: 'no_extraction' },
      acknowledgments: { kind: 'no_extraction' },
      abstract_sections: {},
    }
  }

  // Wrap patient-consent sub-fields in synthetic ExtractedField shape
  // so they can flow through the same resolvePrefill helper.
  const consentStatementField: ExtractedField = {
    value: ex.patient_consent.statement,
    confidence: ex.patient_consent.confidence,
    score: ex.patient_consent.score,
    source: ex.patient_consent.source,
  }
  const consentInstitutionField: ExtractedField = {
    value: ex.patient_consent.irb_institution,
    confidence:
      ex.patient_consent.irb_institution && ex.patient_consent.confidence !== 'none'
        ? ex.patient_consent.confidence
        : 'none',
    score: ex.patient_consent.score,
    source: ex.patient_consent.source,
  }
  const consentProtocolField: ExtractedField = {
    value: ex.patient_consent.irb_protocol,
    confidence:
      ex.patient_consent.irb_protocol && ex.patient_consent.confidence !== 'none'
        ? ex.patient_consent.confidence
        : 'none',
    score: ex.patient_consent.score,
    source: ex.patient_consent.source,
  }
  const consentVariantField: ExtractedField = {
    value: ex.patient_consent.variant_guess ?? '',
    confidence: ex.patient_consent.variant_confidence,
    score: ex.patient_consent.score,
    source: ex.patient_consent.source,
  }
  const irbProtocolField: ExtractedField = {
    value: ex.irb.protocol_number ?? '',
    confidence: ex.irb.statement.confidence,
    score: ex.irb.statement.score,
    source: ex.irb.statement.source,
  }

  // Abstract — per-label decisions, only for article types with
  // structured abstracts (case_report, case_series, review_article).
  // Build the same label set the form uses (ABSTRACT_LABEL_SETS) so
  // keys round-trip cleanly.
  const abstractDecisions: Record<string, PreFillDecision> = {}
  if (initial.manuscript_type && ABSTRACT_LABEL_SETS[initial.manuscript_type]) {
    const labels = ABSTRACT_LABEL_SETS[initial.manuscript_type]
    const parsedDb = parseAbstractIntoSections(initial.abstract, labels)
    for (const label of labels) {
      const extractedSection = ex.abstract_sections.find(
        (s) =>
          s.label.toLowerCase() === label.toLowerCase() ||
          // Match "Conclusions" → "Conclusion"
          (s.label === 'Conclusions' && label === 'Conclusion')
      )
      if (!extractedSection) {
        abstractDecisions[label] = { kind: 'no_extraction' }
        continue
      }
      const dbForLabel = parsedDb[label] || ''
      abstractDecisions[label] = resolvePrefill(dbForLabel, {
        value: extractedSection.text,
        confidence: extractedSection.confidence,
        score: extractedSection.score,
        source: extractedSection.source as
          | 'native_heading'
          | 'bold_paragraph'
          | 'none',
      })
    }
  }

  return {
    conflict_of_interest: resolvePrefill(
      initial.conflict_of_interest,
      ex.conflict_of_interest
    ),
    funding: resolvePrefill(
      initial.funding_sources.join(' '),
      ex.funding
    ),
    ethics_approval_number: resolvePrefill(
      initial.ethics_approval_number,
      irbProtocolField
    ),
    patient_consent_variant: resolvePrefill(
      initial.patient_consent_variant ?? '',
      consentVariantField
    ),
    patient_consent_statement: resolvePrefill(
      initial.patient_consent_statement,
      consentStatementField
    ),
    patient_consent_irb_institution: resolvePrefill(
      initial.patient_consent_irb_institution,
      consentInstitutionField
    ),
    patient_consent_irb_protocol: resolvePrefill(
      initial.patient_consent_irb_protocol,
      consentProtocolField
    ),
    acknowledgments: resolvePrefill(
      initial.acknowledgments,
      ex.acknowledgments
    ),
    abstract_sections: abstractDecisions,
  }
}

function pickInitialString(decision: PreFillDecision, dbValue: string): string {
  return decision.kind === 'extracted_applied' ? decision.extractedValue : dbValue
}

export default function MetadataEditorForm({ initial, rendererUrl }: Props) {
  // ---- Pre-fill decisions (Phase 1.5, Session 58) ----
  // Computed once from initial props; mutable so user clicks on
  // divergence-banner action buttons can flip per-field decisions.
  const initialDecisions = useMemo(() => computeInitialDecisions(initial), [initial])
  const [decisions, setDecisions] = useState<InitialDecisions>(initialDecisions)

  // ---- State ----
  const [title, setTitle] = useState(initial.title)
  const [runningTitle, setRunningTitle] = useState(initial.running_title)
  const [keywords, setKeywords] = useState<string[]>(initial.keywords)
  const [keywordInput, setKeywordInput] = useState('')
  const [doi, setDoi] = useState(initial.doi)

  // Abstract — article-type-aware labeled sections + paste-and-parse assist
  const abstractLabels = initial.manuscript_type
    ? ABSTRACT_LABEL_SETS[initial.manuscript_type] || null
    : null

  // Session 85 — §4 consent collapse for no-patient article types.
  const consentTypicallyNA = initial.manuscript_type
    ? NO_PATIENT_TYPES.has(initial.manuscript_type)
    : false
  const [consentSectionOpen, setConsentSectionOpen] = useState(!consentTypicallyNA)
  const requiredChecklist = initial.manuscript_type
    ? CHECKLIST_BY_TYPE[initial.manuscript_type] || null
    : null
  const [abstractSections, setAbstractSections] = useState<Record<string, string>>(
    () => {
      const baseline = abstractLabels
        ? parseAbstractIntoSections(initial.abstract, abstractLabels)
        : {}
      if (!abstractLabels) return baseline
      // Apply per-label extracted_applied decisions
      const merged: Record<string, string> = { ...baseline }
      for (const label of abstractLabels) {
        const d = initialDecisions.abstract_sections[label]
        if (d?.kind === 'extracted_applied') {
          merged[label] = d.extractedValue
        }
      }
      return merged
    }
  )
  const [abstractUnstructured, setAbstractUnstructured] = useState<string>(
    () => {
      if (abstractLabels) return ''
      // No structured labels for this article type — use the raw
      // unstructured extraction if DB abstract is empty, else keep DB.
      if (
        !initial.abstract.trim() &&
        initial.extracted?.abstract_unstructured.value &&
        (initial.extracted.abstract_unstructured.confidence === 'high' ||
          initial.extracted.abstract_unstructured.confidence === 'amber')
      ) {
        return initial.extracted.abstract_unstructured.value
      }
      return initial.abstract
    }
  )
  const [abstractPaste, setAbstractPaste] = useState('')

  const [authors, setAuthors] = useState<AuthorState[]>(initial.authors)
  const [conflictOfInterest, setConflictOfInterest] = useState(
    pickInitialString(initialDecisions.conflict_of_interest, initial.conflict_of_interest)
  )
  const [fundingSources, setFundingSources] = useState<string[]>(initial.funding_sources)
  const [noFunding, setNoFunding] = useState(initial.funding_sources.length === 0)
  const [dataAvailability, setDataAvailability] = useState(initial.data_availability_statement)
  const [ethicsApprovalNumber, setEthicsApprovalNumber] = useState(
    pickInitialString(initialDecisions.ethics_approval_number, initial.ethics_approval_number)
  )
  const [aiUsed, setAiUsed] = useState<boolean | null>(initial.ai_tools_used)
  const [aiDetails, setAiDetails] = useState(initial.ai_tools_details)
  const [consentVariant, setConsentVariant] = useState<PatientConsentVariant | null>(
    () => {
      const d = initialDecisions.patient_consent_variant
      if (d.kind === 'extracted_applied' && d.extractedValue) {
        return d.extractedValue as PatientConsentVariant
      }
      return initial.patient_consent_variant
    }
  )
  const [consentStatement, setConsentStatement] = useState(
    pickInitialString(initialDecisions.patient_consent_statement, initial.patient_consent_statement)
  )
  const [irbInstitution, setIrbInstitution] = useState(
    pickInitialString(initialDecisions.patient_consent_irb_institution, initial.patient_consent_irb_institution)
  )
  const [irbProtocol, setIrbProtocol] = useState(
    pickInitialString(initialDecisions.patient_consent_irb_protocol, initial.patient_consent_irb_protocol)
  )
  const [acknowledgments, setAcknowledgments] = useState(
    pickInitialString(initialDecisions.acknowledgments, initial.acknowledgments)
  )
  const [equalContribStatement, setEqualContribStatement] = useState(initial.equal_contribution_statement)

  // Mark dirty immediately if any decision auto-applied an extracted
  // value — the editor's first save should persist those pre-fills
  // back to the DB so subsequent loads start from a clean "no
  // pre-fill needed" state (the DB value matches the .docx after
  // save, so resolvePrefill returns 'db_matches_extraction' next time).
  const hasAutoApplied = useMemo(() => {
    if (initialDecisions.conflict_of_interest.kind === 'extracted_applied') return true
    if (initialDecisions.ethics_approval_number.kind === 'extracted_applied') return true
    if (initialDecisions.patient_consent_statement.kind === 'extracted_applied') return true
    if (initialDecisions.patient_consent_variant.kind === 'extracted_applied') return true
    if (initialDecisions.patient_consent_irb_institution.kind === 'extracted_applied') return true
    if (initialDecisions.patient_consent_irb_protocol.kind === 'extracted_applied') return true
    if (initialDecisions.acknowledgments.kind === 'extracted_applied') return true
    for (const label of Object.keys(initialDecisions.abstract_sections)) {
      if (initialDecisions.abstract_sections[label].kind === 'extracted_applied') return true
    }
    return false
  }, [initialDecisions])

  const [isDirty, setIsDirty] = useState(hasAutoApplied)
  const [errors, setErrors] = useState<ValidationRow[]>(initial.initial_errors)
  const [warnings, setWarnings] = useState<ValidationRow[]>(initial.initial_warnings)
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const [validationPending, startValidation] = useTransition()
  const [savePending, startSave] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveInfo, setSaveInfo] = useState<string | null>(null)

  const validationAbortRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialMountRef = useRef(true)

  // Phase 1.B+ collapsibles (Kanwar UX ask, 2026-05-16). All sections
  // default to expanded; chevron toggles per-session state. Franklin
  // recommended against accordions originally (decision #3 in his
  // UX pass — "all sections expanded, no accordions"); Kanwar
  // overrode after first-touch. Default-expanded preserves Franklin's
  // intent for editors who don't collapse anything.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  function toggleSection(id: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---- Helpers ----

  function markDirty() {
    if (!isDirty) setIsDirty(true)
  }

  function buildAbstractTextForValidation(): string {
    if (abstractLabels) {
      return flattenAbstractSections(abstractSections, abstractLabels)
    }
    return abstractUnstructured
  }

  function buildDraftPatch(): ManuscriptDraftOverlay {
    return {
      title,
      running_title: runningTitle,
      doi,
      keywords,
      abstract: buildAbstractTextForValidation(),
      authors: authors.map((a, idx) => ({
        id: a.id,
        full_name: a.full_name,
        degrees: a.degrees,
        email: a.email,
        affiliation: a.affiliation,
        orcid_id: a.orcid_id,
        contribution: a.contribution,
        is_corresponding: a.is_corresponding,
        is_equal_contribution: a.is_equal_contribution,
        author_order: idx + 1,
      })),
      conflict_of_interest: conflictOfInterest,
      funding_sources: noFunding ? [] : fundingSources,
      data_availability_statement: dataAvailability,
      ethics_approval_number: ethicsApprovalNumber,
      ai_tools_used: aiUsed,
      ai_tools_details: aiDetails,
      patient_consent_variant: consentVariant,
      patient_consent_statement: consentStatement,
      patient_consent_irb_institution: irbInstitution,
      patient_consent_irb_protocol: irbProtocol,
      acknowledgments,
      equal_contribution_statement: equalContribStatement,
    }
  }

  // ---- Live validation (500ms debounced) ----

  const runValidation = useCallback(() => {
    // Cancel any in-flight validation per Risk #3 mitigation
    if (validationAbortRef.current) {
      validationAbortRef.current.abort()
    }
    const controller = new AbortController()
    validationAbortRef.current = controller

    const draft = buildDraftPatch()
    startValidation(async () => {
      const result = await previewMetadataValidation(initial.manuscript_id, draft)
      if (controller.signal.aborted) return
      if (result.ok) {
        setErrors(result.errors || [])
        setWarnings(result.warnings || [])
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    runningTitle,
    doi,
    keywords,
    abstractSections,
    abstractUnstructured,
    authors,
    conflictOfInterest,
    fundingSources,
    noFunding,
    dataAvailability,
    ethicsApprovalNumber,
    aiUsed,
    aiDetails,
    consentVariant,
    consentStatement,
    irbInstitution,
    irbProtocol,
    acknowledgments,
    equalContribStatement,
  ])

  useEffect(() => {
    // Skip the validation kickoff on initial mount — we already
    // have initial.initial_errors + initial_warnings from the
    // server render. Only re-run when something changes.
    if (initialMountRef.current) {
      initialMountRef.current = false
      return
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      runValidation()
    }, 500)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [runValidation])

  // ---- Author handlers ----

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = authors.findIndex((a) => a.id === active.id)
    const newIndex = authors.findIndex((a) => a.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setAuthors((prev) => arrayMove(prev, oldIndex, newIndex))
    markDirty()
  }

  function updateAuthor(id: string, patch: Partial<AuthorState>) {
    setAuthors((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
    markDirty()
  }

  function removeAuthor(id: string) {
    setAuthors((prev) => prev.filter((a) => a.id !== id))
    markDirty()
  }

  function setCorresponding(id: string) {
    setAuthors((prev) =>
      prev.map((a) => ({ ...a, is_corresponding: a.id === id }))
    )
    markDirty()
  }

  function addAuthor() {
    const newId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setAuthors((prev) => [
      ...prev,
      {
        id: newId,
        full_name: '',
        degrees: '',
        email: '',
        affiliation: '',
        orcid_id: '',
        contribution: '',
        is_corresponding: false,
        is_equal_contribution: false,
      },
    ])
    markDirty()
  }

  // ---- Keyword handlers ----

  function addKeyword(raw: string) {
    const k = raw.trim()
    if (!k) return
    if (keywords.includes(k)) return
    setKeywords((prev) => [...prev, k])
    setKeywordInput('')
    markDirty()
  }

  function removeKeyword(k: string) {
    setKeywords((prev) => prev.filter((x) => x !== k))
    markDirty()
  }

  // ---- Funding handlers ----

  function addFundingSource(raw: string) {
    const f = raw.trim()
    if (!f) return
    setFundingSources((prev) => [...prev, f])
    markDirty()
  }

  function removeFundingSource(idx: number) {
    setFundingSources((prev) => prev.filter((_, i) => i !== idx))
    markDirty()
  }

  // ---- Abstract paste-and-parse ----

  function parsePastedAbstract() {
    if (!abstractLabels) {
      setAbstractUnstructured(abstractPaste)
      setAbstractPaste('')
      markDirty()
      return
    }
    const parsed = parseAbstractIntoSections(abstractPaste, abstractLabels)
    setAbstractSections(parsed)
    setAbstractPaste('')
    markDirty()
  }

  // ---- Consent variant change ----

  function changeConsentVariant(variant: PatientConsentVariant) {
    setConsentVariant(variant)
    const option = CONSENT_OPTIONS.find((o) => o.value === variant)
    if (option) {
      // Pre-fill the statement with the verbatim default; editor may
      // free-edit afterward. Only overwrite when statement is empty
      // OR equals a prior verbatim default (treat as "still untouched").
      const priorDefaults = CONSENT_OPTIONS.map((o) => o.defaultStatement)
      const isUntouched = !consentStatement.trim() || priorDefaults.includes(consentStatement.trim())
      if (isUntouched) {
        setConsentStatement(option.defaultStatement)
      }
    }
    markDirty()
  }

  // ---- Equal-contribution default statement ----

  const equalAuthors = authors.filter((a) => a.is_equal_contribution)
  useEffect(() => {
    if (equalAuthors.length >= 2 && !equalContribStatement.trim()) {
      const names = equalAuthors.map((a) => a.full_name || '(unnamed)')
      let defaultStmt = ''
      if (names.length === 2) {
        defaultStmt = `${names[0]} and ${names[1]} contributed equally to this work and share first authorship.`
      } else {
        const last = names[names.length - 1]
        const rest = names.slice(0, -1).join(', ')
        defaultStmt = `${rest}, and ${last} contributed equally to this work and share first authorship.`
      }
      setEqualContribStatement(defaultStmt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equalAuthors.length])

  // ---- Save ----

  function handleSave() {
    setSaveError(null)
    setSaveInfo(null)
    startSave(async () => {
      const result = await updateManuscriptMetadata(initial.manuscript_id, {
        title,
        running_title: runningTitle,
        doi,
        keywords,
        abstract: buildAbstractTextForValidation(),
        conflict_of_interest: conflictOfInterest,
        funding_sources: noFunding ? [] : fundingSources,
        data_availability_statement: dataAvailability,
        ethics_approval_number: ethicsApprovalNumber,
        ai_tools_used: aiUsed,
        ai_tools_details: aiDetails,
        patient_consent_variant: consentVariant,
        patient_consent_statement: consentStatement,
        patient_consent_irb_institution: irbInstitution,
        patient_consent_irb_protocol: irbProtocol,
        acknowledgments,
        equal_contribution_statement: equalContribStatement,
        authors_full: authors.map((a, idx) => ({
          id: a.id.startsWith('new-') ? null : a.id,
          full_name: a.full_name,
          degrees: a.degrees,
          email: a.email,
          affiliation: a.affiliation,
          orcid_id: a.orcid_id,
          contribution: a.contribution,
          is_corresponding: a.is_corresponding,
          is_equal_contribution: a.is_equal_contribution,
          author_order: idx + 1,
        })),
      })
      if (result.error || !result.ok) {
        setSaveError(result.error || 'Save failed.')
        return
      }
      setSaveInfo(`Saved. Fields changed: ${(result.fieldsChanged || []).join(', ') || 'none'}.`)
      setIsDirty(false)
    })
  }

  // ---- Render / preview gating ----

  const allWarningsAcknowledged =
    warnings.length === 0 || warnings.every((w) => acknowledged.has(w.rule))

  const previewDisabled = errors.length > 0 || isDirty || savePending
  const previewDisabledReason = isDirty
    ? 'Save changes before previewing.'
    : errors.length > 0
      ? `Resolve ${errors.length} error${errors.length === 1 ? '' : 's'} first.`
      : null

  const renderDisabled =
    errors.length > 0 || !allWarningsAcknowledged || isDirty || savePending
  const renderDisabledReason = isDirty
    ? 'Save changes before rendering.'
    : errors.length > 0
      ? `Resolve ${errors.length} error${errors.length === 1 ? '' : 's'} first.`
      : !allWarningsAcknowledged
        ? `Acknowledge all ${warnings.length} warnings first.`
        : null

  // Phase 1.5 auto-expand-on-jump (Session 80). CollapsibleSection unmounts
  // children when collapsed, so a collapsed section's fields aren't in the
  // DOM and ValidationSummary's local querySelector jump silently no-ops.
  // A parent-walk (the original §11 sketch) can't work on an unmounted node;
  // and a field→section map would drift as validators evolve. So: if the
  // target isn't mounted, expand ALL sections (predictable, cheap — the
  // scroll still centers the exact field) and retry after React re-renders.
  function jumpToField(targetField: string) {
    const locate = () =>
      document.querySelector(`[data-target="${targetField}"]`) as HTMLElement | null
    const scrollAndFlash = (el: HTMLElement) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2')
      }, 1500)
      if (typeof (el as HTMLInputElement).focus === 'function') {
        try {
          ;(el as HTMLInputElement).focus({ preventScroll: true })
        } catch {
          // no-op
        }
      }
    }
    const el = locate()
    if (el) {
      scrollAndFlash(el)
      return
    }
    setCollapsedSections(new Set())
    // Double rAF: first frame commits the expanded sections, second frame
    // guarantees layout is settled before we measure for the scroll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const retry = locate()
        if (retry) scrollAndFlash(retry)
      })
    })
  }

  function onRenderPublish() {
    if (!rendererUrl) {
      setSaveError('NEXT_PUBLIC_RENDERER_URL is not configured.')
      return
    }
    window.open(rendererUrl, '_blank', 'noopener,noreferrer')
  }

  // ---- Pre-fill decision flips (Phase 1.5) ----

  function dismissDecision(key: keyof Omit<InitialDecisions, 'abstract_sections'>) {
    setDecisions((prev) => ({ ...prev, [key]: { kind: 'dismissed' } }))
  }
  function dismissAbstractDecision(label: string) {
    setDecisions((prev) => ({
      ...prev,
      abstract_sections: { ...prev.abstract_sections, [label]: { kind: 'dismissed' } },
    }))
  }

  function useDocxFor(
    key: keyof Omit<InitialDecisions, 'abstract_sections'>,
    apply: (value: string) => void
  ) {
    const d = decisions[key]
    if (d.kind !== 'db_kept_diverges') return
    apply(d.extractedValue)
    setDecisions((prev) => ({
      ...prev,
      [key]: {
        kind: 'extracted_applied',
        confidence: d.confidence,
        extractedValue: d.extractedValue,
        dbOriginal: d.dbValue,
      },
    }))
    markDirty()
  }

  function useDocxForAbstract(label: string) {
    const d = decisions.abstract_sections[label]
    if (d?.kind !== 'db_kept_diverges') return
    setAbstractSections((prev) => ({ ...prev, [label]: d.extractedValue }))
    setDecisions((prev) => ({
      ...prev,
      abstract_sections: {
        ...prev.abstract_sections,
        [label]: {
          kind: 'extracted_applied',
          confidence: d.confidence,
          extractedValue: d.extractedValue,
          dbOriginal: d.dbValue,
        },
      },
    }))
    markDirty()
  }

  function keepDbFor(key: keyof Omit<InitialDecisions, 'abstract_sections'>) {
    const d = decisions[key]
    if (d.kind !== 'db_kept_diverges') return
    setDecisions((prev) => ({ ...prev, [key]: { kind: 'dismissed' } }))
  }

  function keepDbForAbstract(label: string) {
    setDecisions((prev) => ({
      ...prev,
      abstract_sections: { ...prev.abstract_sections, [label]: { kind: 'dismissed' } },
    }))
  }

  // Renders the small "Pre-filled from .docx" chip next to a field
  // label, with a × dismiss button. Returns null when decision is
  // 'no_extraction' / 'dismissed' / 'db_matches_extraction'.
  function PreFillChip({
    decision,
    onDismiss,
  }: {
    decision: PreFillDecision
    onDismiss: () => void
  }) {
    if (decision.kind !== 'extracted_applied') return null
    const label =
      decision.confidence === 'high'
        ? 'Pre-filled from .docx (HIGH)'
        : 'Pre-filled — verify (AMBER)'
    const tone =
      decision.confidence === 'high'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : 'bg-amber-50 text-amber-800 border-amber-200'
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${tone} ml-2`}
      >
        {label}
        <button
          type="button"
          onClick={onDismiss}
          className="text-current/70 hover:text-current ml-0.5"
          aria-label="Dismiss pre-fill chip"
          title="Dismiss this chip — value stays as-is"
        >
          ×
        </button>
      </span>
    )
  }

  // Renders an inline yellow banner when DB value diverges from
  // extracted; two action buttons let editor pick which to keep.
  function DivergenceBanner({
    decision,
    onUseDocx,
    onKeepDb,
  }: {
    decision: PreFillDecision
    onUseDocx: () => void
    onKeepDb: () => void
  }) {
    if (decision.kind !== 'db_kept_diverges') return null
    return (
      <div className="mt-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 text-xs">
        <p className="text-amber-900 mb-1.5">
          <span className="font-semibold">DB value differs from .docx-extracted value</span>
          {' '}({decision.confidence === 'high' ? 'HIGH' : 'AMBER'} confidence).
          The DB value is shown above; the .docx version is:
        </p>
        <p className="text-ink bg-white border border-amber-100 rounded px-2 py-1.5 mb-2 whitespace-pre-wrap font-mono text-[11px] leading-snug max-h-32 overflow-y-auto">
          {decision.extractedValue.length > 600
            ? decision.extractedValue.slice(0, 600) + '…'
            : decision.extractedValue}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onUseDocx}
            className="btn-ghost text-[11px] border border-amber-300 hover:bg-amber-100"
          >
            Use .docx version
          </button>
          <button
            type="button"
            onClick={onKeepDb}
            className="btn-ghost text-[11px]"
          >
            Keep DB version
          </button>
        </div>
      </div>
    )
  }

  // ---- Render ----

  return (
    <div className="space-y-6" data-target="metadata-editor-form">
      {/* Phase 1.5 (Session 58) — .docx extraction status notice */}
      {initial.extract_error ? (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 text-xs text-amber-900">
          <p className="font-semibold mb-0.5">
            ⚠ Could not pre-fill from .docx — extraction unavailable
          </p>
          <p className="text-amber-800">{initial.extract_error}</p>
          <p className="text-amber-800 mt-1">
            Form is pre-filled from the DB only. Edit fields manually to match the
            accepted .docx before render.
          </p>
        </div>
      ) : initial.extracted ? (
        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 text-xs text-emerald-900">
          <p className="font-medium">
            ✓ Pre-filled from accepted{' '}
            <code className="text-[11px] bg-white border border-emerald-100 px-1 py-0.5 rounded">
              {initial.extracted_source_file_type ?? 'manuscript'}.docx
            </code>{' '}
            via Pandoc + heuristic anchor parser
          </p>
          <p className="text-emerald-800 mt-1 italic">
            HIGH-confidence pre-fills auto-applied; AMBER pre-fills surface with
            &quot;verify&quot; chip; divergent DB values show a banner with
            [Use .docx] / [Keep DB] choice. LOW-confidence extractions left blank.
          </p>
        </div>
      ) : null}

      {/* Sticky desktop chip */}
      <div className="validation-summary-chip">
        <span className="text-red-700">🚨 {errors.length}</span>
        <span className="text-amber-700">⚠️ {warnings.length}</span>
        {errors.length === 0 && warnings.length === 0 && (
          <span className="text-green-700">✅</span>
        )}
        <button
          type="button"
          onClick={() => {
            document
              .querySelector('[data-target="validation-summary"]')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
          className="text-xs text-brown-dark underline ml-1"
        >
          Jump ↓
        </button>
      </div>

      {/* §1 Article Identity */}
      <CollapsibleSection
        id="article-identity"
        label="§1 — Article Identity"
        collapsed={collapsedSections.has('article-identity')}
        onToggle={() => toggleSection('article-identity')}
      >
        <div className="editor-field-row">
          <label className="editor-field-label">Title</label>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                markDirty()
              }}
              data-target="title"
              className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            />
            <p className="editor-field-hint">
              {title.length} characters. No length limit (template wraps).
            </p>
          </div>
        </div>

        <div className="editor-field-row">
          <label className="editor-field-label">Running title</label>
          <div>
            <input
              type="text"
              value={runningTitle}
              onChange={(e) => {
                setRunningTitle(e.target.value)
                markDirty()
              }}
              data-target="running_title"
              className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            />
            <p className={`editor-field-counter ${runningTitle.length > RUNNING_TITLE_MAX ? 'error' : runningTitle.length > RUNNING_TITLE_MAX * 0.9 ? 'warn' : ''}`}>
              {runningTitle.length} / {RUNNING_TITLE_MAX} characters · Used in @top-center running header.
            </p>
          </div>
        </div>

        <div className="editor-field-row">
          <label className="editor-field-label">Article type</label>
          <div>
            <input
              type="text"
              value={initial.manuscript_type || '—'}
              disabled
              className="bg-cream-alt border border-border rounded-lg px-3 py-2 text-sm text-brown w-full"
              title="Article type is locked post-acceptance. Contact Sushant to change."
            />
            <p className="editor-field-hint">
              Locked post-acceptance. Contact Sushant to change.
              {requiredChecklist &&
                ` Required reporting checklist for this type: ${requiredChecklist} (should appear in the Files panel).`}
            </p>
          </div>
        </div>

        <div className="editor-field-row">
          <label className="editor-field-label">Subspecialty</label>
          <div>
            <input
              type="text"
              value={initial.subspecialty}
              disabled
              className="bg-cream-alt border border-border rounded-lg px-3 py-2 text-sm text-brown w-full"
            />
          </div>
        </div>

        <div className="editor-field-row">
          <label className="editor-field-label">Keywords (3–5 required)</label>
          <div data-target="keywords">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 bg-peach-dark/30 text-brown-dark text-xs font-medium px-2.5 py-1 rounded-full border border-peach-dark/40"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() => removeKeyword(k)}
                    className="text-brown hover:text-red-700 ml-1"
                    aria-label={`Remove ${k}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addKeyword(keywordInput)
                }
              }}
              placeholder="Add keyword + Enter"
              className="bg-white border border-dashed border-brown/30 rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            />
            <p className="editor-field-hint">
              {keywords.length} of 3–5 keywords · Renderer sanity test requires 3–5.
            </p>
          </div>
        </div>

        <div className="editor-field-row">
          <label className="editor-field-label">DOI</label>
          <div>
            <input
              type="text"
              value={doi}
              disabled
              className="bg-cream-alt border border-border rounded-lg px-3 py-2 text-sm text-brown w-full font-mono"
            />
            <p className="editor-field-hint">
              Auto-generated. Format: 10.XXXXX/oscrsj.{'{year}'}.{'{elocation}'} until Crossref membership lands.
            </p>
          </div>
        </div>

        <div className="editor-field-row">
          <label className="editor-field-label">Elocation ID</label>
          <div>
            <input
              type="text"
              value={initial.elocation_id}
              disabled
              className="bg-cream-alt border border-border rounded-lg px-3 py-2 text-sm text-brown w-full font-mono"
            />
            <p className="editor-field-hint">Auto-incremented per issue. Format: e####.</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* §2 Abstract */}
      <CollapsibleSection
        id="abstract"
        label="§2 — Abstract"
        collapsed={collapsedSections.has('abstract')}
        onToggle={() => toggleSection('abstract')}
      >
        {abstractLabels ? (
          <>
            <div className="editor-suggested-default">
              <p className="text-xs text-brown mb-2 font-medium">
                Paste raw abstract (assist)
              </p>
              <textarea
                value={abstractPaste}
                onChange={(e) => setAbstractPaste(e.target.value)}
                rows={3}
                className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
                placeholder="Paste the abstract from the manuscript .docx here, then click Parse →"
              />
              <button
                type="button"
                onClick={parsePastedAbstract}
                disabled={!abstractPaste.trim()}
                className="btn-ghost mt-2 disabled:opacity-40"
              >
                Parse →
              </button>
            </div>
            <div className="border-t border-border pt-3 space-y-4" data-target="abstract">
              {abstractLabels.map((label) => {
                const sectionDecision =
                  decisions.abstract_sections[label] ?? { kind: 'no_extraction' as const }
                return (
                  <div key={label}>
                    <label className="abstract-field-label">
                      {label}:
                      <PreFillChip
                        decision={sectionDecision}
                        onDismiss={() => dismissAbstractDecision(label)}
                      />
                    </label>
                    <textarea
                      value={abstractSections[label] || ''}
                      onChange={(e) => {
                        setAbstractSections((prev) => ({ ...prev, [label]: e.target.value }))
                        markDirty()
                      }}
                      rows={4}
                      className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark min-h-[100px] resize-vertical"
                    />
                    <p className="editor-field-hint">
                      {(abstractSections[label] || '').length} characters · Recommended 50–500.
                    </p>
                    <DivergenceBanner
                      decision={sectionDecision}
                      onUseDocx={() => useDocxForAbstract(label)}
                      onKeepDb={() => keepDbForAbstract(label)}
                    />
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div data-target="abstract">
            <label className="editor-field-label">Abstract</label>
            <textarea
              value={abstractUnstructured}
              onChange={(e) => {
                setAbstractUnstructured(e.target.value)
                markDirty()
              }}
              rows={6}
              className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            />
          </div>
        )}
      </CollapsibleSection>

      {/* §3 Authors */}
      <CollapsibleSection
        id="authors"
        label={`§3 — Authors (${authors.length})`}
        subtitle="Drag the handle on the left to reorder. Exactly one must be flagged corresponding. Tick &quot;Equal contribution&quot; on ≥2 authors to surface the shared-first-authorship statement."
        collapsed={collapsedSections.has('authors')}
        onToggle={() => toggleSection('authors')}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={authors.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            {authors.map((a, idx) => (
              <AuthorCard
                key={a.id}
                author={a}
                index={idx}
                totalAuthors={authors.length}
                onChange={(patch) => updateAuthor(a.id, patch)}
                onRemove={() => removeAuthor(a.id)}
                onSetCorresponding={() => setCorresponding(a.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={addAuthor}
          className="btn-ghost text-xs"
        >
          + Add author
        </button>

        {equalAuthors.length >= 2 && (
          <div className="equal-contribution-statement-block">
            <label className="editor-field-label">
              Equal contribution statement
            </label>
            <textarea
              value={equalContribStatement}
              onChange={(e) => {
                setEqualContribStatement(e.target.value)
                markDirty()
              }}
              rows={2}
              data-target="equal_contribution_statement"
              className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            />
            <p className="editor-field-hint">
              Pre-filled from selected authors; editable. Persists to manuscript_metadata.equal_contribution_statement.
            </p>
          </div>
        )}

        <div className="handling-editor-display">
          <p className="text-[11px] uppercase tracking-widest text-brown mb-1 font-medium">
            Handling editor
          </p>
          {initial.handling_editor ? (
            <p className="text-ink text-sm">
              <span className="font-medium">{initial.handling_editor.display_name}</span>
              {initial.handling_editor.affiliation
                ? ` · ${initial.handling_editor.affiliation}`
                : ''}
            </p>
          ) : (
            <p className="text-brown italic text-sm">
              Not resolved — no editorial_decisions row found for this manuscript.
            </p>
          )}
          <p className="text-xs text-brown italic mt-1">
            Derived from latest editorial_decisions.editor_id → users join. Renders as JATS{' '}
            <code className="text-xs bg-white px-1 py-0.5 rounded border border-border">
              &lt;contrib contrib-type=&quot;editor&quot;&gt;
            </code>{' '}
            per Janine §7.2.f. Override dropdown lands in a follow-up.
          </p>
        </div>
      </CollapsibleSection>

      {/* §4 Declarations */}
      <CollapsibleSection
        id="declarations"
        label="§4 — Declarations"
        collapsed={collapsedSections.has('declarations')}
        onToggle={() => toggleSection('declarations')}
      >

        {/* Funding */}
        <div>
          <label className="editor-field-label">Funding</label>
          {decisions.funding.kind === 'db_kept_diverges' ||
          (decisions.funding.kind === 'extracted_applied' && fundingSources.length === 0) ? (
            <div className="mb-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 text-xs">
              <p className="text-amber-900 mb-1">
                <span className="font-semibold">.docx contains a funding statement</span>{' '}
                ({decisions.funding.confidence === 'high' ? 'HIGH' : 'AMBER'} confidence).
                Auto-splitting into individual sources is unreliable — the editor must
                copy + format manually per the <code className="bg-white px-1 py-0.5 rounded border border-amber-100">Funder Name (Grant ID)</code> convention below.
              </p>
              <p className="text-ink bg-white border border-amber-100 rounded px-2 py-1.5 mb-2 whitespace-pre-wrap font-mono text-[11px] leading-snug max-h-32 overflow-y-auto">
                {decisions.funding.kind === 'db_kept_diverges' ||
                decisions.funding.kind === 'extracted_applied'
                  ? (decisions.funding.kind === 'extracted_applied'
                      ? decisions.funding.extractedValue
                      : decisions.funding.extractedValue
                    ).slice(0, 600)
                  : ''}
              </p>
              <button
                type="button"
                onClick={() => dismissDecision('funding')}
                className="btn-ghost text-[11px]"
              >
                Dismiss
              </button>
            </div>
          ) : null}
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={noFunding}
              onChange={(e) => {
                setNoFunding(e.target.checked)
                markDirty()
              }}
              className="accent-peach-dark"
            />
            <span>No external funding was received for this work.</span>
          </label>
          {!noFunding && (
            <div className="space-y-2">
              {fundingSources.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-sm text-ink flex-1 bg-cream-alt/40 border border-border rounded px-3 py-1.5">
                    {f}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFundingSource(idx)}
                    className="text-xs text-red-700 hover:bg-red-50 rounded px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <FundingAddInput onAdd={addFundingSource} />
              <p className="editor-field-hint">
                If NIH/Wellcome/CIHR funding: format each entry as{' '}
                <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">Funder Name (Grant ID)</code>.
                Example: National Institutes of Health (R01-AR000000).
              </p>
            </div>
          )}
        </div>

        {/* Conflicts of interest */}
        <div className="pt-3 border-t border-border">
          <label className="editor-field-label">
            Conflict of interest
            <PreFillChip
              decision={decisions.conflict_of_interest}
              onDismiss={() => dismissDecision('conflict_of_interest')}
            />
          </label>
          <textarea
            value={conflictOfInterest}
            onChange={(e) => {
              setConflictOfInterest(e.target.value)
              markDirty()
            }}
            rows={3}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
          />
          <p className="editor-field-hint">
            ICMJE format — disclose all financial + non-financial competing interests in the past 36 months, or state none.
          </p>
          <DivergenceBanner
            decision={decisions.conflict_of_interest}
            onUseDocx={() => useDocxFor('conflict_of_interest', setConflictOfInterest)}
            onKeepDb={() => keepDbFor('conflict_of_interest')}
          />
        </div>

        {/* IRB / Ethics */}
        <div className="pt-3 border-t border-border">
          <label className="editor-field-label">
            IRB / Ethics approval number
            <PreFillChip
              decision={decisions.ethics_approval_number}
              onDismiss={() => dismissDecision('ethics_approval_number')}
            />
          </label>
          <input
            type="text"
            value={ethicsApprovalNumber}
            onChange={(e) => {
              setEthicsApprovalNumber(e.target.value)
              markDirty()
            }}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            placeholder="e.g., IRB-2024-1184 (leave blank if exempt / not required)"
          />
          <DivergenceBanner
            decision={decisions.ethics_approval_number}
            onUseDocx={() => useDocxFor('ethics_approval_number', setEthicsApprovalNumber)}
            onKeepDb={() => keepDbFor('ethics_approval_number')}
          />
        </div>

        {/* Data availability */}
        <div className="pt-3 border-t border-border">
          <label className="editor-field-label">Data availability</label>
          <div className="editor-suggested-default">
            <p className="text-xs text-brown mb-1">Suggested default:</p>
            <p className="text-sm text-ink italic">
              &quot;All data relevant to this case report are presented in the manuscript. De-identified imaging studies are available from the corresponding author upon reasonable request.&quot;
            </p>
            <button
              type="button"
              onClick={() => {
                setDataAvailability(
                  'All data relevant to this case report are presented in the manuscript. De-identified imaging studies are available from the corresponding author upon reasonable request.'
                )
                markDirty()
              }}
              className="btn-ghost text-xs mt-2"
            >
              Use this →
            </button>
          </div>
          <textarea
            value={dataAvailability}
            onChange={(e) => {
              setDataAvailability(e.target.value)
              markDirty()
            }}
            rows={3}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
          />
        </div>

        {/* AI disclosure */}
        <div className="pt-3 border-t border-border" data-target="ai_disclosure">
          <label className="editor-field-label">
            AI disclosure (ICMJE 2024 — required for post-2024 subs)
          </label>
          <div className="flex flex-wrap gap-4 mb-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="ai-used"
                checked={aiUsed === false}
                onChange={() => {
                  setAiUsed(false)
                  markDirty()
                }}
                className="accent-peach-dark"
              />
              <span className="text-sm">No AI/LLM tools were used</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="ai-used"
                checked={aiUsed === true}
                onChange={() => {
                  setAiUsed(true)
                  markDirty()
                }}
                className="accent-peach-dark"
              />
              <span className="text-sm">Yes — disclose tools</span>
            </label>
          </div>
          {aiUsed === true && (
            <div className="conditional-reveal-block">
              <label className="editor-field-label">Tools used + description</label>
              <textarea
                value={aiDetails}
                onChange={(e) => {
                  setAiDetails(e.target.value)
                  markDirty()
                }}
                rows={3}
                className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
                placeholder="e.g., ChatGPT-4 used to draft initial abstract; Grammarly used for grammar polish on revised manuscript."
              />
            </div>
          )}
        </div>

        {/* Patient consent. For no-patient article types (SR/MA,
            narrative review, letter) the block collapses to a summary
            line — Session 85 type-aware affordance. */}
        {!consentSectionOpen ? (
          <div className="pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setConsentSectionOpen(true)}
              data-target="patient_consent_variant"
              className="text-left w-full group"
            >
              <span className="editor-field-label">Patient consent</span>
              <p className="text-sm text-brown mt-1">
                {consentVariant
                  ? `${CONSENT_OPTIONS.find((o) => o.value === consentVariant)?.label || consentVariant} — typically the right answer for this article type.`
                  : 'Not set — typically "Not applicable" for this article type.'}{' '}
                <span className="text-xs underline underline-offset-2 group-hover:text-brown-dark">
                  Expand to review or change
                </span>
              </p>
            </button>
          </div>
        ) : (
        <div className="pt-3 border-t border-border">
          <label className="editor-field-label">
            Patient consent variant (Janine §3, 7 locked options)
          </label>
          <select
            value={consentVariant || ''}
            onChange={(e) => {
              if (e.target.value) changeConsentVariant(e.target.value as PatientConsentVariant)
            }}
            data-target="patient_consent_variant"
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
          >
            <option value="">— Select a variant —</option>
            {CONSENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {consentVariant && (
            <div className="mt-3">
              <label className="editor-field-label">
                Statement
                <PreFillChip
                  decision={decisions.patient_consent_statement}
                  onDismiss={() => dismissDecision('patient_consent_statement')}
                />
              </label>
              <textarea
                value={consentStatement}
                onChange={(e) => {
                  setConsentStatement(e.target.value)
                  markDirty()
                }}
                rows={4}
                data-target="patient_consent_statement"
                className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
              />
              <p className="editor-field-hint">
                Pre-filled verbatim from Janine §3 on variant selection; editor may free-edit. Persists to manuscript_metadata.patient_consent_statement.
              </p>
              <DivergenceBanner
                decision={decisions.patient_consent_statement}
                onUseDocx={() => useDocxFor('patient_consent_statement', setConsentStatement)}
                onKeepDb={() => keepDbFor('patient_consent_statement')}
              />
            </div>
          )}

          {(consentVariant === 'deceased_irb_waiver' ||
            consentVariant === 'incapacitated_irb_waiver') && (
            <div className="conditional-reveal-block" data-target="patient_consent_irb">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="editor-field-label">
                    IRB institution
                    <PreFillChip
                      decision={decisions.patient_consent_irb_institution}
                      onDismiss={() => dismissDecision('patient_consent_irb_institution')}
                    />
                  </label>
                  <input
                    type="text"
                    value={irbInstitution}
                    onChange={(e) => {
                      setIrbInstitution(e.target.value)
                      markDirty()
                    }}
                    className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
                    placeholder="e.g., University of Pittsburgh"
                  />
                  <DivergenceBanner
                    decision={decisions.patient_consent_irb_institution}
                    onUseDocx={() =>
                      useDocxFor('patient_consent_irb_institution', setIrbInstitution)
                    }
                    onKeepDb={() => keepDbFor('patient_consent_irb_institution')}
                  />
                </div>
                <div>
                  <label className="editor-field-label">
                    IRB protocol
                    <PreFillChip
                      decision={decisions.patient_consent_irb_protocol}
                      onDismiss={() => dismissDecision('patient_consent_irb_protocol')}
                    />
                  </label>
                  <input
                    type="text"
                    value={irbProtocol}
                    onChange={(e) => {
                      setIrbProtocol(e.target.value)
                      markDirty()
                    }}
                    className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
                    placeholder="e.g., IRB-2024-1184"
                  />
                  <DivergenceBanner
                    decision={decisions.patient_consent_irb_protocol}
                    onUseDocx={() =>
                      useDocxFor('patient_consent_irb_protocol', setIrbProtocol)
                    }
                    onKeepDb={() => keepDbFor('patient_consent_irb_protocol')}
                  />
                </div>
              </div>
              <p className="editor-field-hint">
                Both required for waiver variants; synthesizer substitutes &lt;institution&gt; and &lt;IRB-####&gt; placeholders in the statement before render.
              </p>
            </div>
          )}
        </div>
        )}

        {/* Acknowledgments */}
        <div className="pt-3 border-t border-border">
          <label className="editor-field-label">
            Acknowledgments (optional)
            <PreFillChip
              decision={decisions.acknowledgments}
              onDismiss={() => dismissDecision('acknowledgments')}
            />
          </label>
          <textarea
            value={acknowledgments}
            onChange={(e) => {
              setAcknowledgments(e.target.value)
              markDirty()
            }}
            rows={3}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            placeholder="ICMJE reminder: thanked persons need written permission."
          />
          <DivergenceBanner
            decision={decisions.acknowledgments}
            onUseDocx={() => useDocxFor('acknowledgments', setAcknowledgments)}
            onKeepDb={() => keepDbFor('acknowledgments')}
          />
        </div>
      </CollapsibleSection>

      {/* §5 Validation & Preview — Session 85 merged the old §6 Preview
          Render section into this card so the page carries exactly ONE
          preview surface and ONE render button (previously: a scroll-to
          "Open preview" in §5, a second "Open preview" in §6, and a third
          ungated "Render published PDF" in the Publish pipeline panel). */}
      <div data-target="validation-summary" className="space-y-4">
        <ValidationSummary
          errors={errors}
          warnings={warnings}
          isPending={validationPending}
          onForceRefresh={runValidation}
          acknowledged={acknowledged}
          onAcknowledge={(rule, checked) => {
            setAcknowledged((prev) => {
              const next = new Set(prev)
              if (checked) next.add(rule)
              else next.delete(rule)
              return next
            })
          }}
          onJumpToFix={jumpToField}
          onRenderPublish={onRenderPublish}
          renderDisabled={renderDisabled}
          renderDisabledReason={renderDisabledReason}
        />
        <div className="editor-section" data-target="preview-cluster">
          <p className="editor-section-label">Preview render</p>
          <p className="text-xs text-brown italic mt-1 mb-3">
            Generates a non-publishing PDF so you can inspect rendering
            before committing to publish. Disabled while errors are present
            or unsaved changes exist.
          </p>
          <PreviewRenderCluster
            manuscriptId={initial.manuscript_id}
            disabled={previewDisabled}
            disabledReason={previewDisabledReason}
          />
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="editor-save-bar">
        {saveInfo && (
          <p className="text-xs text-emerald-700 flex-1 truncate">{saveInfo}</p>
        )}
        {saveError && (
          <p className="text-xs text-red-700 flex-1 truncate">{saveError}</p>
        )}
        {isDirty && !saveInfo && (
          <p className="text-xs text-brown italic">Unsaved changes</p>
        )}
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                'Discard all unsaved changes? The form will reset to the last saved state on the next page reload.'
              )
            ) {
              window.location.reload()
            }
          }}
          disabled={!isDirty || savePending}
          className="btn-ghost text-xs disabled:opacity-40"
        >
          Discard changes
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || savePending}
          className="btn-primary-light text-xs disabled:opacity-40"
        >
          {savePending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// Phase 1.B+ chevron-collapsible wrapper (Sushant follow-up commit,
// 2026-05-16, per Kanwar UX ask). Replaces the bare <div className=
// "editor-section"> + <p className="editor-section-label"> pattern
// with a clickable header that toggles content visibility. Default
// expanded so Franklin §3 UX intent ("all sections expanded") is
// preserved for editors who never touch the chevron. Local state
// only (per-session; not localStorage).
//
// Caveat: jump-to-fix anchors land their target into the page but
// won't be visible if the containing section is collapsed. Phase
// 1.5 auto-expand-on-jump is a small follow-up if editors hit this
// in practice.
function CollapsibleSection({
  id,
  label,
  subtitle,
  collapsed,
  onToggle,
  dataTarget,
  children,
}: {
  id: string
  label: string
  subtitle?: string
  collapsed: boolean
  onToggle: () => void
  dataTarget?: string
  children: React.ReactNode
}) {
  const target = dataTarget ?? `section-${id}`
  return (
    <div className="editor-section" data-target={target}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={`${id}-content`}
        className="w-full flex items-start justify-between gap-3 text-left group"
      >
        <div className="flex-1 min-w-0">
          <p className="editor-section-label group-hover:text-brown-dark transition-colors">
            {label}
          </p>
          {subtitle && (
            <p className="text-xs text-brown italic mt-1">{subtitle}</p>
          )}
        </div>
        <span className="text-tan group-hover:text-brown-dark mt-0.5 flex-shrink-0">
          {collapsed ? (
            <ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
          ) : (
            <ChevronDownIcon className="w-5 h-5" aria-hidden="true" />
          )}
        </span>
      </button>
      {!collapsed && (
        <div id={`${id}-content`} className="space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

function FundingAddInput({ onAdd }: { onAdd: (s: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (val.trim()) {
              onAdd(val)
              setVal('')
            }
          }
        }}
        placeholder="Add funding source + Enter"
        className="bg-white border border-dashed border-brown/30 rounded-lg px-3 py-2 text-sm text-ink flex-1 focus:ring-2 focus:ring-peach-dark"
      />
      <button
        type="button"
        onClick={() => {
          if (val.trim()) {
            onAdd(val)
            setVal('')
          }
        }}
        disabled={!val.trim()}
        className="btn-ghost text-xs disabled:opacity-40"
      >
        Add
      </button>
    </div>
  )
}
