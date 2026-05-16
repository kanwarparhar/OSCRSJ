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
}

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

export default function MetadataEditorForm({ initial, rendererUrl }: Props) {
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
  const [abstractSections, setAbstractSections] = useState<Record<string, string>>(
    abstractLabels
      ? parseAbstractIntoSections(initial.abstract, abstractLabels)
      : {}
  )
  const [abstractUnstructured, setAbstractUnstructured] = useState<string>(
    abstractLabels ? '' : initial.abstract
  )
  const [abstractPaste, setAbstractPaste] = useState('')

  const [authors, setAuthors] = useState<AuthorState[]>(initial.authors)
  const [conflictOfInterest, setConflictOfInterest] = useState(initial.conflict_of_interest)
  const [fundingSources, setFundingSources] = useState<string[]>(initial.funding_sources)
  const [noFunding, setNoFunding] = useState(initial.funding_sources.length === 0)
  const [dataAvailability, setDataAvailability] = useState(initial.data_availability_statement)
  const [ethicsApprovalNumber, setEthicsApprovalNumber] = useState(initial.ethics_approval_number)
  const [aiUsed, setAiUsed] = useState<boolean | null>(initial.ai_tools_used)
  const [aiDetails, setAiDetails] = useState(initial.ai_tools_details)
  const [consentVariant, setConsentVariant] = useState<PatientConsentVariant | null>(
    initial.patient_consent_variant
  )
  const [consentStatement, setConsentStatement] = useState(initial.patient_consent_statement)
  const [irbInstitution, setIrbInstitution] = useState(initial.patient_consent_irb_institution)
  const [irbProtocol, setIrbProtocol] = useState(initial.patient_consent_irb_protocol)
  const [acknowledgments, setAcknowledgments] = useState(initial.acknowledgments)
  const [equalContribStatement, setEqualContribStatement] = useState(initial.equal_contribution_statement)

  const [isDirty, setIsDirty] = useState(false)
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

  function onOpenPreview() {
    // Phase 1.C — wires to <PreviewRenderCluster /> rendered below
    // §5. Scroll into view + flash; the cluster owns its own state.
    const target = document.querySelector('[data-target="preview-cluster"]') as HTMLElement | null
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2')
      setTimeout(() => {
        target.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2')
      }, 1500)
    }
  }

  function onRenderPublish() {
    if (!rendererUrl) {
      setSaveError('NEXT_PUBLIC_RENDERER_URL is not configured.')
      return
    }
    window.open(rendererUrl, '_blank', 'noopener,noreferrer')
  }

  // ---- Render ----

  return (
    <div className="space-y-6" data-target="metadata-editor-form">
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
      <div className="editor-section" data-target="section-article-identity">
        <p className="editor-section-label">§1 — Article Identity</p>
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
      </div>

      {/* §2 Abstract */}
      <div className="editor-section" data-target="section-abstract">
        <p className="editor-section-label">§2 — Abstract</p>
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
              {abstractLabels.map((label) => (
                <div key={label}>
                  <label className="abstract-field-label">{label}:</label>
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
                </div>
              ))}
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
      </div>

      {/* §3 Authors */}
      <div className="editor-section" data-target="section-authors">
        <p className="editor-section-label">§3 — Authors ({authors.length})</p>
        <p className="text-xs text-brown italic mb-3">
          Drag the handle on the left to reorder. Exactly one must be flagged corresponding.
          Tick &quot;Equal contribution&quot; on ≥2 authors to surface the shared-first-authorship statement.
        </p>
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
      </div>

      {/* §4 Declarations */}
      <div className="editor-section" data-target="section-declarations">
        <p className="editor-section-label">§4 — Declarations</p>

        {/* Funding */}
        <div>
          <label className="editor-field-label">Funding</label>
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
          <label className="editor-field-label">Conflict of interest</label>
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
        </div>

        {/* IRB / Ethics */}
        <div className="pt-3 border-t border-border">
          <label className="editor-field-label">IRB / Ethics approval number</label>
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

        {/* Patient consent */}
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
              <label className="editor-field-label">Statement</label>
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
            </div>
          )}

          {(consentVariant === 'deceased_irb_waiver' ||
            consentVariant === 'incapacitated_irb_waiver') && (
            <div className="conditional-reveal-block" data-target="patient_consent_irb">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="editor-field-label">IRB institution</label>
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
                </div>
                <div>
                  <label className="editor-field-label">IRB protocol</label>
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
                </div>
              </div>
              <p className="editor-field-hint">
                Both required for waiver variants; synthesizer substitutes &lt;institution&gt; and &lt;IRB-####&gt; placeholders in the statement before render.
              </p>
            </div>
          )}
        </div>

        {/* Acknowledgments */}
        <div className="pt-3 border-t border-border">
          <label className="editor-field-label">Acknowledgments (optional)</label>
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
        </div>
      </div>

      {/* §5 Validation Summary */}
      <div data-target="validation-summary">
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
          onOpenPreview={onOpenPreview}
          onRenderPublish={onRenderPublish}
          previewDisabled={previewDisabled}
          previewDisabledReason={previewDisabledReason}
          renderDisabled={renderDisabled}
          renderDisabledReason={renderDisabledReason}
        />
      </div>

      {/* §6 Preview Render Cluster (Franklin §6 four-state inline-card) */}
      <div className="editor-section" data-target="preview-cluster">
        <p className="editor-section-label">§6 — Preview Render</p>
        <p className="text-xs text-brown italic mb-3">
          Generates a non-publishing PDF artifact so the editor can inspect
          rendering before committing to publish. Disabled while errors are
          present or unsaved changes exist.
        </p>
        <PreviewRenderCluster
          manuscriptId={initial.manuscript_id}
          disabled={previewDisabled}
          disabledReason={previewDisabledReason}
        />
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
