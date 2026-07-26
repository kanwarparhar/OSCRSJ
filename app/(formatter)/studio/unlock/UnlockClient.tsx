'use client'

// ============================================================
// Submission Studio -- the unlock survey form
// ============================================================
// The user is here because they ran out of free runs. That framing drives
// every decision below:
//
//   1. TELL THEM WHERE THEY STAND FIRST. The email field comes before the
//      questions and the quota is looked up as soon as it is valid. Someone who
//      still has runs left, who already spent their one refill, or who is on an
//      admin address with no limit at all, finds out in one second instead of
//      after three minutes of typing. Making a person fill in a survey and THEN
//      telling them it bought nothing is the single worst thing this page could
//      do.
//
//      The refill is a SHORTCUT, not the only way back in. Runs age out on
//      their own a week after they are used, so every locked state on this page
//      says when the allowance returns by itself before it mentions the survey.
//      A survey that reads as a toll gate produces answers written to get past
//      it, which are worth less than no answers at all.
//
//   2. THE FORM RENDERS FROM lib/studio/survey.ts, NOT FROM JSX. Questions,
//      options, conditional visibility and validation all come from the shared
//      definition that the server validates against. Hand-written inputs would
//      drift from the validator within one edit, and the failure is silent: a
//      question quietly stops being required, or an option the server rejects
//      stays clickable.
//
//   3. VALIDATION IS SHOWN, NOT ENFORCED BY DISABLING. The submit button stays
//      live and clicking it scrolls to the first unanswered question. A greyed
//      out button with no explanation is the classic way to strand someone on a
//      long form, and this form is the last interaction we get with a user who
//      is already mildly annoyed at us.
//
// The server is the authority on all of this. Everything here is a faster,
// friendlier copy of a decision app/api/studio/survey/route.ts makes again.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  SURVEY_QUESTIONS,
  SURVEY_ESTIMATED_MINUTES,
  FOLLOW_UP_LABEL,
  OTHER_PREFIX,
  validateSurvey,
  visibleQuestions,
  type SurveyAnswers,
  type SurveyQuestion,
} from '@/lib/studio/survey'
import {
  STUDIO_FREE_RUNS,
  STUDIO_FREE_UNTIL_LABEL,
  STUDIO_QUOTA_WINDOW_LABEL,
  normalizeEmail,
  type QuotaStatusPayload,
} from '@/lib/studio/quotaConstants'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const QUOTA_DEBOUNCE_MS = 600

/**
 * The zone every quota time is quoted in. Fixed rather than the reader's own,
 * for the same reason as in the two Studio forms: the server decides the
 * instant, and two people reading the same field in two zones is how a support
 * thread starts. The copy names the zone.
 */
const QUOTA_TIME_ZONE = 'America/Los_Angeles'

/**
 * "Thursday at 9:14 AM" for the instant the next run frees itself, or null if
 * the server did not say. Every caller has copy that does not name a time.
 */
function nextRunLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  try {
    const day = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: QUOTA_TIME_ZONE,
    }).format(at)
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: QUOTA_TIME_ZONE,
    }).format(at)
    return `${day} at ${time}`
  } catch {
    return null
  }
}

type Outcome =
  | 'reset_granted'
  | 'reset_already_used'
  | 'recorded_runs_remaining'
  /** Saved, but we could not read the allowance, so we must not claim anything
   *  about it. Telling a locked-out user "nothing was spent, you have 0 runs"
   *  is worse than admitting the check failed. */
  | 'recorded_quota_unknown'

interface SubmitResult {
  outcome: Outcome
  granted: boolean
  quota: {
    used: number
    limit: number
    remaining: number
    locked: boolean
    nextRunAvailableAt?: string | null
  } | null
}

// ---------------------------------------------------------------------------
// Quota lookup
// ---------------------------------------------------------------------------

/**
 * Debounced, abortable read of GET /api/studio/quota.
 *
 * The reading is stored WITH the address it was read for. Without that, a slow
 * response for the address the user typed first can land after they corrected a
 * typo and paint a count that belongs to a different person.
 */
function useQuotaLookup(email: string) {
  const [quota, setQuota] = useState<QuotaStatusPayload | null>(null)
  const [checking, setChecking] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const valid = EMAIL_RE.test(email.trim())
  const key = valid ? normalizeEmail(email) : ''

  useEffect(() => {
    abortRef.current?.abort()
    if (!key) {
      setQuota(null)
      setChecking(false)
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/studio/quota?email=${encodeURIComponent(key)}`, {
          signal: ctrl.signal,
        })
        if (!res.ok) {
          setQuota(null)
          return
        }
        const data = (await res.json()) as QuotaStatusPayload
        // Guard against a response for a stale address.
        if (normalizeEmail(data.email) === key) setQuota(data)
      } catch {
        // Advisory only. A failed lookup must never block the survey.
        setQuota(null)
      } finally {
        if (!ctrl.signal.aborted) setChecking(false)
      }
    }, QUOTA_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [key])

  return { quota, checking, valid }
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function otherValue(answer: string | string[] | undefined): string {
  if (typeof answer === 'string' && answer.startsWith(OTHER_PREFIX)) {
    return answer.slice(OTHER_PREFIX.length)
  }
  if (Array.isArray(answer)) {
    const hit = answer.find((v) => v.startsWith(OTHER_PREFIX))
    if (hit) return hit.slice(OTHER_PREFIX.length)
  }
  return ''
}

function hasOther(answer: string | string[] | undefined): boolean {
  if (typeof answer === 'string') return answer.startsWith(OTHER_PREFIX)
  if (Array.isArray(answer)) return answer.some((v) => v.startsWith(OTHER_PREFIX))
  return false
}

interface FieldProps {
  question: SurveyQuestion
  value: SurveyAnswers[string]
  error?: string
  onChange: (v: SurveyAnswers[string]) => void
}

function ScaleField({ question, value, onChange }: FieldProps) {
  const min = question.scaleMin ?? 1
  const max = question.scaleMax ?? 5
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {points.map((n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={active}
              className={[
                'h-11 w-11 rounded-lg border text-sm font-semibold transition',
                active
                  ? 'border-fmt-accent bg-fmt-accent text-white'
                  : 'border-fmt-hairline bg-fmt-surface text-fmt-ink hover:border-fmt-accent',
              ].join(' ')}
            >
              {n}
            </button>
          )
        })}
      </div>
      {question.scaleLabels ? (
        <div className="mt-2 flex justify-between text-xs text-fmt-ink-2" style={{ maxWidth: '17rem' }}>
          <span>{question.scaleLabels.min}</span>
          <span>{question.scaleLabels.max}</span>
        </div>
      ) : null}
    </div>
  )
}

function ChoiceField({ question, value, onChange }: FieldProps) {
  const multi = question.type === 'multi'
  const selected: string[] = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const otherOn = hasOther(value as string | string[])
  const otherText = otherValue(value as string | string[])

  function toggle(option: string) {
    if (!multi) {
      onChange(option)
      return
    }
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option]
    onChange(next)
  }

  function setOther(text: string) {
    const composed = OTHER_PREFIX + text
    if (!multi) {
      onChange(text ? composed : '')
      return
    }
    const withoutOther = selected.filter((v) => !v.startsWith(OTHER_PREFIX))
    onChange(text ? [...withoutOther, composed] : withoutOther)
  }

  function toggleOther() {
    if (otherOn) {
      setOther('')
      return
    }
    // Seed with a single space so the option reads as selected before the user
    // types anything. validateSurvey trims the write-in before judging it, so a
    // ticked-but-empty "Something else" fails validation on both single and
    // multi rather than storing the literal string "Other:  " as a real answer.
    setOther(' ')
  }

  return (
    <div className="grid gap-2">
      {(question.options ?? []).map((option) => {
        const active = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            aria-pressed={active}
            className={[
              'flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition',
              active
                ? 'border-fmt-accent bg-fmt-accent/5 text-fmt-ink'
                : 'border-fmt-hairline bg-fmt-surface text-fmt-ink-2 hover:border-fmt-accent',
            ].join(' ')}
          >
            <span
              aria-hidden
              className={[
                'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center border',
                multi ? 'rounded' : 'rounded-full',
                active ? 'border-fmt-accent bg-fmt-accent text-white' : 'border-fmt-hairline',
              ].join(' ')}
              style={{ fontSize: '10px', lineHeight: 1 }}
            >
              {active ? (multi ? '✓' : '•') : ''}
            </span>
            <span className="leading-snug">{option}</span>
          </button>
        )
      })}

      {question.allowOther ? (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={toggleOther}
            aria-pressed={otherOn}
            className={[
              'flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition',
              otherOn
                ? 'border-fmt-accent bg-fmt-accent/5 text-fmt-ink'
                : 'border-fmt-hairline bg-fmt-surface text-fmt-ink-2 hover:border-fmt-accent',
            ].join(' ')}
          >
            <span
              aria-hidden
              className={[
                'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center border',
                multi ? 'rounded' : 'rounded-full',
                otherOn ? 'border-fmt-accent bg-fmt-accent text-white' : 'border-fmt-hairline',
              ].join(' ')}
              style={{ fontSize: '10px', lineHeight: 1 }}
            >
              {otherOn ? (multi ? '✓' : '•') : ''}
            </span>
            <span className="leading-snug">Something else</span>
          </button>
          {otherOn ? (
            <input
              type="text"
              value={otherText}
              autoFocus
              onChange={(e) => setOther(e.target.value)}
              placeholder="Tell us what"
              className="w-full rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2 text-sm text-fmt-ink outline-none focus:border-fmt-accent"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function TextField({ question, value, onChange }: FieldProps) {
  const text = typeof value === 'string' ? value : ''
  const long = (question.maxLength ?? 0) > 300
  const Tag = long ? 'textarea' : 'input'
  return (
    <div>
      <Tag
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ rows: long ? 4 : undefined } as any)}
        value={text}
        maxLength={question.maxLength}
        placeholder={question.placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        className="w-full rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2 text-sm leading-relaxed text-fmt-ink outline-none focus:border-fmt-accent"
      />
      {question.maxLength && text.length > question.maxLength * 0.8 ? (
        <p className="mt-1 text-right text-xs text-fmt-ink-2">
          {text.length} / {question.maxLength}
        </p>
      ) : null}
    </div>
  )
}

function Field(props: FieldProps) {
  const { question, error } = props
  return (
    <div id={`q-${question.id}`} className="scroll-mt-24">
      <label className="block text-[15px] font-semibold leading-snug text-fmt-ink">
        {question.prompt}
        {!question.required ? (
          <span className="ml-2 text-xs font-normal text-fmt-ink-2">Optional</span>
        ) : null}
      </label>
      {question.help ? (
        <p className="mt-1 text-[13px] leading-relaxed text-fmt-ink-2">{question.help}</p>
      ) : null}
      <div className="mt-3">
        {question.type === 'scale' ? (
          <ScaleField {...props} />
        ) : question.type === 'text' ? (
          <TextField {...props} />
        ) : (
          <ChoiceField {...props} />
        )}
      </div>
      {error ? (
        <p className="mt-2 text-[13px] font-medium" style={{ color: 'var(--fmt-danger, #b42318)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UnlockClient() {
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [followUpOk, setFollowUpOk] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)

  const startedAt = useRef<number>(Date.now())
  const { quota, checking, valid } = useQuotaLookup(email)

  const shown = useMemo(() => visibleQuestions(answers), [answers])
  const totalRequired = useMemo(
    () => SURVEY_QUESTIONS.filter((q) => q.required).length,
    [],
  )
  const answeredRequired = useMemo(() => {
    const { errors: e } = validateSurvey(answers)
    return Math.max(0, totalRequired - Object.keys(e).length)
  }, [answers, totalRequired])

  const setAnswer = useCallback((id: string, v: SurveyAnswers[string]) => {
    setAnswers((prev) => ({ ...prev, [id]: v }))
    setErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  async function handleSubmit() {
    setSubmitError(null)
    if (!valid) {
      setSubmitError('Enter the email address you used in the Studio.')
      document.getElementById('unlock-email')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const validation = validateSurvey(answers)
    if (!validation.ok) {
      setErrors(validation.errors)
      const firstId = SURVEY_QUESTIONS.find((q) => validation.errors[q.id])?.id
      if (firstId) {
        document.getElementById(`q-${firstId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/studio/survey', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          answers: validation.clean,
          followUpOk,
          durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (data?.fieldErrors) {
          setErrors(data.fieldErrors as Record<string, string>)
          const firstId = SURVEY_QUESTIONS.find((q) => data.fieldErrors[q.id])?.id
          if (firstId) {
            document
              .getElementById(`q-${firstId}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
        setSubmitError(data?.error ?? 'We could not save your answers. Please try again.')
        return
      }
      setResult({
        outcome: (data?.outcome as Outcome) ?? 'recorded_runs_remaining',
        granted: data?.granted === true,
        quota: data?.quota ?? null,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmitError('Something went wrong sending your answers. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Confirmation
  // -------------------------------------------------------------------------
  if (result) {
    const granted = result.outcome === 'reset_granted'
    const alreadyUsed = result.outcome === 'reset_already_used'
    const unknown = result.outcome === 'recorded_quota_unknown'
    // The lookup is still live for this address, so it is the fallback for the
    // fields the survey response does not carry.
    const isAdmin = quota?.isAdmin === true
    const confirmNextRun = nextRunLabel(
      result.quota?.nextRunAvailableAt ?? quota?.nextRunAvailableAt,
    )
    return (
      <div className="card" style={{ padding: '30px 28px' }}>
        <p className="kicker" style={{ marginBottom: '10px' }}>
          {granted && !isAdmin ? 'Runs restored' : 'Feedback received'}
        </p>
        <h2 style={{ fontSize: '25px', marginBottom: '12px' }}>
          {granted && !isAdmin
            ? `You have ${result.quota?.remaining ?? STUDIO_FREE_RUNS} runs again`
            : 'Thank you, this is genuinely useful'}
        </h2>
        <p style={{ color: 'var(--fmt-ink-2)', lineHeight: 1.65, marginBottom: '14px' }}>
          {isAdmin
            ? `This is an admin address, so it has no run limit and there was nothing to refill. Your answers are recorded either way and they land in the same pile as everyone else's. The Studio stays free through ${STUDIO_FREE_UNTIL_LABEL}.`
            : granted
              ? `Your answers are in and your allowance is back to ${result.quota?.limit ?? STUDIO_FREE_RUNS} for this ${STUDIO_QUOTA_WINDOW_LABEL}. That was the one refill this address gets, and it is not the last free runs it will see: every run frees itself up again a ${STUDIO_QUOTA_WINDOW_LABEL} after you use it, so the allowance keeps coming back on its own. The Studio stays free through ${STUDIO_FREE_UNTIL_LABEL}.`
              : alreadyUsed
                ? `Your answers are recorded. This address has already used its one refill, so this did not add runs to it. ${
                    confirmNextRun
                      ? `Your next free run opens up ${confirmNextRun} Pacific.`
                      : `Runs come back on their own a ${STUDIO_QUOTA_WINDOW_LABEL} after you use them, so the allowance returns without you doing anything.`
                  } That does not make this feedback worth any less, and it goes into the same pile as everyone else's. The Studio stays free through ${STUDIO_FREE_UNTIL_LABEL} and paid plans follow.`
                : unknown
                  ? 'Your answers are saved. We could not check your run balance just now, so we have not changed it. If you were out of runs, open this page again in a minute and submit once more, and your allowance will be refilled. Your answers will not be counted twice.'
                  : `Your answers are recorded. You still have ${result.quota?.remaining ?? 0} free runs this ${STUDIO_QUOTA_WINDOW_LABEL}, so nothing was spent and your one refill is still there for when you do run out.`}
        </p>
        <p style={{ color: 'var(--fmt-ink-2)', lineHeight: 1.65, marginBottom: '22px' }}>
          Every answer here is read. The problems people report are the queue we work from, and the
          journals people name are the ones that get added next.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {granted && !isAdmin ? (
            <Link href="/studio/format" className="btn">
              Format a manuscript
            </Link>
          ) : null}
          <Link
            href="/studio"
            className="btn"
            style={
              granted && !isAdmin
                ? { background: 'transparent', color: 'var(--fmt-ink)', border: '1px solid var(--fmt-hairline)' }
                : undefined
            }
          >
            Back to the Studio
          </Link>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Quota banner above the form
  // -------------------------------------------------------------------------
  const bannerNextRun = nextRunLabel(quota?.nextRunAvailableAt)
  let banner: React.ReactNode = null
  if (checking) {
    banner = <p className="text-[13px] text-fmt-ink-2">Checking this address.</p>
  } else if (quota) {
    if (quota.isAdmin) {
      // Nothing to refill, and saying otherwise would be a lie the operator
      // would find out about the moment they submitted.
      banner = (
        <p className="text-[13px] leading-relaxed text-fmt-ink-2">
          Admin address. No run limit, so there is nothing to refill. The survey is still recorded
          and still counted.
        </p>
      )
    } else if (quota.lockedByInFlightOnly) {
      // The survey must NOT be offered here: it would spend the one refill to
      // clear a condition that clears itself in minutes.
      banner = (
        <p className="text-[13px] leading-relaxed text-fmt-ink-2">
          A job on this address is still running. Nothing has been used up, and the slot frees
          itself once that job finishes or fails. Answering this now is welcome, but it is not what
          gets you back in.
        </p>
      )
    } else if (quota.locked && quota.canUnlockWithSurvey) {
      banner = (
        <p className="text-[13px] leading-relaxed text-fmt-ink">
          <strong>
            All {quota.limit} runs used this {STUDIO_QUOTA_WINDOW_LABEL}.
          </strong>{' '}
          {bannerNextRun
            ? `Your next one comes back on its own ${bannerNextRun} Pacific, and the rest a ${STUDIO_QUOTA_WINDOW_LABEL} after you used them. `
            : `They come back on their own, a ${STUDIO_QUOTA_WINDOW_LABEL} after each one is used. `}
          Completing this survey refills all {quota.limit} right away instead. The refill works once
          per address.
        </p>
      )
    } else if (quota.locked) {
      banner = (
        <p className="text-[13px] leading-relaxed text-fmt-ink-2">
          {bannerNextRun
            ? `Your next free run opens up ${bannerNextRun} Pacific. `
            : `Your runs come back on their own a ${STUDIO_QUOTA_WINDOW_LABEL} after you use them. `}
          This address has already used its one refill, so submitting again will not add runs. Your
          feedback is still welcome and still read.
        </p>
      )
    } else {
      banner = (
        <p className="text-[13px] leading-relaxed text-fmt-ink-2">
          This address still has {quota.remaining} of {quota.limit} free runs this{' '}
          {STUDIO_QUOTA_WINDOW_LABEL}. You can fill this in now, and your one refill stays available
          for when you actually run out.
        </p>
      )
    }
  }

  return (
    <div className="grid gap-6">
      {/* Email */}
      <div className="card" style={{ padding: '24px 26px' }}>
        <label
          htmlFor="unlock-email"
          className="block text-[15px] font-semibold leading-snug text-fmt-ink"
        >
          The email address you used in the Studio
        </label>
        <p className="mt-1 text-[13px] leading-relaxed text-fmt-ink-2">
          It has to match, since the allowance is attached to the address rather than to a login.
          Runs are counted per address per {STUDIO_QUOTA_WINDOW_LABEL}.
        </p>
        <input
          id="unlock-email"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@hospital.edu"
          className="mt-3 w-full rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2 text-sm text-fmt-ink outline-none focus:border-fmt-accent"
        />
        {/* Reserved so the banner arriving does not shove the form down. */}
        <div className="mt-3 min-h-[2.5rem]">{banner}</div>
      </div>

      {/* Questions */}
      <div className="card" style={{ padding: '28px 26px' }}>
        <div
          className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b pb-4"
          style={{ borderColor: 'var(--fmt-hairline)' }}
        >
          <p className="kicker" style={{ margin: 0 }}>
            {answeredRequired} of {totalRequired} answered
          </p>
          <p className="text-xs text-fmt-ink-2">About {SURVEY_ESTIMATED_MINUTES} minutes</p>
        </div>

        <div className="grid gap-8">
          {shown.map((q) => (
            <Field
              key={q.id}
              question={q}
              value={answers[q.id]}
              error={errors[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          ))}
        </div>

        <div
          className="mt-8 border-t pt-5"
          style={{ borderColor: 'var(--fmt-hairline)' }}
        >
          <label htmlFor="follow-up-ok" className="flex cursor-pointer items-start gap-3">
            <input
              id="follow-up-ok"
              type="checkbox"
              checked={followUpOk}
              onChange={(e) => setFollowUpOk(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-fmt-accent"
            />
            <span className="text-sm leading-snug text-fmt-ink-2">{FOLLOW_UP_LABEL}</span>
          </label>
        </div>

        {submitError ? (
          <p
            className="mt-5 rounded-lg border p-3 text-sm"
            style={{
              borderColor: 'var(--fmt-danger, #b42318)',
              color: 'var(--fmt-danger, #b42318)',
            }}
          >
            {submitError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="btn"
          style={{ marginTop: '22px', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting
            ? 'Sending…'
            : quota && !quota.isAdmin && quota.locked && quota.canUnlockWithSurvey
              ? `Submit and refill ${quota.limit} runs`
              : 'Submit feedback'}
        </button>
        <p className="mt-3 text-xs leading-relaxed text-fmt-ink-2">
          We store your answers against your email address so the allowance can be restored. Nothing
          here is published with your name or address attached.
        </p>
      </div>
    </div>
  )
}
