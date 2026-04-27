'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveReviewDraft,
  submitReview,
  type ReviewSubmissionPayload,
} from '@/lib/reviewer/actions'
import type { ReviewRow, ReviewRecommendation } from '@/lib/types/database'

interface Props {
  token: string
  existingReview: ReviewRow | null
}

type ConflictLevel = 'none' | 'minor' | 'major'

// Session 35 (2026-04-26): the six Likert rating scales (Quality, Novelty,
// Rigor, Data, Clarity, Scope fit) were removed per Kanwar's directive. The
// reviewer's recommendation + freeform feedback now carry the entire review.
// The DB columns (quality_score / novelty_score / rigor_score / data_score /
// clarity_score / scope_score on `reviews`) were already nullable per
// migration 001; new rows land with NULL there, historical rows preserve
// their values for audit.

const RECOMMENDATIONS: Array<{
  value: ReviewRecommendation
  label: string
  blurb: string
}> = [
  {
    value: 'accept',
    label: 'Accept',
    blurb: 'Publishable as submitted (rare; use sparingly).',
  },
  {
    value: 'minor_revisions',
    label: 'Minor Revisions',
    blurb: 'Small clarifications; no re-review required.',
  },
  {
    value: 'major_revisions',
    label: 'Major Revisions',
    blurb: 'Substantive changes needed; expect re-review.',
  },
  {
    value: 'reject',
    label: 'Reject',
    blurb: 'Fundamental issues that cannot be addressed by revision.',
  },
]

interface FormState {
  recommendation: ReviewRecommendation | null
  commentsToAuthor: string
  commentsToEditor: string
  conflictLevel: ConflictLevel | null
  conflictDetails: string
}

function parseExistingConflict(
  text: string | null
): { level: ConflictLevel | null; details: string } {
  if (!text) return { level: null, details: '' }
  const lower = text.toLowerCase()
  if (lower.startsWith('none')) return { level: 'none', details: '' }
  if (lower.startsWith('minor')) {
    return {
      level: 'minor',
      details: text.replace(/^minor:?\s*/i, ''),
    }
  }
  if (lower.startsWith('major')) {
    return {
      level: 'major',
      details: text.replace(/^major:?\s*/i, ''),
    }
  }
  return { level: null, details: text }
}

function initialFormState(existing: ReviewRow | null): FormState {
  if (!existing) {
    return {
      recommendation: null,
      commentsToAuthor: '',
      commentsToEditor: '',
      conflictLevel: null,
      conflictDetails: '',
    }
  }
  const conflict = parseExistingConflict(existing.conflict_of_interest)
  return {
    recommendation: existing.recommendation,
    // Feedback now writes to comments_to_author so it surfaces to authors
    // through the revision Step 0 + decision-letter pipelines. Fall back to
    // comments_to_editor for any drafts saved under the prior column.
    commentsToAuthor:
      existing.comments_to_author || existing.comments_to_editor || '',
    commentsToEditor: '',
    conflictLevel: conflict.level,
    conflictDetails: conflict.details,
  }
}

function toPayload(state: FormState): ReviewSubmissionPayload {
  return {
    recommendation: state.recommendation,
    commentsToAuthor: state.commentsToAuthor,
    commentsToEditor: state.commentsToEditor,
    conflictLevel: state.conflictLevel,
    conflictDetails: state.conflictDetails,
  }
}

export default function ReviewSubmissionForm({ token, existingReview }: Props) {
  const router = useRouter()
  const [state, setState] = useState<FormState>(() =>
    initialFormState(existingReview)
  )
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const stateRef = useRef(state)
  stateRef.current = state

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  // Auto-save every 30 s when dirty.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isDirty) return
      try {
        const result = await saveReviewDraft(token, toPayload(stateRef.current))
        if (result.success) {
          setIsDirty(false)
          setSaveStatus(`Draft saved at ${new Date().toLocaleTimeString()}`)
        } else if (result.error) {
          setSaveStatus(`Draft not saved: ${result.error}`)
        }
      } catch {
        setSaveStatus('Draft auto-save temporarily unavailable.')
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [token, isDirty])

  function handleSaveDraft() {
    setError(null)
    startTransition(async () => {
      const result = await saveReviewDraft(token, toPayload(state))
      if (result.error) {
        setError(result.error)
        return
      }
      setIsDirty(false)
      setSaveStatus(`Draft saved at ${new Date().toLocaleTimeString()}`)
    })
  }

  function handleSubmit() {
    setError(null)

    // Client-side validation (server re-validates).
    if (!state.recommendation) {
      setError('Please choose a final recommendation.')
      return
    }
    if (!state.commentsToAuthor.trim()) {
      setError('Please paste your feedback and review regarding the manuscript.')
      return
    }
    if (!state.conflictLevel) {
      setError('Please disclose any conflict of interest.')
      return
    }
    if (
      (state.conflictLevel === 'minor' || state.conflictLevel === 'major') &&
      !state.conflictDetails.trim()
    ) {
      setError(
        'Please describe the conflict of interest (required for minor or major disclosures).'
      )
      return
    }

    startTransition(async () => {
      const result = await submitReview(token, toPayload(state))
      if (result.error) {
        setError(result.error)
        return
      }
      router.replace(`/review/${token}/form?submitted=1`)
    })
  }

  return (
    <div className="bg-white border border-border rounded-xl p-8 space-y-8">
      {/* Recommendation */}
      <div className="space-y-2">
        <h2 className="font-serif text-xl text-brown-dark">Recommendation</h2>
        <p className="text-sm text-brown">
          Your recommendation, not a consensus — the editor weighs this
          alongside the other reviewers.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          {RECOMMENDATIONS.map((rec) => {
            const checked = state.recommendation === rec.value
            return (
              <label
                key={rec.value}
                className={`cursor-pointer border rounded-lg px-3 py-3 transition-colors ${
                  checked
                    ? 'border-brown bg-peach-dark/30'
                    : 'border-border bg-white hover:border-tan'
                }`}
              >
                <input
                  type="radio"
                  name="recommendation"
                  value={rec.value}
                  checked={checked}
                  onChange={() => update('recommendation', rec.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-medium text-ink">
                  {rec.label}
                </span>
                <span className="block text-xs text-brown mt-0.5">
                  {rec.blurb}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Feedback and review */}
      <div className="space-y-2 border-t border-border pt-6">
        <label
          htmlFor="comments-to-author"
          className="block font-serif text-xl text-brown-dark"
        >
          Feedback and review
        </label>
        <p className="text-sm text-brown">
          Paste your feedback and review regarding the manuscript here.
        </p>
        <textarea
          id="comments-to-author"
          value={state.commentsToAuthor}
          onChange={(e) => update('commentsToAuthor', e.target.value)}
          rows={12}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
        />
      </div>

      {/* Conflict of interest */}
      <div className="space-y-2 border-t border-border pt-6">
        <h2 className="font-serif text-xl text-brown-dark">
          Conflict of interest
        </h2>
        <p className="text-sm text-brown">
          Disclose any financial, personal, or professional relationship that
          could bias this review.
        </p>
        <div className="grid sm:grid-cols-3 gap-2 mt-1">
          {(
            [
              { value: 'none', label: 'None' },
              { value: 'minor', label: 'Minor' },
              { value: 'major', label: 'Major' },
            ] as Array<{ value: ConflictLevel; label: string }>
          ).map((opt) => {
            const checked = state.conflictLevel === opt.value
            return (
              <label
                key={opt.value}
                className={`cursor-pointer border rounded-lg px-3 py-2 text-sm text-center transition-colors ${
                  checked
                    ? 'border-brown bg-peach-dark/30 text-ink'
                    : 'border-border bg-white text-brown hover:border-tan'
                }`}
              >
                <input
                  type="radio"
                  name="conflict"
                  value={opt.value}
                  checked={checked}
                  onChange={() => update('conflictLevel', opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            )
          })}
        </div>
        {(state.conflictLevel === 'minor' ||
          state.conflictLevel === 'major') && (
          <div className="mt-3">
            <label
              htmlFor="conflict-details"
              className="block text-[11px] uppercase tracking-widest text-brown mb-1"
            >
              Describe the conflict (required)
            </label>
            <textarea
              id="conflict-details"
              value={state.conflictDetails}
              onChange={(e) => update('conflictDetails', e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
            />
            <p className="text-[11px] text-brown mt-1">
              {state.conflictDetails.length}/500
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border pt-6 space-y-3">
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {saveStatus && !error && (
          <p className="text-xs text-brown">{saveStatus}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="btn-primary-light disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit review'}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isPending}
            className="btn-outline disabled:opacity-50"
          >
            Save as draft
          </button>
        </div>
        <p className="text-xs text-brown">
          Draft is also auto-saved every 30 seconds while you work.
        </p>
      </div>
    </div>
  )
}
