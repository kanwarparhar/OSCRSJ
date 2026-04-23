'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ManuscriptRow, ManuscriptMetadataRow, ManuscriptFileRow, ManuscriptAuthorRow, ManuscriptType } from '@/lib/types/database'
import {
  createOrUpdateDraft,
  saveManuscriptInfo,
  saveAuthors,
  saveDeclarations,
  submitManuscript,
  submitRevision,
  type AnonymisedReview,
} from '@/lib/submission/actions'
import Step1Type from './Step1Type'
import Step2Files from './Step2Files'
import Step3Info from './Step3Info'
import Step4Authors from './Step4Authors'
import type { AuthorEntry } from './Step4Authors'
import Step5Declarations from './Step5Declarations'
import RevisionStep0 from './RevisionStep0'

// ---- Step definitions ----

const STEPS_BASE = [
  { number: 1, label: 'Type & Confirmations' },
  { number: 2, label: 'Upload Files' },
  { number: 3, label: 'Manuscript Info' },
  { number: 4, label: 'Authors' },
  { number: 5, label: 'Declarations' },
]

const STEPS_REVISING = [
  { number: 0, label: 'Decision & Comments' },
  { number: 1, label: 'Type & Confirmations' },
  { number: 2, label: 'Upload Files' },
  { number: 3, label: 'Manuscript Info' },
  { number: 4, label: 'Authors' },
  { number: 5, label: 'Declarations' },
]

// ---- Wizard state types ----

export interface WizardState {
  manuscriptId: string | null
  submissionId: string | null
  // Step 1
  manuscriptType: ManuscriptType | null
  notUnderReview: boolean
  notPreviouslyPublished: boolean
  allAuthorsAgreed: boolean
  // Step 2 (files tracked separately)
  files: ManuscriptFileRow[]
  // Step 3
  title: string
  abstract: string
  keywords: string[]
  subspecialty: string
  suggestedReviewers: { name: string; email: string; expertise: string }[]
  nonPreferredReviewers: { name: string; reason: string }[]
  // Step 4
  authors: AuthorEntry[]
  authorConsentCertified: boolean
  // Step 5
  conflictOfInterest: string
  noConflicts: boolean
  fundingSources: string[]
  noFunding: boolean
  dataAvailability: string
  dataAvailabilityUrl: string
  ethicsInvolved: boolean
  ethicsApprovalNumber: string
  clinicalTrial: boolean
  clinicalTrialId: string
  aiToolsUsed: boolean
  aiToolsDetails: string
  noteToEditor: string
}

export interface RevisionContextClient {
  revisionNumber: number
  decisionLetter: string | null
  decisionType: string | null
  decisionDate: string | null
  revisionDeadline: string | null
  reviews: AnonymisedReview[]
}

interface SubmissionWizardProps {
  draft: {
    manuscript: ManuscriptRow | null
    metadata: ManuscriptMetadataRow | null
    files: ManuscriptFileRow[]
    authors: ManuscriptAuthorRow[]
  }
  userProfile: {
    full_name: string
    email: string
    affiliation: string | null
    orcid_id: string | null
    degrees: string | null
  } | null
  revisionContext?: RevisionContextClient
}

function authorsFromDraft(draftAuthors: ManuscriptAuthorRow[]): AuthorEntry[] {
  return draftAuthors.map(a => ({
    full_name: a.full_name,
    email: a.email,
    affiliation: a.affiliation || '',
    orcid_id: a.orcid_id || '',
    degrees: a.degrees || '',
    contribution: a.contribution || '',
    is_corresponding: a.is_corresponding,
    author_order: a.author_order,
  }))
}

function initialStateFromDraft(
  draft: SubmissionWizardProps['draft'],
  userProfile: SubmissionWizardProps['userProfile'],
): WizardState {
  const m = draft.manuscript
  const meta = draft.metadata

  // Build authors list — from draft if available, else seed with logged-in user
  let authors: AuthorEntry[]
  if (draft.authors.length > 0) {
    authors = authorsFromDraft(draft.authors)
  } else if (userProfile) {
    authors = [{
      full_name: userProfile.full_name,
      email: userProfile.email,
      affiliation: userProfile.affiliation || '',
      orcid_id: userProfile.orcid_id || '',
      degrees: userProfile.degrees || '',
      contribution: '',
      is_corresponding: true,
      author_order: 1,
    }]
  } else {
    authors = []
  }

  // Determine COI/funding state from metadata
  const coiValue = meta?.conflict_of_interest || ''
  const fundingValues = meta?.funding_sources || []
  const noConflicts = !coiValue && (meta?.author_consent_certified !== undefined ? !coiValue : false)
  const noFunding = fundingValues.length === 0 && (meta?.author_consent_certified !== undefined ? true : false)

  return {
    manuscriptId: m?.id || null,
    submissionId: m?.submission_id || null,
    manuscriptType: m?.manuscript_type || null,
    notUnderReview: meta?.not_under_review_elsewhere || false,
    notPreviouslyPublished: meta?.not_previously_published || false,
    allAuthorsAgreed: meta?.all_authors_agreed || false,
    files: draft.files || [],
    title: m?.title || '',
    abstract: m?.abstract || '',
    keywords: m?.keywords || [],
    subspecialty: m?.subspecialty || '',
    suggestedReviewers: [],
    nonPreferredReviewers: [],
    authors,
    authorConsentCertified: meta?.author_consent_certified || false,
    conflictOfInterest: coiValue,
    noConflicts,
    fundingSources: fundingValues,
    noFunding,
    dataAvailability: meta?.data_availability_statement || '',
    dataAvailabilityUrl: '',
    ethicsInvolved: !!meta?.ethics_approval_number,
    ethicsApprovalNumber: meta?.ethics_approval_number || '',
    clinicalTrial: !!meta?.clinical_trial_id,
    clinicalTrialId: meta?.clinical_trial_id || '',
    aiToolsUsed: meta?.ai_tools_used || false,
    aiToolsDetails: meta?.ai_tools_details || '',
    noteToEditor: m?.note_to_editor || '',
  }
}

function computeInitialStep(state: WizardState): number {
  if (!state.manuscriptType) return 1
  const hasMain = state.files.some(f => f.file_type === 'manuscript')
  const hasBlinded = state.files.some(f => f.file_type === 'blinded_manuscript')
  if (!hasMain || !hasBlinded) return 2
  if (!state.title || !state.abstract || state.keywords.length < 3 || !state.subspecialty) return 3
  if (state.authors.length === 0 || !state.authorConsentCertified) return 4
  return 5
}

export default function SubmissionWizard({ draft, userProfile, revisionContext }: SubmissionWizardProps) {
  const router = useRouter()
  const isRevising = !!revisionContext
  const STEPS = isRevising ? STEPS_REVISING : STEPS_BASE
  const [state, setState] = useState<WizardState>(() => {
    const base = initialStateFromDraft(draft, userProfile)
    // In revising mode, the note_to_editor field starts blank —
    // it belongs to the revision, not the original manuscript.
    return isRevising ? { ...base, noteToEditor: '' } : base
  })
  const [revisionResponse, setRevisionResponse] = useState('')
  const [currentStep, setCurrentStep] = useState(() =>
    isRevising ? 0 : computeInitialStep(initialStateFromDraft(draft, userProfile))
  )
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // ---- Toast helper ----
  const showSavedToast = useCallback(() => {
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }, [])

  // ---- Save draft to Supabase ----
  // Returns { ok: true, manuscriptId } on success, { ok: false, error } on
  // failure. Callers (goNext/goBack/submit) MUST check the result — we never
  // want to advance the wizard past a failed save, because downstream steps
  // depend on manuscriptId existing on the server.
  const saveDraft = useCallback(async (st?: WizardState): Promise<
    { ok: true; manuscriptId: string | null } | { ok: false; error: string }
  > => {
    const s = st || stateRef.current
    if (!s.manuscriptType) {
      return { ok: true, manuscriptId: s.manuscriptId }
    }
    setSaving(true)
    setSaveError(null)

    try {
      let mId: string | null = s.manuscriptId

      if (!isRevising) {
        // ---- Regular draft flow: upsert draft row + manuscript info. ----
        const result = await createOrUpdateDraft({
          manuscriptId: s.manuscriptId,
          manuscriptType: s.manuscriptType,
          notUnderReview: s.notUnderReview,
          notPreviouslyPublished: s.notPreviouslyPublished,
          allAuthorsAgreed: s.allAuthorsAgreed,
        })

        if (result.error) {
          console.error('Save failed:', result.error)
          setSaveError(result.error)
          setSaving(false)
          return { ok: false, error: result.error }
        }

        if (result.manuscriptId && !s.manuscriptId) {
          setState(prev => ({
            ...prev,
            manuscriptId: result.manuscriptId!,
            submissionId: result.submissionId || prev.submissionId,
          }))
        }

        mId = result.manuscriptId || s.manuscriptId

        if (mId && s.title) {
          await saveManuscriptInfo({
            manuscriptId: mId,
            title: s.title,
            abstract: s.abstract,
            keywords: s.keywords,
            subspecialty: s.subspecialty,
            suggestedReviewers: s.suggestedReviewers,
            nonPreferredReviewers: s.nonPreferredReviewers,
            noteToEditor: s.noteToEditor || undefined,
          })
        }
      }

      // Authors + declarations save through both flows (admin-client
      // writes are status-agnostic). In revising mode, title /
      // abstract / keywords / note_to_editor are held in-memory and
      // persisted by submitRevision on final submit; see below.
      if (mId && s.authors.length > 0) {
        await saveAuthors({
          manuscriptId: mId,
          authors: s.authors,
        })
      }

      if (mId) {
        await saveDeclarations({
          manuscriptId: mId,
          conflictOfInterest: s.noConflicts ? null : (s.conflictOfInterest || null),
          fundingSources: s.noFunding ? [] : s.fundingSources,
          dataAvailabilityStatement: s.dataAvailability || null,
          ethicsApprovalNumber: s.ethicsInvolved ? (s.ethicsApprovalNumber || null) : null,
          clinicalTrialId: s.clinicalTrial ? (s.clinicalTrialId || null) : null,
          authorConsentCertified: s.authorConsentCertified,
          aiToolsUsed: s.aiToolsUsed,
          aiToolsDetails: s.aiToolsUsed ? (s.aiToolsDetails.trim() || null) : null,
          // Omit noteToEditor in revising mode — the revision's note
          // lives on manuscript_revisions, not the original
          // manuscript.
          ...(isRevising ? {} : { noteToEditor: s.noteToEditor || null }),
        })
      }

      showSavedToast()
      return { ok: true, manuscriptId: mId }
    } catch (err) {
      console.error('Save error:', err)
      const msg = err instanceof Error ? err.message : 'Unknown save error'
      setSaveError(msg)
      return { ok: false, error: msg }
    } finally {
      setSaving(false)
    }
  }, [showSavedToast, isRevising])

  // ---- Auto-save on 30s debounced timer ----
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      saveDraft()
    }, 30000)
  }, [saveDraft])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [])

  // ---- Update state helper (triggers auto-save schedule) ----
  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }))
    scheduleAutoSave()
  }, [scheduleAutoSave])

  // ---- Step navigation ----
  const minStep = isRevising ? 0 : 1
  const goNext = useCallback(async () => {
    // Step 0 in revising mode is read-only — no save on advance.
    if (isRevising && currentStep === 0) {
      setCurrentStep(1)
      return
    }
    const result = await saveDraft()
    // Only advance if the save succeeded. Previously the wizard would
    // step forward even when createOrUpdateDraft errored, which left
    // Step 2+ with a null manuscriptId and a misleading "complete Step
    // 1 first" error on file upload.
    if (!result.ok) return
    if (currentStep < 5) setCurrentStep(prev => prev + 1)
  }, [currentStep, saveDraft, isRevising])

  const goBack = useCallback(async () => {
    // Backward moves are always safe — don't block on save errors.
    if (isRevising && currentStep === 1) {
      setCurrentStep(0)
      return
    }
    await saveDraft()
    if (currentStep > minStep) setCurrentStep(prev => prev - 1)
  }, [currentStep, saveDraft, isRevising, minStep])

  const goToStep = useCallback(async (step: number) => {
    if (isRevising && step === 0) {
      setCurrentStep(0)
      return
    }
    const result = await saveDraft()
    // Block forward jumps on save failure, allow backward jumps.
    if (!result.ok && step > currentStep) return
    setCurrentStep(step)
  }, [saveDraft, currentStep, isRevising])

  const saveAndExit = useCallback(async () => {
    await saveDraft()
    router.push('/dashboard')
  }, [saveDraft, router])

  // ---- Submit handler ----
  const handleSubmit = useCallback(async () => {
    if (!state.manuscriptId) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      // Save everything first. Bail if the save itself failed.
      const saveResult = await saveDraft()
      if (!saveResult.ok) {
        setSubmitError(saveResult.error)
        setSubmitting(false)
        return
      }

      if (isRevising) {
        const result = await submitRevision({
          manuscriptId: state.manuscriptId,
          title: state.title,
          abstract: state.abstract,
          keywords: state.keywords,
          responseToReviewers: revisionResponse,
          noteToEditor: state.noteToEditor || null,
        })
        if (result.error) {
          setSubmitError(result.error)
          setSubmitting(false)
          return
        }
        router.push('/dashboard?revised=true')
        return
      }

      const result = await submitManuscript(state.manuscriptId)
      if (result.error) {
        setSubmitError(result.error)
        setSubmitting(false)
        return
      }

      // Success — redirect to dashboard
      router.push('/dashboard?submitted=true')
    } catch (err) {
      console.error('Submit error:', err)
      setSubmitError('An unexpected error occurred. Please try again.')
      setSubmitting(false)
    }
  }, [state.manuscriptId, state.title, state.abstract, state.keywords, state.noteToEditor, saveDraft, router, isRevising, revisionResponse])

  // ---- Step completion checks ----
  const step1Complete = !!(
    state.manuscriptType &&
    state.notUnderReview &&
    state.notPreviouslyPublished &&
    state.allAuthorsAgreed
  )

  const hasMainManuscript = state.files.some(f => f.file_type === 'manuscript')
  const hasBlindedManuscript = state.files.some(f => f.file_type === 'blinded_manuscript')
  const step2Complete = hasMainManuscript && hasBlindedManuscript

  const step3Complete = !!(
    state.title &&
    state.abstract &&
    state.keywords.length >= 3 &&
    state.subspecialty
  )

  const step4Complete = state.authors.length >= 1 && state.authorConsentCertified

  const coiOk = state.noConflicts || state.conflictOfInterest.trim().length > 0
  const fundingOk = state.noFunding || state.fundingSources.length > 0
  const dataOk = state.dataAvailability.length > 0 &&
    (state.dataAvailability !== 'Data available in a public repository' || state.dataAvailabilityUrl.trim().length > 0)
  const ethicsOk = !state.ethicsInvolved || state.ethicsApprovalNumber.trim().length > 0
  const trialOk = !state.clinicalTrial || state.clinicalTrialId.trim().length > 0
  const aiToolsOk = !state.aiToolsUsed || state.aiToolsDetails.trim().length > 0
  const step5Complete = coiOk && fundingOk && dataOk && ethicsOk && trialOk && aiToolsOk

  // Can we move to the next step?
  const canProceed = (step: number) => {
    if (step === 1) return step1Complete
    if (step === 2) return step2Complete
    if (step === 3) return step3Complete
    if (step === 4) return step4Complete
    return false
  }

  return (
    <div>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-brown-dark">
          {isRevising
            ? `Submit Revision v${revisionContext!.revisionNumber}`
            : 'Submit a Manuscript'}
        </h1>
        {state.submissionId && (
          <p className="text-sm text-brown mt-1">Submission ID: {state.submissionId}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-border rounded-xl p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted =
              (step.number === 0 && currentStep > 0) ||
              (step.number === 1 && step1Complete && currentStep > 1) ||
              (step.number === 2 && step2Complete && currentStep > 2) ||
              (step.number === 3 && step3Complete && currentStep > 3) ||
              (step.number === 4 && step4Complete && currentStep > 4)
            const isCurrent = step.number === currentStep

            return (
              <div key={step.number} className="flex items-center flex-1 last:flex-initial">
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      isCompleted
                        ? 'bg-green-100 text-green-700 border-2 border-green-400'
                        : isCurrent
                          ? 'bg-peach-dark text-brown border-2 border-brown/30'
                          : 'bg-white text-brown border-2 border-border'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className={`text-xs mt-1.5 text-center hidden sm:block ${
                    isCurrent ? 'text-ink font-medium' : 'text-brown'
                  }`}>
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-18px] sm:mt-0 ${
                    isCompleted ? 'bg-green-300' : 'bg-border'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Draft saved toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 bg-brown-dark text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 z-50 animate-fade-in">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Draft saved
        </div>
      )}

      {/* Step content */}
      <div className="bg-white border border-border rounded-xl p-4 sm:p-8">
        {isRevising && currentStep === 0 && (
          <RevisionStep0
            revisionNumber={revisionContext!.revisionNumber}
            decisionLetter={revisionContext!.decisionLetter}
            decisionType={revisionContext!.decisionType}
            decisionDate={revisionContext!.decisionDate}
            revisionDeadline={revisionContext!.revisionDeadline}
            reviews={revisionContext!.reviews}
          />
        )}

        {currentStep === 1 && (
          <Step1Type
            manuscriptType={state.manuscriptType}
            notUnderReview={state.notUnderReview}
            notPreviouslyPublished={state.notPreviouslyPublished}
            allAuthorsAgreed={state.allAuthorsAgreed}
            onChange={updateState}
            manuscriptTypeLocked={isRevising}
          />
        )}

        {currentStep === 2 && (
          <Step2Files
            manuscriptId={state.manuscriptId}
            files={state.files}
            onFilesChange={(files) => updateState({ files })}
            revisionNumber={isRevising ? revisionContext!.revisionNumber : undefined}
          />
        )}

        {currentStep === 3 && (
          <Step3Info
            title={state.title}
            abstract={state.abstract}
            keywords={state.keywords}
            subspecialty={state.subspecialty}
            suggestedReviewers={state.suggestedReviewers}
            nonPreferredReviewers={state.nonPreferredReviewers}
            onChange={updateState}
            subspecialtyLocked={isRevising}
            hideReviewerSuggestions={isRevising}
          />
        )}

        {currentStep === 4 && (
          <Step4Authors
            authors={state.authors}
            authorConsentCertified={state.authorConsentCertified}
            onChange={updateState}
          />
        )}

        {currentStep === 5 && (
          <Step5Declarations
            conflictOfInterest={state.conflictOfInterest}
            noConflicts={state.noConflicts}
            fundingSources={state.fundingSources}
            noFunding={state.noFunding}
            dataAvailability={state.dataAvailability}
            dataAvailabilityUrl={state.dataAvailabilityUrl}
            ethicsInvolved={state.ethicsInvolved}
            ethicsApprovalNumber={state.ethicsApprovalNumber}
            clinicalTrial={state.clinicalTrial}
            clinicalTrialId={state.clinicalTrialId}
            aiToolsUsed={state.aiToolsUsed}
            aiToolsDetails={state.aiToolsDetails}
            noteToEditor={state.noteToEditor}
            manuscriptType={state.manuscriptType}
            files={state.files}
            title={state.title}
            abstract={state.abstract}
            keywords={state.keywords}
            subspecialty={state.subspecialty}
            authors={state.authors}
            authorConsentCertified={state.authorConsentCertified}
            onChange={updateState}
            onGoToStep={goToStep}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitError={submitError}
            isRevising={isRevising}
            revisionResponse={revisionResponse}
            onRevisionResponseChange={setRevisionResponse}
          />
        )}
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t save your draft</p>
            <p className="mt-0.5">{saveError}</p>
          </div>
          <button onClick={() => setSaveError(null)} className="font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <div>
          {currentStep > minStep && (
            <button
              onClick={goBack}
              disabled={saving}
              className="text-sm text-brown font-medium px-5 py-2.5 rounded-full border border-brown/20 hover:bg-cream transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveAndExit}
            disabled={saving}
            className="text-sm text-brown hover:text-ink transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Continue Later'}
          </button>

          {currentStep < 5 && (
            <button
              onClick={goNext}
              disabled={
                saving ||
                (currentStep >= 1 && !canProceed(currentStep))
              }
              className="btn-primary-light disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
