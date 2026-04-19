'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { submitEditorialDecision } from '@/lib/admin/actions'
import type {
  EditorialDecisionType,
  ManuscriptStatus,
} from '@/lib/types/database'

interface Props {
  manuscriptId: string
  manuscriptStatus: ManuscriptStatus
  submissionId: string
  title: string
  reviewCount: number
}

type ComposerDecision =
  | 'accept'
  | 'minor_revisions'
  | 'major_revisions'
  | 'reject'

const DECIDABLE_STATUSES: ManuscriptStatus[] = [
  'submitted',
  'under_review',
  'revision_received',
]

const DECISION_LABELS: Record<ComposerDecision, string> = {
  accept: 'Accept',
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  reject: 'Reject',
}

const DECISION_TARGET_STATUS: Record<ComposerDecision, string> = {
  accept: 'accepted',
  minor_revisions: 'revision_requested',
  major_revisions: 'revision_requested',
  reject: 'desk_rejected',
}

const MIN_LETTER_LENGTH = 120

function defaultDeadline(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 60)
  return d.toISOString().slice(0, 10)
}

function tomorrowIso(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function maxDeadlineIso(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 180)
  return d.toISOString().slice(0, 10)
}

function fillTemplate(
  template: string,
  tokens: { title: string; submission_id: string; deadline: string }
): string {
  return template
    .replace(/\{\{title\}\}/g, tokens.title)
    .replace(/\{\{submission_id\}\}/g, tokens.submission_id)
    .replace(/\{\{deadline\}\}/g, tokens.deadline)
}

const TEMPLATES: Record<ComposerDecision, string> = {
  accept: `Dear Authors,

It is my pleasure to inform you that your manuscript "{{title}}" (submission {{submission_id}}) has been accepted for publication in the Orthopedic Surgery Case Reports & Series Journal.

The reviewers and editors agreed that the work is sound, the clinical contribution is clear, and the presentation meets OSCRSJ's standards. No further revisions are required.

Our editorial team will be in touch about copyediting, proof review, and — where applicable — APC invoicing. There is nothing further for you to do at this point.

Thank you for choosing OSCRSJ as the home for this work.

Sincerely,
The OSCRSJ Editorial Office`,
  minor_revisions: `Dear Authors,

Thank you for submitting "{{title}}" (submission {{submission_id}}) to OSCRSJ. Your manuscript has been reviewed, and I am pleased to offer conditional acceptance pending minor revisions.

Please address each reviewer comment point-by-point in a response-to-reviewers letter, upload a revised manuscript along with a tracked-changes file, and return the revision by {{deadline}}.

The reviewer comments are constructive and should be straightforward to incorporate. A second round of external review is not anticipated — the editorial office will verify that the comments have been addressed and then move the manuscript toward acceptance.

Sincerely,
The OSCRSJ Editorial Office`,
  major_revisions: `Dear Authors,

Thank you for submitting "{{title}}" (submission {{submission_id}}) to OSCRSJ. The reviewers and editors have identified substantive issues that need to be resolved before a publication decision can be reached. I am returning the manuscript for major revisions.

Please address each reviewer comment point-by-point in a response-to-reviewers letter, upload a revised manuscript along with a tracked-changes file, and return the revision by {{deadline}}. The revised manuscript will likely be sent back to the original reviewers for a second round of review.

Substantive changes to the manuscript — including to the data, analysis, or conclusions — are appropriate and welcome. If you feel any reviewer comment is unwarranted, please explain your reasoning in the response letter rather than leaving it unaddressed.

Sincerely,
The OSCRSJ Editorial Office`,
  reject: `Dear Authors,

Thank you for submitting "{{title}}" (submission {{submission_id}}) to the Orthopedic Surgery Case Reports & Series Journal. After careful consideration of the peer reviews and editorial assessment, I regret to inform you that we are unable to accept the manuscript for publication.

The reviewers provided detailed, constructive feedback in their comments to authors, and I encourage you to consult those comments as you refine the work for a different venue.

This decision is not taken lightly. We recognise the effort that goes into every submission, and we thank you for considering OSCRSJ.

Sincerely,
The OSCRSJ Editorial Office`,
}

const DESK_REJECT_TEMPLATE = `Dear Authors,

Thank you for submitting "{{title}}" (submission {{submission_id}}) to the Orthopedic Surgery Case Reports & Series Journal. After editorial review, I have decided that the manuscript is not a fit for OSCRSJ and will not proceed to external peer review.

[State the specific reason the manuscript is being returned without review — scope mismatch, methodological concern, ethics issue, overlap with published work, etc.]

Desk decisions are issued without peer review when the editorial team can foresee that external review would not change the outcome. We recognise this is disappointing and wish you success as you place the work with a better-suited venue.

Sincerely,
The OSCRSJ Editorial Office`

export default function DecisionComposerPanel({
  manuscriptId,
  manuscriptStatus,
  submissionId,
  title,
  reviewCount,
}: Props) {
  const router = useRouter()
  const decidable = DECIDABLE_STATUSES.includes(manuscriptStatus)
  const deskRejectEligible =
    manuscriptStatus === 'submitted' && reviewCount === 0

  const [decision, setDecision] = useState<ComposerDecision>('minor_revisions')
  const [letter, setLetter] = useState('')
  const [deadline, setDeadline] = useState(defaultDeadline())
  const [confirmed, setConfirmed] = useState(false)
  const [deskRejectMode, setDeskRejectMode] = useState(false)
  const [deskRejectConfirmOpen, setDeskRejectConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const requiresDeadline =
    !deskRejectMode &&
    (decision === 'minor_revisions' || decision === 'major_revisions')

  const deadlineLabel = useMemo(() => {
    if (!deadline) return '(choose a date)'
    try {
      return new Date(`${deadline}T00:00:00Z`).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return deadline
    }
  }, [deadline])

  const letterLength = letter.trim().length
  const letterValid = letterLength >= MIN_LETTER_LENGTH
  const canSubmit =
    decidable &&
    letterValid &&
    confirmed &&
    (deskRejectMode || decision) &&
    (!requiresDeadline || !!deadline)

  const targetStatus = deskRejectMode
    ? 'desk_rejected'
    : DECISION_TARGET_STATUS[decision]

  function flash(msg: string, err = false) {
    setMessage(msg)
    setIsError(err)
    if (!err) setTimeout(() => setMessage(null), 5000)
  }

  function loadTemplate() {
    const tokens = {
      title,
      submission_id: submissionId,
      deadline: deadlineLabel,
    }
    const template = deskRejectMode
      ? DESK_REJECT_TEMPLATE
      : TEMPLATES[decision]
    setLetter(fillTemplate(template, tokens))
  }

  function handleDeskRejectClick() {
    setDeskRejectConfirmOpen(true)
  }

  function enterDeskRejectMode() {
    setDeskRejectMode(true)
    setDeskRejectConfirmOpen(false)
    setLetter('')
    setConfirmed(false)
    setMessage(null)
  }

  function exitDeskRejectMode() {
    setDeskRejectMode(false)
    setLetter('')
    setConfirmed(false)
    setMessage(null)
  }

  function onSubmit() {
    if (!canSubmit) return

    const decisionType: EditorialDecisionType = deskRejectMode
      ? 'desk_reject'
      : (decision as EditorialDecisionType)

    startTransition(async () => {
      const result = await submitEditorialDecision({
        manuscriptId,
        decision: decisionType,
        decisionLetter: letter,
        revisionDeadline: requiresDeadline
          ? new Date(`${deadline}T23:59:59Z`).toISOString()
          : null,
      })
      if (!result.ok) {
        flash(result.error || 'Failed to submit decision.', true)
        return
      }
      flash('Decision recorded and author notified.')
      setLetter('')
      setConfirmed(false)
      setDeskRejectMode(false)
      router.refresh()
    })
  }

  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg text-brown-dark">
            Issue editorial decision
          </h2>
          <p className="text-xs text-brown mt-1 max-w-xl">
            Accept, request revisions, or reject. The decision letter is
            delivered to the corresponding author and recorded in the
            manuscript history below. Decisions are immutable.
          </p>
        </div>
        {!decidable && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
            Status &ldquo;{manuscriptStatus.replace(/_/g, ' ')}&rdquo; &mdash;
            decisions disabled.
          </span>
        )}
      </div>

      {decidable && reviewCount === 0 && !deskRejectMode && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
          No reviews have been submitted yet. You may still issue a decision
          at your discretion.
        </div>
      )}

      {deskRejectMode && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded flex items-start justify-between gap-3">
          <span>
            <strong>Desk-reject mode.</strong> Manuscript will be returned
            without external peer review. Please state the reasoning in the
            letter below.
          </span>
          <button
            type="button"
            onClick={exitDeskRejectMode}
            className="text-red-700 underline underline-offset-2 hover:text-red-900"
          >
            Cancel desk reject
          </button>
        </div>
      )}

      {!deskRejectMode && (
        <fieldset disabled={!decidable || isPending} className="space-y-2">
          <legend className="block text-[11px] uppercase tracking-widest text-brown mb-1">
            Decision type
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(['accept', 'minor_revisions', 'major_revisions', 'reject'] as ComposerDecision[]).map(
              (d) => (
                <label
                  key={d}
                  className={`flex items-start gap-2 border rounded-lg p-3 cursor-pointer transition-colors ${
                    decision === d
                      ? 'border-brown bg-cream/60'
                      : 'border-border hover:border-tan'
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={d}
                    checked={decision === d}
                    onChange={() => {
                      setDecision(d)
                      setConfirmed(false)
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm text-ink font-medium">
                      {DECISION_LABELS[d]}
                    </p>
                    <p className="text-[11px] text-brown">
                      Status → {DECISION_TARGET_STATUS[d].replace(/_/g, ' ')}
                    </p>
                  </div>
                </label>
              )
            )}
          </div>
        </fieldset>
      )}

      {requiresDeadline && (
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
            Revision deadline
          </label>
          <input
            type="date"
            value={deadline}
            min={tomorrowIso()}
            max={maxDeadlineIso()}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={!decidable || isPending}
            className="border border-border rounded-lg px-3 py-1.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
          />
          <p className="text-[11px] text-brown mt-1">
            Default +60 days. Authors receive this date in the decision email
            and on their dashboard.
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[11px] uppercase tracking-widest text-brown">
            Decision letter (markdown / plain text)
          </label>
          <button
            type="button"
            onClick={loadTemplate}
            disabled={!decidable || isPending}
            className="text-[11px] text-brown border border-brown/20 px-2 py-1 rounded hover:bg-cream disabled:opacity-50"
          >
            Load template
          </button>
        </div>
        <textarea
          value={letter}
          onChange={(e) => {
            setLetter(e.target.value)
            setConfirmed(false)
          }}
          disabled={!decidable || isPending}
          rows={14}
          className="w-full border border-border rounded-lg px-3 py-2 font-mono text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
        />
        <p
          className={`text-[11px] mt-1 ${
            letterValid ? 'text-brown' : 'text-amber-700'
          }`}
        >
          {letterLength} characters &middot; minimum {MIN_LETTER_LENGTH}
        </p>
      </div>

      <div className="bg-cream/50 border border-border rounded-lg p-3 text-xs text-ink">
        <p className="mb-1">
          <span className="text-[11px] uppercase tracking-widest text-brown">
            Status transition
          </span>
        </p>
        <p>
          <code className="font-mono">
            {manuscriptStatus.replace(/_/g, ' ')}
          </code>{' '}
          →{' '}
          <code className="font-mono font-semibold">
            {targetStatus.replace(/_/g, ' ')}
          </code>
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={!decidable || isPending || !letterValid}
          className="mt-0.5"
        />
        <span>
          I have reviewed this decision letter. Submitting will email the
          corresponding author and transition the manuscript status.
        </span>
      </label>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isPending}
            className="text-sm px-4 py-2 rounded-lg border border-brown bg-peach-dark text-ink hover:bg-peach disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            {isPending ? 'Submitting…' : 'Submit decision'}
          </button>
          {!deskRejectMode && deskRejectEligible && (
            <button
              type="button"
              onClick={handleDeskRejectClick}
              disabled={isPending}
              className="text-xs text-red-700 border border-red-200 bg-red-50 px-2 py-1 rounded hover:bg-red-100 disabled:opacity-50"
            >
              Desk reject without review
            </button>
          )}
        </div>
        {message && (
          <p
            className={`text-sm ${
              isError ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {deskRejectConfirmOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-border shadow-lg max-w-md w-full p-6 space-y-4">
            <h3 className="font-serif text-lg text-brown-dark">
              Desk reject without external review?
            </h3>
            <p className="text-sm text-ink">
              This returns the manuscript to the author without sending it to
              reviewers. It should be reserved for clear scope mismatches,
              ethical concerns, or prior-publication overlap. The decision is
              recorded in the manuscript history and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeskRejectConfirmOpen(false)}
                className="text-sm px-3 py-1.5 rounded-lg border border-border text-brown hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={enterDeskRejectMode}
                className="text-sm px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
