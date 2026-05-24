'use client'

import { useState, useCallback } from 'react'

const DATA_AVAILABILITY_OPTIONS = [
  'All data are included in the manuscript',
  'Data available on reasonable request',
  'Data available in a public repository',
  'Not applicable',
]

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
  // Tri-state: null = author hasn't picked either AI radio yet.
  aiToolsUsed: boolean | null
  aiToolsDetails: string
  noteToEditor: string
  // Callbacks
  onChange: (updates: Record<string, unknown>) => void
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
  onChange,
  isRevising,
  revisionResponse,
  onRevisionResponseChange,
}: Step5DeclarationsProps) {
  const [fundingInput, setFundingInput] = useState('')

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

  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">Declarations</h2>
      <p className="text-sm text-brown mb-6">
        Complete the required declarations below. On the next step you
        will be able to review your entire submission before submitting.
      </p>

      {/* ============ Declarations ============ */}
      <div className="space-y-6">

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
          <p className="text-xs text-brown mb-3">
            Please indicate whether AI writing tools (ChatGPT, Claude, Gemini,
            Copilot, etc.) were used in the preparation of this manuscript.
            Both options are required answers — pick the one that applies.
          </p>

          <div className="space-y-2 mb-3">
            <label className="flex items-start gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-cream-alt/40 transition-colors">
              <input
                type="radio"
                name="ai-disclosure"
                checked={aiToolsUsed === false}
                onChange={() =>
                  onChange({ aiToolsUsed: false, aiToolsDetails: '' })
                }
                className="mt-0.5 accent-brown w-4 h-4"
              />
              <span className="text-sm text-ink">
                I did not use AI writing tools in the preparation of this manuscript
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-cream-alt/40 transition-colors">
              <input
                type="radio"
                name="ai-disclosure"
                checked={aiToolsUsed === true}
                onChange={() => onChange({ aiToolsUsed: true })}
                className="mt-0.5 accent-brown w-4 h-4"
              />
              <span className="text-sm text-ink">
                AI writing tools were used in the preparation of this manuscript
              </span>
            </label>
          </div>

          {aiToolsUsed === true && (
            <div className="mb-2">
              <label className="block text-xs font-medium text-ink mb-1">
                Describe how AI tools were used <span className="text-red-500">*</span>
              </label>
              <textarea
                value={aiToolsDetails}
                onChange={(e) => onChange({ aiToolsDetails: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="Describe tool(s), version(s), and how they were used (e.g., 'ChatGPT-4o for grammar check on Methods'; 'Claude 3.5 Sonnet for restructuring Introduction')."
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 resize-y"
              />
              <p className="text-[11px] text-brown mt-1 text-right">
                {aiToolsDetails.length} / 500 characters
              </p>
            </div>
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
    </div>
  )
}

// --- HISTORICAL NOTE ---
// The Final Review Summary section, the Submit button, and the
// confirmation dialog used to live in this file. They moved to
// Step6Review.tsx so authors get a dedicated final review step
// rather than the previous "stuff everything onto Step 5" layout.
// Legacy block intentionally removed; nothing below this comment.
