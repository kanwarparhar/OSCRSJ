'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ManuscriptRow, ManuscriptMetadataRow, ManuscriptFileRow, ManuscriptType } from '@/lib/types/database'
import { createOrUpdateDraft, saveManuscriptInfo } from '@/lib/submission/actions'
import Step1Type from './Step1Type'
import Step2Files from './Step2Files'
import Step3Info from './Step3Info'

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
}

interface SubmissionWizardProps {
  draft: {
    manuscript: ManuscriptRow | null
    metadata: ManuscriptMetadataRow | null
    files: ManuscriptFileRow[]
  }
}

function initialStateFromDraft(draft: SubmissionWizardProps['draft']): WizardState {
  const m = draft.manuscript
  const meta = draft.metadata
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
  }
}

function computeInitialStep(state: WizardState): number {
  // Resume at the first incomplete step
  if (!state.manuscriptType) return 1
  const hasMain = state.files.some(f => f.file_type === 'manuscript')
  const hasBlinded = state.files.some(f => f.file_type === 'blinded_manuscript')
  if (!hasMain || !hasBlinded) return 2
  if (!state.title || !state.abstract || state.keywords.length < 3 || !state.subspecialty) return 3
  return 3 // Stay on step 3 max for now
}

export default function SubmissionWizard({ draft }: SubmissionWizardProps) {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(() => initialStateFromDraft(draft))
  const [currentStep, setCurrentStep] = useState(() => computeInitialStep(initialStateFromDraft(draft)))
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
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

      // Save step 3 data if we have a manuscript ID and title
      const mId = result.manuscriptId || s.manuscriptId
      if (mId && s.title) {
        await saveManuscriptInfo({
          manuscriptId: mId,
          title: s.title,
          abstract: s.abstract,
          keywords: s.keywords,
          subspecialty: s.subspecialty,
          suggestedReviewers: s.suggestedReviewers,
          nonPreferredReviewers: s.nonPreferredReviewers,
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
    if (currentStep < 3) setCurrentStep(prev => prev + 1)
  }, [currentStep, saveDraft])

  const goBack = useCallback(async () => {
    await saveDraft()
    if (currentStep > 1) setCurrentStep(prev => prev - 1)
  }, [currentStep, saveDraft])

  const saveAndExit = useCallback(async () => {
    await saveDraft()
    router.push('/dashboard')
  }, [saveDraft, router])

  // ---- Step 1 completion check ----
  const step1Complete = !!(
    state.manuscriptType &&
    state.notUnderReview &&
    state.notPreviouslyPublished &&
    state.allAuthorsAgreed
  )

  // ---- Step 2 completion check ----
  const hasMainManuscript = state.files.some(f => f.file_type === 'manuscript')
  const hasBlindedManuscript = state.files.some(f => f.file_type === 'blinded_manuscript')
  const step2Complete = hasMainManuscript && hasBlindedManuscript

  // ---- Step 3 completion check ----
  const step3Complete = !!(
    state.title &&
    state.abstract &&
    state.keywords.length >= 3 &&
    state.subspecialty
  )

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
              (step.number === 3 && step3Complete && currentStep > 3)
            const isCurrent = step.number === currentStep
            const isLocked = step.number > 3

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
                          : isLocked
                            ? 'bg-cream-alt text-taupe border-2 border-border'
                            : 'bg-cream text-tan border-2 border-border'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isLocked ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className={`text-xs mt-1.5 text-center hidden sm:block ${
                    isCurrent ? 'text-brown-dark font-medium' : isLocked ? 'text-taupe' : 'text-tan'
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

          {currentStep < 3 ? (
            <button
              onClick={goNext}
              disabled={
                saving ||
                (currentStep === 1 && !step1Complete) ||
                (currentStep === 2 && !step2Complete)
              }
              className="btn-primary-light disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              disabled
              className="btn-primary-light opacity-40 cursor-not-allowed"
              title="Steps 4 and 5 coming soon"
            >
              Next (Coming Soon)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
