'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ManuscriptRow, ManuscriptMetadataRow, ManuscriptFileRow, ManuscriptAuthorRow, ManuscriptType } from '@/lib/types/database'
import { createOrUpdateDraft, saveManuscriptInfo, saveAuthors, saveDeclarations, submitManuscript } from '@/lib/submission/actions'
import Step1Type from './Step1Type'
import Step2Files from './Step2Files'
import Step3Info from './Step3Info'
import Step4Authors from './Step4Authors'
import type { AuthorEntry } from './Step4Authors'
import Step5Declarations from './Step5Declarations'

// ---- Step definitions ----

const STEPS = [
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
  noteToEditor: string
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

export default function SubmissionWizard({ draft, userProfile }: SubmissionWizardProps) {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(() => initialStateFromDraft(draft, userProfile))
  const [currentStep, setCurrentStep] = useState(() => computeInitialStep(initialStateFromDraft(draft, userProfile)))
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
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
  const saveDraft = useCallback(async (st?: WizardState) => {
    const s = st || stateRef.current
    if (!s.manuscriptType) return
    setSaving(true)

    try {
      // Save step 1 data
      const result = await createOrUpdateDraft({
        manuscriptId: s.manuscriptId,
        manuscriptType: s.manuscriptType,
        notUnderReview: s.notUnderReview,
        notPreviouslyPublished: s.notPreviouslyPublished,
        allAuthorsAgreed: s.allAuthorsAgreed,
      })

      if (result.error) {
        console.error('Save failed:', result.error)
        setSaving(false)
        return
      }

      // If we just created a new draft, store the ID
      if (result.manuscriptId && !s.manuscriptId) {
        setState(prev => ({
          ...prev,
          manuscriptId: result.manuscriptId!,
          submissionId: result.submissionId || prev.submissionId,
        }))
      }

      const mId = result.manuscriptId || s.manuscriptId

      // Save step 3 data if we have a manuscript ID and title
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

      // Save step 4 data (authors)
      if (mId && s.authors.length > 0) {
        await saveAuthors({
          manuscriptId: mId,
          authors: s.authors,
        })
      }

      // Save step 5 data (declarations)
      if (mId) {
        await saveDeclarations({
          manuscriptId: mId,
          conflictOfInterest: s.noConflicts ? null : (s.conflictOfInterest || null),
          fundingSources: s.noFunding ? [] : s.fundingSources,
          dataAvailabilityStatement: s.dataAvailability || null,
          ethicsApprovalNumber: s.ethicsInvolved ? (s.ethicsApprovalNumber || null) : null,
          clinicalTrialId: s.clinicalTrial ? (s.clinicalTrialId || null) : null,
          authorConsentCertified: s.authorConsentCertified,
          noteToEditor: s.noteToEditor || null,
        })
      }

      showSavedToast()
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }, [showSavedToast])

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
  const goNext = useCallback(async () => {
    await saveDraft()
    if (currentStep < 5) setCurrentStep(prev => prev + 1)
  }, [currentStep, saveDraft])

  const goBack = useCallback(async () => {
    await saveDraft()
    if (currentStep > 1) setCurrentStep(prev => prev - 1)
  }, [currentStep, saveDraft])

  const goToStep = useCallback(async (step: number) => {
    await saveDraft()
    setCurrentStep(step)
  }, [saveDraft])

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
      // Save everything first
      await saveDraft()

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
  }, [state.manuscriptId, saveDraft, router])

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
  const step5Complete = coiOk && fundingOk && dataOk && ethicsOk && trialOk

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
        <h1 className="font-serif text-2xl text-brown-dark">Submit a Manuscript</h1>
        {state.submissionId && (
          <p className="text-sm text-tan mt-1">Submission ID: {state.submissionId}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-border rounded-xl p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = (step.number === 1 && step1Complete && currentStep > 1) ||
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
                          : 'bg-cream text-tan border-2 border-border'
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
                    isCurrent ? 'text-brown-dark font-medium' : 'text-tan'
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
        {currentStep === 1 && (
          <Step1Type
            manuscriptType={state.manuscriptType}
            notUnderReview={state.notUnderReview}
            notPreviouslyPublished={state.notPreviouslyPublished}
            allAuthorsAgreed={state.allAuthorsAgreed}
            onChange={updateState}
          />
        )}

        {currentStep === 2 && (
          <Step2Files
            manuscriptId={state.manuscriptId}
            files={state.files}
            onFilesChange={(files) => updateState({ files })}
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
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <div>
          {currentStep > 1 && (
            <button
              onClick={goBack}
              disabled={saving}
              className="text-sm text-brown font-medium px-5 py-2.5 rounded-full border border-brown/20 hover:bg-cream-alt transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveAndExit}
            disabled={saving}
            className="text-sm text-tan hover:text-brown-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Continue Later'}
          </button>

          {currentStep < 5 && (
            <button
              onClick={goNext}
              disabled={saving || !canProceed(currentStep)}
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
