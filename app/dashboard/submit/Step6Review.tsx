'use client'

import { useState } from 'react'
import type { AuthorEntry } from './Step4Authors'
import type { ManuscriptType, ManuscriptFileRow } from '@/lib/types/database'

const MANUSCRIPT_TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Systematic Review & Meta-Analysis',
  narrative_review: 'Narrative Review',
}

const FILE_TYPE_LABELS: Record<string, string> = {
  blinded_manuscript: 'Blinded Manuscript',
  title_page: 'Title Page',
  tables: 'Tables',
  figure: 'Figure',
  supplement: 'Supplementary Material',
  cover_letter: 'Cover Letter',
  ethics_approval: 'Ethics Approval',
  care_checklist: 'CARE Checklist',
  sanra_self_rating: 'SANRA Self-Rating',
  prisma_checklist: 'PRISMA 2020 Checklist',
  jbi_case_series_checklist: 'JBI Case Series Checklist',
  tracked_changes: 'Tracked Changes',
  response_to_reviewers: 'Response to Reviewers',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface SuggestedReviewer {
  name: string
  email: string
  expertise: string
}

interface NonPreferredReviewer {
  name: string
  reason: string
}

interface Step6ReviewProps {
  // Step 1
  manuscriptType: ManuscriptType | null
  // Step 2
  files: ManuscriptFileRow[]
  // Step 3
  title: string
  abstract: string
  keywords: string[]
  subspecialty: string
  suggestedReviewers: SuggestedReviewer[]
  nonPreferredReviewers: NonPreferredReviewer[]
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
  aiToolsUsed: boolean | null
  aiToolsDetails: string
  noteToEditor: string
  // Callbacks
  onGoToStep: (step: number) => void
  onSubmit: () => void
  submitting: boolean
  submitError: string | null
  // Wizard-level completeness (computed by the parent)
  allComplete: boolean
  // Revising mode
  isRevising?: boolean
  revisionResponse?: string
}

export default function Step6Review({
  manuscriptType,
  files,
  title,
  abstract,
  keywords,
  subspecialty,
  suggestedReviewers,
  nonPreferredReviewers,
  authors,
  authorConsentCertified,
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
  onGoToStep,
  onSubmit,
  submitting,
  submitError,
  allComplete,
  isRevising,
  revisionResponse,
}: Step6ReviewProps) {
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const populatedSuggestedReviewers = suggestedReviewers.filter(
    (r) => r.name.trim() || r.email.trim() || r.expertise.trim()
  )
  const populatedNonPreferred = nonPreferredReviewers.filter(
    (r) => r.name.trim() || r.reason.trim()
  )

  const canSubmit = allComplete && reviewConfirmed && !submitting

  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">Review &amp; Submit</h2>
      <p className="text-sm text-brown mb-6">
        Take a final look at everything you&rsquo;ve entered. Once submitted,
        you cannot edit your manuscript &mdash; use the &ldquo;Edit&rdquo; link
        on each section if you need to change anything.
      </p>

      <div className="space-y-4 mb-8">
        {/* Step 1: Manuscript Type */}
        <div className="p-4 bg-white rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">Manuscript Type</h3>
            <button
              onClick={() => onGoToStep(1)}
              className="text-xs text-brown hover:underline"
            >
              Edit
            </button>
          </div>
          <p className="text-sm text-ink">
            {manuscriptType ? (
              MANUSCRIPT_TYPE_LABELS[manuscriptType] || manuscriptType
            ) : (
              <span className="text-red-500 text-xs">Not selected</span>
            )}
          </p>
        </div>

        {/* Step 2: Files */}
        <div className="p-4 bg-white rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">
              Uploaded Files ({files.length})
            </h3>
            <button
              onClick={() => onGoToStep(2)}
              className="text-xs text-brown hover:underline"
            >
              Edit
            </button>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-red-500">No files uploaded</p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="text-xs text-ink flex items-center gap-2"
                >
                  <svg
                    className="w-3.5 h-3.5 text-brown shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="truncate">{f.original_filename}</span>
                  <span className="text-taupe whitespace-nowrap">
                    ({FILE_TYPE_LABELS[f.file_type] || f.file_type},{' '}
                    {formatFileSize(f.file_size_bytes)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Step 3: Manuscript Info */}
        <div className="p-4 bg-white rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">
              Manuscript Information
            </h3>
            <button
              onClick={() => onGoToStep(3)}
              className="text-xs text-brown hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="space-y-1 text-xs text-ink">
            <p>
              <span className="font-medium">Title:</span>{' '}
              {title || <span className="text-red-500">Not provided</span>}
            </p>
            <p>
              <span className="font-medium">Abstract:</span>{' '}
              {abstract ? (
                `${abstract.slice(0, 200)}${abstract.length > 200 ? '…' : ''}`
              ) : (
                <span className="text-red-500">Not provided</span>
              )}
            </p>
            <p>
              <span className="font-medium">Keywords:</span>{' '}
              {keywords.length > 0 ? (
                keywords.join(', ')
              ) : (
                <span className="text-red-500">Not provided</span>
              )}
            </p>
            <p>
              <span className="font-medium">Subspecialty:</span>{' '}
              {subspecialty || (
                <span className="text-red-500">Not selected</span>
              )}
            </p>
            {!isRevising && populatedSuggestedReviewers.length > 0 && (
              <div>
                <span className="font-medium">Suggested reviewers:</span>
                <ul className="mt-0.5 pl-4 list-disc">
                  {populatedSuggestedReviewers.map((r, idx) => (
                    <li key={idx} className="text-ink">
                      {r.name}
                      {r.email ? ` <${r.email}>` : ''}
                      {r.expertise ? ` — ${r.expertise}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!isRevising && populatedNonPreferred.length > 0 && (
              <div>
                <span className="font-medium">Non-preferred reviewers:</span>
                <ul className="mt-0.5 pl-4 list-disc">
                  {populatedNonPreferred.map((r, idx) => (
                    <li key={idx} className="text-ink">
                      {r.name}
                      {r.reason ? ` — ${r.reason}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Step 4: Authors */}
        <div className="p-4 bg-white rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">
              Authors ({authors.length})
            </h3>
            <button
              onClick={() => onGoToStep(4)}
              className="text-xs text-brown hover:underline"
            >
              Edit
            </button>
          </div>
          {authors.length === 0 ? (
            <p className="text-xs text-red-500">No authors listed</p>
          ) : (
            <ul className="space-y-1">
              {authors.map((a, idx) => (
                <li key={idx} className="text-xs text-ink">
                  <span className="font-medium">
                    {idx + 1}. {a.full_name}
                  </span>
                  {a.is_corresponding && (
                    <span className="text-brown ml-1">(Corresponding)</span>
                  )}
                  {a.affiliation && (
                    <span className="text-brown ml-1">— {a.affiliation}</span>
                  )}
                  {a.contribution && (
                    <span className="text-taupe ml-1">| {a.contribution}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs mt-2 text-brown">
            Author certification:{' '}
            {authorConsentCertified ? (
              <span className="text-green-600">Confirmed</span>
            ) : (
              <span className="text-red-500">Not confirmed</span>
            )}
          </p>
        </div>

        {/* Step 5: Declarations */}
        <div className="p-4 bg-white rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink">Declarations</h3>
            <button
              onClick={() => onGoToStep(5)}
              className="text-xs text-brown hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="space-y-1 text-xs text-ink">
            <p>
              <span className="font-medium">Conflicts of Interest:</span>{' '}
              {noConflicts ? (
                'None declared'
              ) : (
                conflictOfInterest || (
                  <span className="text-red-500">Not provided</span>
                )
              )}
            </p>
            <p>
              <span className="font-medium">Funding:</span>{' '}
              {noFunding
                ? 'No external funding'
                : fundingSources.length > 0
                  ? fundingSources.join(', ')
                  : (
                      <span className="text-red-500">Not provided</span>
                    )}
            </p>
            <p>
              <span className="font-medium">Data Availability:</span>{' '}
              {dataAvailability || (
                <span className="text-red-500">Not selected</span>
              )}
              {dataAvailabilityUrl && ` (${dataAvailabilityUrl})`}
            </p>
            {ethicsInvolved && (
              <p>
                <span className="font-medium">Ethics Approval:</span>{' '}
                {ethicsApprovalNumber || (
                  <span className="text-red-500">Not provided</span>
                )}
              </p>
            )}
            {clinicalTrial && (
              <p>
                <span className="font-medium">Clinical Trial:</span>{' '}
                {clinicalTrialId || (
                  <span className="text-red-500">Not provided</span>
                )}
              </p>
            )}
            <p>
              <span className="font-medium">AI Tools Used:</span>{' '}
              {aiToolsUsed === null ? (
                <span className="text-red-500">
                  Not yet answered &mdash; return to Step 5 to pick one
                </span>
              ) : aiToolsUsed === true ? (
                aiToolsDetails.trim() || (
                  <span className="text-red-500">Description required</span>
                )
              ) : (
                'None declared'
              )}
            </p>
            {isRevising && revisionResponse !== undefined && (
              <p>
                <span className="font-medium">Response to Reviewers:</span>{' '}
                {(revisionResponse || '').trim().length >= 50 ? (
                  `${(revisionResponse || '').slice(0, 200)}${(revisionResponse || '').length > 200 ? '…' : ''}`
                ) : (
                  <span className="text-red-500">
                    Required (min 50 characters)
                  </span>
                )}
              </p>
            )}
            {noteToEditor && (
              <p>
                <span className="font-medium">Note to Editor:</span>{' '}
                {noteToEditor.slice(0, 200)}
                {noteToEditor.length > 200 ? '…' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Author confirmation checkbox */}
      <div className="bg-cream-alt border border-border rounded-lg p-4 mb-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewConfirmed}
            onChange={(e) => setReviewConfirmed(e.target.checked)}
            className="mt-0.5 accent-brown w-4 h-4 shrink-0"
          />
          <span className="text-sm text-ink leading-relaxed">
            I have fully reviewed my submission and would like to proceed.
            I understand that once submitted I cannot edit the manuscript,
            and that the editorial team will review my submission and notify
            me of their decision.
          </span>
        </label>
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
            <h3 className="font-serif text-lg text-brown-dark mb-2">
              Confirm Submission
            </h3>
            <p className="text-sm text-brown mb-6">
              Once submitted, you cannot edit your manuscript. The editorial
              team will review your submission and notify you of their
              decision. Are you sure you want to proceed?
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
        disabled={!canSubmit}
        className="w-full py-3.5 bg-brown-dark text-white font-semibold rounded-xl hover:bg-brown-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Submitting...
          </span>
        ) : isRevising ? (
          'Submit Revision'
        ) : (
          'Submit Manuscript'
        )}
      </button>

      {!allComplete && (
        <p className="text-xs text-red-500 text-center mt-2">
          Please complete all required fields across all steps before
          submitting.
        </p>
      )}
      {allComplete && !reviewConfirmed && (
        <p className="text-xs text-brown text-center mt-2">
          Check the confirmation box above to enable the Submit button.
        </p>
      )}
    </div>
  )
}
