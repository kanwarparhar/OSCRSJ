'use client'

import { useState, useCallback } from 'react'
import type { AuthorEntry } from './Step4Authors'
import type { ManuscriptType, ManuscriptFileRow } from '@/lib/types/database'

const DATA_AVAILABILITY_OPTIONS = [
  'All data are included in the manuscript',
  'Data available on reasonable request',
  'Data available in a public repository',
  'Not applicable',
]

const MANUSCRIPT_TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

const FILE_TYPE_LABELS: Record<string, string> = {
  manuscript: 'Main Manuscript',
  blinded_manuscript: 'Blinded Manuscript',
  figure: 'Figure',
  supplement: 'Supplementary Material',
  cover_letter: 'Cover Letter',
  ethics_approval: 'Ethics Approval',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Step5DeclarationsProps {
  // Declarations fields
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
  // Review summary data (read-only)
  manuscriptType: ManuscriptType | null
  files: ManuscriptFileRow[]
  title: string
  abstract: string
  keywords: string[]
  subspecialty: string
  authors: AuthorEntry[]
  authorConsentCertified: boolean
  // Callbacks
  onChange: (updates: Record<string, unknown>) => void
  onGoToStep: (step: number) => void
  onSubmit: () => void
  submitting: boolean
  submitError: string | null
  // Revising mode
  isRevising?: boolean
  revisionResponse?: string
  onRevisionResponseChange?: (value: string) => void
}

export default function Step5Declarations({
  conflictOfInterest,
  noConflicts,
  fundingSources,
  noFunding,
  dataAvailability,
  dataAvailabilityUrl,
  ethicsInvolved,
  ethicsApprovalNumber,
  clinicalTrial,
  clinicalTrialId,
  aiToolsUsed,
  aiToolsDetails,
  noteToEditor,
  manuscriptType,
  files,
  title,
  abstract,
  keywords,
  subspecialty,
  authors,
  authorConsentCertified,
  onChange,
  onGoToStep,
  onSubmit,
  submitting,
  submitError,
  isRevising,
  revisionResponse,
  onRevisionResponseChange,
}: Step5DeclarationsProps) {
  const [fundingInput, setFundingInput] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // ---- Funding sources tag input ----
  const addFundingSource = useCallback(() => {
    const source = fundingInput.trim()
    if (!source) return
    if (fundingSources.includes(source)) return
    onChange({ fundingSources: [...fundingSources, source] })
    setFundingInput('')
  }, [fundingInput, fundingSources, onChange])

  const removeFundingSource = (idx: number) => {
    onChange({ fundingSources: fundingSources.filter((_, i) => i !== idx) })
  }

  // ---- Validation ----
  const coiComplete = noConflicts || conflictOfInterest.trim().length > 0
  const fundingComplete = noFunding || fundingSources.length > 0
  const dataComplete = dataAvailability.length > 0 &&
    (dataAvailability !== 'Data available in a public repository' || dataAvailabilityUrl.trim().length > 0)
  const ethicsComplete = !ethicsInvolved || ethicsApprovalNumber.trim().length > 0
  const trialComplete = !clinicalTrial || clinicalTrialId.trim().length > 0
  const aiToolsComplete = !aiToolsUsed || aiToolsDetails.trim().length > 0

  const step5DeclarationsComplete = coiComplete && fundingComplete && dataComplete && ethicsComplete && trialComplete && aiToolsComplete

  // Full submission readiness
  const step1Complete = !!manuscriptType
  const step2Complete = isRevising
    ? files.some(f => f.file_type === 'manuscript') &&
      files.some(f => f.file_type === 'blinded_manuscript') &&
      files.some(f => f.file_type === 'tracked_changes') &&
      files.some(f => f.file_type === 'response_to_reviewers')
    : files.some(f => f.file_type === 'manuscript') && files.some(f => f.file_type === 'blinded_manuscript')
  const step3Complete = !!(title && abstract && keywords.length >= 3 && subspecialty)
  const step4Complete = authors.length >= 1 && authorConsentCertified
  const revisionResponseComplete =
    !isRevising || (revisionResponse || '').trim().length >= 50
  const allComplete =
    step1Complete &&
    step2Complete &&
    step3Complete &&
    step4Complete &&
    step5DeclarationsComplete &&
    revisionResponseComplete

  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">Declarations & Confirmation</h2>
      <p className="text-sm text-brown mb-6">
        Complete the required declarations, then review your entire submission before submitting.
      </p>

      {/* ============ Section A: Declarations ============ */}
      <div className="space-y-6 mb-8">

        {/* Conflict of Interest */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            Conflict of Interest <span className="text-red-500">*</span>
          </h3>
          <label className="flex items-start gap-3 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={noConflicts}
              onChange={(e) => {
                onChange({ noConflicts: e.target.checked, conflictOfInterest: '' })
              }}
              className="mt-0.5 accent-brown w-4 h-4"
            />
            <span className="text-sm text-ink">
              The authors declare no conflicts of interest
            </span>
          </label>
          {!noConflicts && (
            <textarea
              value={conflictOfInterest}
              onChange={(e) => onChange({ conflictOfInterest: e.target.value })}
              rows={3}
              placeholder="Describe any financial or personal conflicts of interest..."
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 resize-y"
            />
          )}
        </div>

        {/* Funding Sources */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            Funding Sources <span className="text-red-500">*</span>
          </h3>
          <label className="flex items-start gap-3 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={noFunding}
              onChange={(e) => {
                onChange({ noFunding: e.target.checked, fundingSources: [] })
              }}
              className="mt-0.5 accent-brown w-4 h-4"
            />
            <span className="text-sm text-ink">
              This work received no external funding
            </span>
          </label>
          {!noFunding && (
            <>
              {fundingSources.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {fundingSources.map((source, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-cream-alt text-ink text-sm rounded-full"
                    >
                      {source}
                      <button
                        onClick={() => removeFundingSource(idx)}
                        className="text-brown hover:text-red-500 ml-0.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fundingInput}
                  onChange={(e) => setFundingInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addFundingSource()
                    }
                  }}
                  placeholder="Enter funding source and press Enter"
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
                />
                <button
                  onClick={addFundingSource}
                  disabled={!fundingInput.trim()}
                  className="text-xs font-medium text-brown border border-brown/20 px-4 py-2 rounded-lg hover:bg-cream-alt transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </>
          )}
        </div>

        {/* Data Availability Statement */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            Data Availability Statement <span className="text-red-500">*</span>
          </h3>
          <select
            value={dataAvailability}
            onChange={(e) => onChange({ dataAvailability: e.target.value, dataAvailabilityUrl: '' })}
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 bg-white"
          >
            <option value="">Select a statement</option>
            {DATA_AVAILABILITY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {dataAvailability === 'Data available in a public repository' && (
            <input
              type="url"
              value={dataAvailabilityUrl}
              onChange={(e) => onChange({ dataAvailabilityUrl: e.target.value })}
              placeholder="https://doi.org/..."
              className="w-full mt-2 px-4 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
            />
          )}
        </div>

        {/* Ethics Approval */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">Ethics Approval</h3>
          <label className="flex items-start gap-3 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={ethicsInvolved}
              onChange={(e) => onChange({ ethicsInvolved: e.target.checked, ethicsApprovalNumber: '' })}
              className="mt-0.5 accent-brown w-4 h-4"
            />
            <span className="text-sm text-ink">
              This study involved human or animal subjects
            </span>
          </label>
          {ethicsInvolved && (
            <input
              type="text"
              value={ethicsApprovalNumber}
              onChange={(e) => onChange({ ethicsApprovalNumber: e.target.value })}
              placeholder="Ethics approval number (e.g., IRB-2026-001)"
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
            />
          )}
        </div>

        {/* Clinical Trial Registration */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">Clinical Trial Registration</h3>
          <label className="flex items-start gap-3 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={clinicalTrial}
              onChange={(e) => onChange({ clinicalTrial: e.target.checked, clinicalTrialId: '' })}
              className="mt-0.5 accent-brown w-4 h-4"
            />
            <span className="text-sm text-ink">
              This study is a registered clinical trial
            </span>
          </label>
          {clinicalTrial && (
            <input
              type="text"
              value={clinicalTrialId}
              onChange={(e) => onChange({ clinicalTrialId: e.target.value })}
              placeholder="Registration ID (e.g., NCT12345678)"
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
            />
          )}
        </div>

        {/* AI-Assisted Writing Disclosure */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            AI-Assisted Writing Disclosure <span className="text-red-500">*</span>
          </h3>
          <label className="flex items-start gap-3 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={aiToolsUsed}
              onChange={(e) => onChange({ aiToolsUsed: e.target.checked, aiToolsDetails: e.target.checked ? aiToolsDetails : '' })}
              className="mt-0.5 accent-brown w-4 h-4"
            />
            <span className="text-sm text-ink">
              AI writing tools were used in the preparation of this manuscript
            </span>
          </label>
          {aiToolsUsed && (
            <textarea
              value={aiToolsDetails}
              onChange={(e) => onChange({ aiToolsDetails: e.target.value })}
              rows={3}
              maxLength={500}
              placeholder="Describe tool(s), version(s), and how they were used (e.g., 'ChatGPT-4o for grammar check on Methods'; 'Claude 3.5 Sonnet for restructuring Introduction')."
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 resize-y"
            />
          )}
          <p className="text-xs text-brown mt-2 leading-relaxed">
            Authors remain fully responsible for the accuracy, integrity, and originality of all content, including any portions drafted with AI assistance.
          </p>
        </div>

        {/* Revision — Response to Reviewers (only in revising mode) */}
        {isRevising && (
          <div>
            <h3 className="text-sm font-semibold text-ink mb-2">
              Response to Reviewers <span className="text-red-500">*</span>
            </h3>
            <p className="text-xs text-brown mb-2">
              Brief summary of how you addressed each reviewer&rsquo;s comments.
              The full point-by-point response belongs in the uploaded
              response-to-reviewers file on Step 2; this is a short cover
              note for the editor (min 50 characters).
            </p>
            <textarea
              value={revisionResponse || ''}
              onChange={(e) =>
                onRevisionResponseChange &&
                onRevisionResponseChange(e.target.value)
              }
              rows={5}
              placeholder="E.g., 'We thank the reviewers for their constructive feedback. Reviewer A raised concerns about figure quality — we have re-rendered all radiographs at 600 DPI. Reviewer B asked for a longer discussion of alternative approaches; §Discussion now includes two paragraphs on conservative management...'"
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 resize-y"
            />
            <p className="text-[11px] text-brown mt-1">
              {(revisionResponse || '').trim().length} / 50 characters minimum
            </p>
          </div>
        )}

        {/* Note to Editor */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            {isRevising ? 'Note to Editor (this revision)' : 'Note to Editor'}
          </h3>
          <textarea
            value={noteToEditor}
            onChange={(e) => onChange({ noteToEditor: e.target.value })}
            rows={3}
            placeholder={
              isRevising
                ? 'Optional: context for the handling editor about this revision.'
                : 'Optional: share any additional context with the editorial office (e.g., why the case is noteworthy, time-sensitive considerations).'
            }
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 resize-y"
          />
        </div>
      </div>

      {/* ============ Section B: Final Review Summary ============ */}
      <div className="border-t border-border pt-6">
        <h2 className="font-serif text-xl text-brown-dark mb-4">Review Your Submission</h2>

        {/* Step 1: Manuscript Type */}
        <div className="mb-4 p-4 bg-white rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">Manuscript Type</h3>
            <button onClick={() => onGoToStep(1)} className="text-xs text-brown hover:underline">Edit</button>
          </div>
          <p className="text-sm text-ink">
            {manuscriptType ? MANUSCRIPT_TYPE_LABELS[manuscriptType] || manuscriptType : <span className="text-red-500 text-xs">Not selected</span>}
          </p>
        </div>

        {/* Step 2: Files */}
        <div className="mb-4 p-4 bg-white rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">Uploaded Files ({files.length})</h3>
            <button onClick={() => onGoToStep(2)} className="text-xs text-brown hover:underline">Edit</button>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-red-500">No files uploaded</p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.id} className="text-xs text-ink flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-brown shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{f.original_filename}</span>
                  <span className="text-taupe">({FILE_TYPE_LABELS[f.file_type] || f.file_type}, {formatFileSize(f.file_size_bytes)})</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Step 3: Manuscript Info */}
        <div className="mb-4 p-4 bg-white rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">Manuscript Information</h3>
            <button onClick={() => onGoToStep(3)} className="text-xs text-brown hover:underline">Edit</button>
          </div>
          <div className="space-y-1 text-xs text-ink">
            <p><span className="font-medium">Title:</span> {title || <span className="text-red-500">Not provided</span>}</p>
            <p><span className="font-medium">Abstract:</span> {abstract ? `${abstract.slice(0, 120)}...` : <span className="text-red-500">Not provided</span>}</p>
            <p><span className="font-medium">Keywords:</span> {keywords.length > 0 ? keywords.join(', ') : <span className="text-red-500">Not provided</span>}</p>
            <p><span className="font-medium">Subspecialty:</span> {subspecialty || <span className="text-red-500">Not selected</span>}</p>
          </div>
        </div>

        {/* Step 4: Authors */}
        <div className="mb-4 p-4 bg-white rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">Authors ({authors.length})</h3>
            <button onClick={() => onGoToStep(4)} className="text-xs text-brown hover:underline">Edit</button>
          </div>
          {authors.length === 0 ? (
            <p className="text-xs text-red-500">No authors listed</p>
          ) : (
            <ul className="space-y-1">
              {authors.map((a, idx) => (
                <li key={idx} className="text-xs text-ink">
                  <span className="font-medium">{idx + 1}. {a.full_name}</span>
                  {a.is_corresponding && <span className="text-brown ml-1">(Corresponding)</span>}
                  {a.affiliation && <span className="text-brown ml-1">— {a.affiliation}</span>}
                  {a.contribution && <span className="text-taupe ml-1">| {a.contribution}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs mt-2 text-brown">
            Author certification: {authorConsentCertified ? <span className="text-green-600">Confirmed</span> : <span className="text-red-500">Not confirmed</span>}
          </p>
        </div>

        {/* Step 5: Declarations */}
        <div className="mb-6 p-4 bg-white rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">Declarations</h3>
          </div>
          <div className="space-y-1 text-xs text-ink">
            <p>
              <span className="font-medium">Conflicts of Interest:</span>{' '}
              {noConflicts ? 'None declared' : (conflictOfInterest || <span className="text-red-500">Not provided</span>)}
            </p>
            <p>
              <span className="font-medium">Funding:</span>{' '}
              {noFunding ? 'No external funding' : (fundingSources.length > 0 ? fundingSources.join(', ') : <span className="text-red-500">Not provided</span>)}
            </p>
            <p>
              <span className="font-medium">Data Availability:</span>{' '}
              {dataAvailability || <span className="text-red-500">Not selected</span>}
              {dataAvailabilityUrl && ` (${dataAvailabilityUrl})`}
            </p>
            {ethicsInvolved && (
              <p><span className="font-medium">Ethics Approval:</span> {ethicsApprovalNumber || <span className="text-red-500">Not provided</span>}</p>
            )}
            {clinicalTrial && (
              <p><span className="font-medium">Clinical Trial:</span> {clinicalTrialId || <span className="text-red-500">Not provided</span>}</p>
            )}
            <p>
              <span className="font-medium">AI Tools Used:</span>{' '}
              {aiToolsUsed
                ? (aiToolsDetails.trim() || <span className="text-red-500">Description required</span>)
                : 'None declared'}
            </p>
            {noteToEditor && (
              <p><span className="font-medium">Note to Editor:</span> {noteToEditor.slice(0, 100)}{noteToEditor.length > 100 ? '...' : ''}</p>
            )}
          </div>
        </div>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <h3 className="font-serif text-lg text-brown-dark mb-2">Confirm Submission</h3>
            <p className="text-sm text-brown mb-6">
              Once submitted, you cannot edit your manuscript. The editorial team will review your submission and notify you of their decision. Are you sure you want to proceed?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={submitting}
                className="text-sm text-brown hover:text-ink px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmDialog(false)
                  onSubmit()
                }}
                disabled={submitting}
                className="btn-primary-light disabled:opacity-50"
              >
                {submitting
                  ? 'Submitting...'
                  : isRevising
                    ? 'Yes, Submit Revision'
                    : 'Yes, Submit Manuscript'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={() => setShowConfirmDialog(true)}
        disabled={!allComplete || submitting}
        className="w-full py-3.5 bg-brown-dark text-white font-semibold rounded-xl hover:bg-brown-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting...
          </span>
        ) : (
          isRevising ? 'Submit Revision' : 'Submit Manuscript'
        )}
      </button>

      {!allComplete && (
        <p className="text-xs text-red-500 text-center mt-2">
          Please complete all required fields across all steps before submitting.
        </p>
      )}
    </div>
  )
}
