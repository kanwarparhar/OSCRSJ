'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  submitEditorialDecision,
  rescindEditorialDecision,
  previewReviewerFeedback,
} from '@/lib/admin/actions'
import type {
  EditorialDecisionType,
  ManuscriptStatus,
} from '@/lib/types/database'

// Session 13 — passed in from the server page when the most recent
// editorial_decisions row on this manuscript:
//   - was issued by the currently-authed editor
//   - is within the 15-min rescind window
//   - has rescinded_at IS NULL
// When all three are true, the composer renders an "Undo decision"
// affordance directly above the form.
export interface RescindableDecision {
  id: string
  decisionDateIso: string
  decisionLabel: string
  // ISO time when the rescind window expires (decision_date + 15min).
  // Used by the client to show a live countdown and auto-hide the
  // button once it passes.
  rescindWindowEndsIso: string
}

interface Props {
  manuscriptId: string
  manuscriptStatus: ManuscriptStatus
  submissionId: string
  title: string
  reviewCount: number
  rescindable?: RescindableDecision | null
}

const MIN_RESCIND_REASON = 50

// Composer-side decision union. Maps to EditorialDecisionType when
// submitting. `post_review_reject` is for rejections issued after
// external review (Session 13). `desk_reject` (Session 65) is now a
// peer radio option for rejections issued before external review —
// scope mismatch, formatting non-compliance, ethical concerns, prior
// overlap, etc. — and only renders selectable when the manuscript is
// still in `submitted` status with no reviews submitted yet.
type ComposerDecision =
  | 'accept'
  | 'minor_revisions'
  | 'major_revisions'
  | 'post_review_reject'
  | 'desk_reject'

const DECIDABLE_STATUSES: ManuscriptStatus[] = [
  'submitted',
  'under_review',
  'revision_received',
]

const DECISION_LABELS: Record<ComposerDecision, string> = {
  accept: 'Accept',
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  post_review_reject: 'Reject (post-review)',
  desk_reject: 'Reject (without external review)',
}

const DECISION_TARGET_STATUS: Record<ComposerDecision, string> = {
  accept: 'accepted',
  minor_revisions: 'revision_requested',
  major_revisions: 'revision_requested',
  post_review_reject: 'rejected',
  desk_reject: 'desk_rejected',
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
  // post_review_reject + desk_reject templates live at the bottom of
  // this object. The desk_reject template (Session 65, formerly the
  // standalone DESK_REJECT_TEMPLATE constant) contains a bracket
  // placeholder so editors can paste in the actual rationale —
  // scope, formatting, ethics, methods, overlap, etc.
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
  post_review_reject: `Dear Authors,

Thank you for submitting "{{title}}" (submission {{submission_id}}) to the Orthopedic Surgery Case Reports & Series Journal. After careful consideration of the peer reviews and editorial assessment, I regret to inform you that we are unable to accept the manuscript for publication.

The reviewers provided detailed, constructive feedback in their comments to authors, and I encourage you to consult those comments as you refine the work for a different venue.

This decision is not taken lightly. We recognise the effort that goes into every submission, and we thank you for considering OSCRSJ.

Sincerely,
The OSCRSJ Editorial Office`,
  desk_reject: `Dear Authors,

Thank you for submitting "{{title}}" (submission {{submission_id}}) to the Orthopedic Surgery Case Reports & Series Journal. After editorial review, I have decided that the manuscript is not a fit for OSCRSJ and will not proceed to external peer review.

[State the specific reason the manuscript is being returned without review — for example: scope mismatch with OSCRSJ's aims, formatting that does not meet the Guide for Authors, methodological concern, ethics issue, or substantial overlap with previously published work. Where applicable, describe the specific changes the authors would need to make before any future resubmission would be considered.]

Desk decisions are issued without peer review when the editorial team can foresee that external review would not change the outcome. We recognise this is disappointing and wish you success as you place the work with a better-suited venue.

Sincerely,
The OSCRSJ Editorial Office`,
}

export default function DecisionComposerPanel({
  manuscriptId,
  manuscriptStatus,
  submissionId,
  title,
  reviewCount,
  rescindable,
}: Props) {
  const router = useRouter()
  const decidable = DECIDABLE_STATUSES.includes(manuscriptStatus)
  const deskRejectEligible =
    manuscriptStatus === 'submitted' && reviewCount === 0

  const [decision, setDecision] = useState<ComposerDecision>('minor_revisions')
  const [letter, setLetter] = useState('')
  const [deadline, setDeadline] = useState(defaultDeadline())
  const [confirmed, setConfirmed] = useState(false)
  const [reInviteReviewers, setReInviteReviewers] = useState(false)
  // Safety modal for desk_reject — opens on Submit click when
  // `decision === 'desk_reject'`; the user clicks Continue to
  // dispatch the actual transaction.
  const [deskRejectConfirmOpen, setDeskRejectConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  // ---- Rescind window state ----
  const [rescindOpen, setRescindOpen] = useState(false)
  const [rescindReason, setRescindReason] = useState('')
  const [isRescinding, startRescind] = useTransition()
  const [rescindWindowExpired, setRescindWindowExpired] = useState(() => {
    if (!rescindable) return true
    return Date.now() >= new Date(rescindable.rescindWindowEndsIso).getTime()
  })

  // ---- Reviewer feedback attachment (Minor / Major Revisions only) ----
  // Editor reviews the auto-generated reviewer-feedback.docx by
  // clicking Preview → browser download. If they want to edit it
  // before the author sees it, they edit in Word and re-upload as
  // an override; submitEditorialDecision will use the override
  // instead of regenerating fresh.
  const isRevisionDecision =
    decision === 'minor_revisions' || decision === 'major_revisions'
  const [feedbackPreviewLoading, setFeedbackPreviewLoading] = useState(false)
  const [feedbackPreviewMessage, setFeedbackPreviewMessage] = useState<
    string | null
  >(null)
  const [feedbackPreviewIsError, setFeedbackPreviewIsError] = useState(false)
  // Last-known reviewer count from the most recent preview call.
  // null = not yet previewed; -1 = previewed and was empty (no
  // reviewer comments yet on this manuscript).
  const [feedbackReviewerCount, setFeedbackReviewerCount] = useState<
    number | null
  >(null)
  // Editor's uploaded override. When non-null, this ships as the
  // attachment INSTEAD of the auto-generated version.
  const [feedbackOverride, setFeedbackOverride] = useState<{
    filename: string
    contentBase64: string
    sizeBytes: number
  } | null>(null)

  const requiresDeadline =
    decision === 'minor_revisions' || decision === 'major_revisions'

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
  // Desk reject is a peer radio option, but it only renders selectable
  // when this manuscript is still in 'submitted' and has zero submitted
  // reviews. If the user somehow has it picked while ineligible (state
  // race), block submit.
  const deskRejectGateOk =
    decision !== 'desk_reject' || deskRejectEligible

  const canSubmit =
    decidable &&
    letterValid &&
    confirmed &&
    deskRejectGateOk &&
    (!requiresDeadline || !!deadline)

  const targetStatus = DECISION_TARGET_STATUS[decision]

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
    setLetter(fillTemplate(TEMPLATES[decision], tokens))
  }

  // Trigger an in-browser download from a base64 .docx blob
  // returned by the previewReviewerFeedback server action.
  function downloadDocxFromBase64(filename: string, base64: string) {
    try {
      const bin = atob(base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], {
        type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Small delay before revoking so the browser has the blob
      // committed to the download stream.
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown download error.'
      setFeedbackPreviewMessage(`Download failed: ${msg}`)
      setFeedbackPreviewIsError(true)
    }
  }

  async function handlePreviewFeedback() {
    setFeedbackPreviewLoading(true)
    setFeedbackPreviewMessage(null)
    setFeedbackPreviewIsError(false)
    try {
      const result = await previewReviewerFeedback({ manuscriptId })
      if (!result.ok) {
        setFeedbackPreviewMessage(
          result.error || 'Failed to generate preview.'
        )
        setFeedbackPreviewIsError(true)
        setFeedbackReviewerCount(null)
        return
      }
      if (result.empty || !result.filename || !result.contentBase64) {
        setFeedbackReviewerCount(-1)
        setFeedbackPreviewMessage(
          'No completed reviewer comments are available yet for this manuscript. No attachment will be sent.'
        )
        setFeedbackPreviewIsError(false)
        return
      }
      setFeedbackReviewerCount(result.reviewerCount ?? null)
      downloadDocxFromBase64(result.filename, result.contentBase64)
      setFeedbackPreviewMessage(
        `Downloaded ${result.filename}. Review (and optionally edit) before submitting the decision.`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error.'
      setFeedbackPreviewMessage(msg)
      setFeedbackPreviewIsError(true)
    } finally {
      setFeedbackPreviewLoading(false)
    }
  }

  async function handleOverrideFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files && e.target.files[0]
    // Reset the input so re-selecting the same file fires onChange again.
    if (e.target.value) e.target.value = ''
    if (!file) return
    // 22 MB raw byte cap, matches lib/admin/actions.ts server-side check.
    const MAX_BYTES = 22 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      setFeedbackPreviewMessage(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 22 MB.`
      )
      setFeedbackPreviewIsError(true)
      return
    }
    if (
      !file.name.toLowerCase().endsWith('.docx') &&
      file.type !==
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      setFeedbackPreviewMessage(
        'Only .docx files are accepted as an override.'
      )
      setFeedbackPreviewIsError(true)
      return
    }
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const idx = dataUrl.indexOf(',')
      const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : ''
      if (!base64) {
        setFeedbackPreviewMessage('Could not read uploaded file.')
        setFeedbackPreviewIsError(true)
        return
      }
      setFeedbackOverride({
        filename: file.name,
        contentBase64: base64,
        sizeBytes: file.size,
      })
      setFeedbackPreviewMessage(
        `Override applied: ${file.name}. This edited file will be attached to the decision email.`
      )
      setFeedbackPreviewIsError(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error.'
      setFeedbackPreviewMessage(`Override upload failed: ${msg}`)
      setFeedbackPreviewIsError(true)
    }
  }

  function handleClearOverride() {
    setFeedbackOverride(null)
    setFeedbackPreviewMessage(
      'Override cleared. The auto-generated reviewer feedback document will be attached when you submit.'
    )
    setFeedbackPreviewIsError(false)
  }

  // The Submit-decision click path. For every decision type except
  // desk_reject we dispatch the transaction immediately. For
  // desk_reject we open the safety confirmation modal first; the
  // modal's Continue button then calls dispatchSubmit().
  function onSubmit() {
    if (!canSubmit) return
    if (decision === 'desk_reject') {
      setDeskRejectConfirmOpen(true)
      return
    }
    dispatchSubmit()
  }

  function dispatchSubmit() {
    if (!canSubmit) return
    const decisionType = decision as EditorialDecisionType

    startTransition(async () => {
      const result = await submitEditorialDecision({
        manuscriptId,
        decision: decisionType,
        decisionLetter: letter,
        revisionDeadline: requiresDeadline
          ? new Date(`${deadline}T23:59:59Z`).toISOString()
          : null,
        reInviteOriginalReviewers:
          decision === 'major_revisions' && reInviteReviewers,
        reviewerFeedbackOverride:
          isRevisionDecision && feedbackOverride
            ? {
                filename: feedbackOverride.filename,
                contentBase64: feedbackOverride.contentBase64,
              }
            : null,
      })
      if (!result.ok) {
        flash(result.error || 'Failed to submit decision.', true)
        return
      }
      const reInviteLine =
        result.reInvited && result.reInvited > 0
          ? ` ${result.reInvited} reviewer${result.reInvited === 1 ? '' : 's'} re-invited for round 2.`
          : ''
      flash(`Decision recorded and author notified.${reInviteLine}`)
      setLetter('')
      setConfirmed(false)
      setReInviteReviewers(false)
      setFeedbackOverride(null)
      setFeedbackReviewerCount(null)
      setFeedbackPreviewMessage(null)
      setDeskRejectConfirmOpen(false)
      router.refresh()
    })
  }

  function onRescindConfirm() {
    if (!rescindable) return
    const trimmed = rescindReason.trim()
    if (trimmed.length < MIN_RESCIND_REASON) return
    startRescind(async () => {
      const result = await rescindEditorialDecision({
        decisionId: rescindable.id,
        reason: trimmed,
      })
      if (!result.ok) {
        flash(result.error || 'Failed to rescind decision.', true)
        return
      }
      const restored = result.restoredStatus
        ? ` Status reverted to "${result.restoredStatus.replace(/_/g, ' ')}".`
        : ''
      flash(`Decision rescinded.${restored}`)
      setRescindOpen(false)
      setRescindReason('')
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

      {rescindable && !rescindWindowExpired && (
        <RescindBanner
          rescindable={rescindable}
          onOpenModal={() => {
            setRescindReason('')
            setRescindOpen(true)
          }}
          onWindowExpired={() => setRescindWindowExpired(true)}
          isPending={isRescinding}
        />
      )}

      {decidable && reviewCount === 0 && decision !== 'desk_reject' && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
          No reviews have been submitted yet. You may still issue a decision
          at your discretion.
        </div>
      )}

      {decision === 'desk_reject' && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded">
          <strong>Reject without external review.</strong> This returns the
          manuscript to the author <em>without</em> sending it to peer
          reviewers, and is reserved for clear scope mismatches, formatting
          non-compliance, ethical concerns, or substantial overlap with
          published work. State the full rationale and any actionable
          guidance for the authors in the letter below. The decision letter
          is delivered verbatim inside the email to the corresponding
          author.
        </div>
      )}

      <fieldset disabled={!decidable || isPending} className="space-y-2">
        <legend className="block text-[11px] uppercase tracking-widest text-brown mb-1">
          Decision type
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            [
              'accept',
              'minor_revisions',
              'major_revisions',
              'post_review_reject',
            ] as ComposerDecision[]
          ).map((d) => (
            <label
              key={d}
              className={`flex items-start gap-2 border rounded-lg p-3 cursor-pointer transition-colors ${
                decision === d
                  ? 'border-brown bg-cream-alt/60'
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
          ))}
          {/* Desk reject — full-width 5th option, visually distinct.
              Disabled when the manuscript is no longer eligible (status
              moved past 'submitted' OR at least one review submitted). */}
          <label
            key="desk_reject"
            className={`sm:col-span-2 flex items-start gap-2 border rounded-lg p-3 transition-colors ${
              !deskRejectEligible
                ? 'border-border bg-cream-alt/30 opacity-60 cursor-not-allowed'
                : decision === 'desk_reject'
                  ? 'border-red-400 bg-red-50/60 cursor-pointer'
                  : 'border-red-200 hover:border-red-400 cursor-pointer'
            }`}
            title={
              !deskRejectEligible
                ? 'Available only before peer review (status "submitted" with no submitted reviews).'
                : undefined
            }
          >
            <input
              type="radio"
              name="decision"
              value="desk_reject"
              checked={decision === 'desk_reject'}
              disabled={!deskRejectEligible}
              onChange={() => {
                setDecision('desk_reject')
                setConfirmed(false)
              }}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm text-ink font-medium">
                {DECISION_LABELS.desk_reject}
              </p>
              <p className="text-[11px] text-brown">
                Status → {DECISION_TARGET_STATUS.desk_reject.replace(/_/g, ' ')}
                {!deskRejectEligible && (
                  <span className="ml-2 italic">
                    (available only before peer review)
                  </span>
                )}
              </p>
            </div>
          </label>
        </div>
      </fieldset>

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

      {decision === 'major_revisions' && (
        <label className="flex items-start gap-2 text-sm text-ink bg-cream-alt/40 border border-border rounded-lg p-3">
          <input
            type="checkbox"
            checked={reInviteReviewers}
            onChange={(e) => setReInviteReviewers(e.target.checked)}
            disabled={!decidable || isPending}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">
              Re-invite original reviewers for round 2
            </span>
            <span className="block text-[11px] text-brown mt-0.5">
              Reviewers who completed round 1 will receive a fresh invitation
              with a 21-day deadline and a &ldquo;Round 2&rdquo; note. Reviewers
              who already have a post-decision invitation will be skipped.
            </span>
          </span>
        </label>
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
            className="text-[11px] text-brown border border-brown/20 px-2 py-1 rounded hover:bg-cream-alt disabled:opacity-50"
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

      {isRevisionDecision && (
        <div className="bg-white border border-peach-dark/40 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-brown">
              Reviewer feedback attachment
            </p>
            <p className="text-sm text-ink mt-1 leading-relaxed">
              A Word document containing every reviewer&apos;s
              author-facing comments — labelled &ldquo;Reviewer 1&rdquo;,
              &ldquo;Reviewer 2&rdquo;, etc. — will be attached to the
              decision email. Reviewer identities are not included.
              Preview the document below to review its contents. If you
              want to edit it (rewrite passages, redact, reorder, add
              editorial notes) before the author sees it, download,
              edit in Word, and upload the edited version as an
              override.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePreviewFeedback}
              disabled={feedbackPreviewLoading || isPending}
              className="text-xs px-3 py-1.5 rounded-lg border border-brown/30 bg-cream-alt text-brown-dark hover:bg-peach disabled:opacity-50"
            >
              {feedbackPreviewLoading
                ? 'Generating preview…'
                : 'Preview / download attachment'}
            </button>
            <label
              className={`text-xs px-3 py-1.5 rounded-lg border border-brown/30 cursor-pointer hover:bg-cream-alt ${
                isPending ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {feedbackOverride
                ? 'Replace edited version…'
                : 'Upload edited version…'}
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleOverrideFileChange}
                disabled={isPending}
                className="hidden"
              />
            </label>
            {feedbackOverride && (
              <button
                type="button"
                onClick={handleClearOverride}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                Clear override
              </button>
            )}
          </div>

          {feedbackOverride && (
            <p className="text-[12px] text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2">
              <strong>Override active:</strong> {feedbackOverride.filename}
              {' · '}
              {(feedbackOverride.sizeBytes / 1024).toFixed(1)} KB. This
              edited file will be attached. Click &ldquo;Clear
              override&rdquo; to revert to auto-generated.
            </p>
          )}

          {!feedbackOverride &&
            feedbackReviewerCount !== null &&
            feedbackReviewerCount > 0 && (
              <p className="text-[12px] text-brown">
                Auto-generated document contains feedback from{' '}
                <strong>
                  {feedbackReviewerCount} reviewer
                  {feedbackReviewerCount === 1 ? '' : 's'}
                </strong>
                . Click Submit decision to send as-is.
              </p>
            )}

          {!feedbackOverride && feedbackReviewerCount === -1 && (
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              No reviewer comments are available for attachment. The
              decision email will be sent without an attachment.
            </p>
          )}

          {feedbackPreviewMessage && (
            <p
              className={`text-[12px] ${
                feedbackPreviewIsError ? 'text-red-700' : 'text-brown'
              }`}
            >
              {feedbackPreviewMessage}
            </p>
          )}
        </div>
      )}

      <div className="bg-cream-alt/50 border border-border rounded-lg p-3 text-xs text-ink">
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
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || isPending}
          className={`text-sm px-4 py-2 rounded-lg border font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
            decision === 'desk_reject'
              ? 'border-red-400 bg-red-100 text-red-800 hover:bg-red-200'
              : 'border-brown bg-peach-dark text-ink hover:bg-peach'
          }`}
        >
          {isPending
            ? 'Submitting…'
            : decision === 'desk_reject'
              ? 'Submit desk reject'
              : 'Submit decision'}
        </button>
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
              formatting non-compliance, ethical concerns, or
              prior-publication overlap. The decision letter you composed
              above will be delivered to the corresponding author. The
              decision is recorded in the manuscript history and cannot be
              undone (a 15-minute rescind window does open afterwards if you
              spot a mistake).
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeskRejectConfirmOpen(false)}
                disabled={isPending}
                className="text-sm px-3 py-1.5 rounded-lg border border-border text-brown hover:bg-cream-alt disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={dispatchSubmit}
                disabled={isPending}
                className="text-sm px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-medium disabled:opacity-50"
              >
                {isPending ? 'Submitting…' : 'Continue and send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescindOpen && rescindable && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-border shadow-lg max-w-lg w-full p-6 space-y-4">
            <h3 className="font-serif text-lg text-brown-dark">
              Undo {rescindable.decisionLabel.toLowerCase()} decision?
            </h3>
            <p className="text-sm text-ink">
              The manuscript status will revert to its pre-decision state and
              the corresponding author will receive an email asking them to
              disregard the prior letter. The rescinded decision stays in the
              manuscript history for audit purposes.
            </p>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
                Reason for rescission (visible to the author)
              </label>
              <textarea
                value={rescindReason}
                onChange={(e) => setRescindReason(e.target.value)}
                rows={4}
                disabled={isRescinding}
                placeholder="e.g. Decision was issued in error before all reviewer reports had been considered."
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
              />
              <p
                className={`text-[11px] mt-1 ${
                  rescindReason.trim().length >= MIN_RESCIND_REASON
                    ? 'text-brown'
                    : 'text-amber-700'
                }`}
              >
                {rescindReason.trim().length} characters &middot; minimum{' '}
                {MIN_RESCIND_REASON}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescindOpen(false)}
                disabled={isRescinding}
                className="text-sm px-3 py-1.5 rounded-lg border border-border text-brown hover:bg-cream-alt disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onRescindConfirm}
                disabled={
                  isRescinding ||
                  rescindReason.trim().length < MIN_RESCIND_REASON
                }
                className="text-sm px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRescinding ? 'Rescinding…' : 'Rescind decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// Live countdown banner. Renders the time remaining in the 15-min
// rescind window and the Undo button. Self-removes via
// onWindowExpired() when the deadline passes.
function RescindBanner({
  rescindable,
  onOpenModal,
  onWindowExpired,
  isPending,
}: {
  rescindable: RescindableDecision
  onOpenModal: () => void
  onWindowExpired: () => void
  isPending: boolean
}) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const endsAt = new Date(rescindable.rescindWindowEndsIso).getTime()
  const msRemaining = endsAt - now
  if (msRemaining <= 0) {
    queueMicrotask(onWindowExpired)
    return null
  }
  const totalSec = Math.ceil(msRemaining / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const label = `${min}:${sec.toString().padStart(2, '0')}`

  return (
    <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
      <span>
        <strong>Just issued:</strong> {rescindable.decisionLabel}. You can
        undo this decision for the next <code className="font-mono">{label}</code>.
      </span>
      <button
        type="button"
        onClick={onOpenModal}
        disabled={isPending}
        className="text-xs border border-amber-400 bg-white text-amber-900 px-2 py-1 rounded hover:bg-amber-100 disabled:opacity-50"
      >
        Undo decision
      </button>
    </div>
  )
}

