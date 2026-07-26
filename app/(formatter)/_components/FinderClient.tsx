'use client'

// Journal Finder v2 (2026-07-25) — upload-first manuscript profile, then a
// reach / target / safety ladder.
//
// WHAT CHANGED FROM V1 AND WHY. v1 asked for six numbers and ranked journals by
// formatting-constraint fit. Nobody chooses a journal that way, and the ranking
// implied a judgement the numbers could not support. v2 reads the manuscript,
// shows the author exactly what it could verify (with the sentence behind every
// fact), asks three questions, and lays out five journals banded by SJR standing
// RELATIVE to the journals eligible for that manuscript. The v1 scorecard is not
// gone: it is the eligibility gate underneath, and it is one click away as
// "all eligible journals, with formatting fit".
//
// STATE MACHINE (brief §4.1). Upload path:
//   idle → uploading → processing → profile_review → results
// Manual path:
//   idle → manual_form → results   (synchronous, no job, nothing uploaded)
// Either can land in `error`, which is a plain card with a retry.
//
// A reload during `processing` recovers from the job id in sessionStorage, the
// same mechanism the format page uses.
//
// The questions come AFTER the profile deliberately: an author should see what
// their text actually supports before rating their own work. That is why the
// ladder is rebuilt server-side from the stored profile rather than computed in
// one pass at upload time.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ARTICLE_TYPE_LABELS } from '@/lib/formatting/registry-meta'
import type { ArticleType } from '@/lib/formatting/rulesSchema'
import { sortScores } from '@/lib/finder/match'
import { MAX_MANUSCRIPT_BYTES } from '@/lib/formatting/pipeline/api'
import { CONSENT_LABEL, CONSENT_DETAIL } from '@/lib/studio/consent'
import {
  SCOPE_TAGS,
  SCOPE_TAG_LABELS,
  type FinderResult,
  type JournalScore,
  type ManuscriptStats,
  type ScopeTag,
} from '@/lib/finder/types'
import type {
  LadderResult,
  LadderSlot,
  ManuscriptProfile,
  ProfileEdits,
  SelfAssessment,
} from '@/lib/finder/profileTypes'
import { subscribeFormatHandoff, requestFormatJournal } from '@/lib/finder/handoff'
import { FINDER_V2, finderAllEligibleLabel } from '../_copy'
import FinderProfileCard from './FinderProfileCard'
import FinderProgress from './FinderProgress'
import FinderSelfAssessmentForm from './FinderSelfAssessmentForm'
import FinderLadderView from './FinderLadderView'
import ResultCard from './FinderResultCard'

/* ------------------------------------------------------------------ */
/*  Static bits                                                         */
/* ------------------------------------------------------------------ */

const ARTICLE_TYPE_OPTIONS = Object.entries(ARTICLE_TYPE_LABELS) as [ArticleType, string][]
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const JOB_KEY = 'oscrsj-finder-assess-job'

/** Article-type phrase for the OSCRSJ card, mirroring lib/finder/match.ts. */
const ARTICLE_TYPE_PHRASE: Record<string, string> = {
  case_report: 'case reports',
  case_series: 'case series',
  original_research: 'original research articles',
  review: 'review articles',
  systematic_review: 'systematic reviews and meta-analyses',
  narrative_review: 'narrative reviews',
  technical_note: 'technical notes and surgical techniques',
  letter: 'letters to the editor',
  editorial: 'editorials',
}

function formatBytes(n: number): string {
  // Sub-megabyte uploads rendered as "0.0 MB", which reads like an empty file
  // next to a green check (Franklin, Session 100).
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const EMPTY_SELF_ASSESSMENT: SelfAssessment = { novelty: null, strength: null, priorities: [] }

type Phase = 'idle' | 'manual_form' | 'uploading' | 'processing' | 'profile_review' | 'results' | 'error'

interface StoredJob {
  jobId: string
  email: string
  articleType: ArticleType
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export default function FinderClient() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  // Shared inputs
  const [articleType, setArticleType] = useState<ArticleType | ''>('')
  const [subspecialty, setSubspecialty] = useState<ScopeTag | null>(null)
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment>(EMPTY_SELF_ASSESSMENT)

  // Upload path
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [manuscript, setManuscript] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The author's corrections to the extracted profile, held client-side until
  // they build the ladder. Applying each keystroke server-side would mean a
  // round trip per character for a value that only matters once.
  const [profileEdits, setProfileEdits] = useState<ProfileEdits>({})

  // Real job status, mapped to a step on the waiting screen. 'uploaded' is the
  // honest starting point: nothing has been claimed yet.
  const [jobStatus, setJobStatus] = useState<string>('uploaded')

  // Results
  const [profile, setProfile] = useState<ManuscriptProfile | null>(null)
  const [ladder, setLadder] = useState<LadderResult | null>(null)
  const [matchResult, setMatchResult] = useState<FinderResult | null>(null)
  const [handoffFilename, setHandoffFilename] = useState<string | null>(null)

  // Poll-loop lifecycle: navigating away aborts instead of fetching against an
  // unmounted component (Session 98, Part F).
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  // The processing copy asks users to keep the tab open. Enforce it honestly.
  useEffect(() => {
    if (phase !== 'processing' && phase !== 'uploading') return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  // Auto-fill from a completed format job (sessionStorage-backed, so it survives
  // the navigation from /studio/format — Session 96).
  useEffect(() => {
    return subscribeFormatHandoff((h) => {
      if (h.articleType) setArticleType(h.articleType)
      setHandoffFilename(h.filename)
    })
  }, [])

  /* ---- Reload recovery: pick a job back up mid-processing ---- */
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.sessionStorage.getItem(JOB_KEY)
    } catch {
      // Storage can be blocked outright. A lost recovery costs a re-upload; it
      // must never throw and break the page.
      return
    }
    if (!raw) return
    let stored: StoredJob
    try {
      stored = JSON.parse(raw) as StoredJob
    } catch {
      return
    }
    if (!stored?.jobId || !stored?.email) return
    setJobId(stored.jobId)
    setEmail(stored.email)
    setArticleType(stored.articleType)
    setPhase('processing')
    void pollUntilDone(stored.jobId, stored.email)
    // Recovery runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rememberJob = useCallback((j: StoredJob) => {
    try {
      window.sessionStorage.setItem(JOB_KEY, JSON.stringify(j))
    } catch {
      /* storage blocked: recovery is a convenience, never a requirement */
    }
  }, [])

  const forgetJob = useCallback(() => {
    try {
      window.sessionStorage.removeItem(JOB_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  /* ---- Upload path ---- */

  function chooseFile(file: File | null) {
    setError(null)
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Please upload a Word .docx file. Other formats cannot be read.')
      return
    }
    if (file.size > MAX_MANUSCRIPT_BYTES) {
      setError(`That file is ${formatBytes(file.size)}. The maximum manuscript size is ${formatBytes(MAX_MANUSCRIPT_BYTES)}.`)
      return
    }
    setManuscript(file)
  }

  const canUpload =
    !!manuscript && articleType !== '' && EMAIL_RE.test(email) && consent && phase !== 'uploading' && phase !== 'processing'

  async function pollUntilDone(id: string, addr: string) {
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    // One POST kicks the assessment off and returns when it is terminal; the
    // GET loop is the reload-recovery path and the safety net if that request
    // is cut off mid-flight.
    try {
      await fetch(`/api/finder/assess/${id}`, {
        method: 'POST',
        headers: { 'x-job-email': addr, 'content-type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      })
    } catch {
      if (controller.signal.aborted) return
      // Fall through to polling: the work may have completed server-side.
    }

    let deadPolls = 0
    for (let i = 0; i < 60; i++) {
      if (controller.signal.aborted) return
      try {
        const res = await fetch(`/api/finder/assess/${id}`, {
          headers: { 'x-job-email': addr },
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as {
          done: boolean
          status?: string
          profile: ManuscriptProfile | null
          ladder: LadderResult | null
          error: { message: string } | null
        }
        deadPolls = 0
        if (data.status) setJobStatus(data.status)
        if (data.done) {
          forgetJob()
          if (data.error) {
            setError(data.error.message)
            setPhase('error')
            return
          }
          setProfile(data.profile)
          setLadder(data.ladder)
          // Show the profile and ask the three questions before the ladder.
          setPhase('profile_review')
          return
        }
      } catch {
        if (controller.signal.aborted) return
        deadPolls++
        // Five dead polls in a row is a real outage, not a slow stage. Say so
        // rather than spinning forever (Session 98, Part F).
        if (deadPolls >= 5) {
          setError('We lost contact with the assessment service. Please try again.')
          setPhase('error')
          return
        }
      }
      await new Promise((r) => setTimeout(r, 2500))
    }
    setError('The assessment is taking longer than expected. Please try again.')
    setPhase('error')
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    // canUpload already proves manuscript and articleType are set (TS narrows
    // through the const), so re-testing articleType here is an unreachable
    // comparison rather than a safety net.
    if (!canUpload || !manuscript) return
    setPhase('uploading')
    setError(null)

    try {
      const createRes = await fetch('/api/finder/assess', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          articleType,
          subspecialty,
          selfAssessment: EMPTY_SELF_ASSESSMENT,
          manuscriptFilename: manuscript.name,
          marketingConsent: consent,
        }),
      })
      if (!createRes.ok) {
        const data = (await createRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || 'We could not start the assessment. Please try again.')
      }
      const job = (await createRes.json()) as { jobId: string; manuscriptUpload: { url: string } }

      const put = await fetch(job.manuscriptUpload.url, {
        method: 'PUT',
        body: manuscript,
        headers: { 'content-type': manuscript.type || 'application/octet-stream' },
      })
      if (!put.ok) throw new Error('The upload failed. Please check your connection and try again.')

      setJobId(job.jobId)
      rememberJob({ jobId: job.jobId, email, articleType })
      setPhase('processing')
      await pollUntilDone(job.jobId, email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  /**
   * Second server call: rebuild the ladder with the author's answers AND any
   * corrections they made to the profile. Both paths land here — the upload path
   * rebuilds from the stored extraction, the manual path re-runs the (cheap,
   * deterministic) match with the author's stated characteristics.
   */
  async function buildLadderWithAnswers() {
    if (!jobId) return runManualLadder()
    setError(null)
    try {
      const res = await fetch(`/api/finder/assess/${jobId}`, {
        method: 'POST',
        headers: { 'x-job-email': email, 'content-type': 'application/json' },
        body: JSON.stringify({ selfAssessment, profileEdits }),
      })
      if (!res.ok) throw new Error('We could not build your ladder. Please try again.')
      const data = (await res.json()) as { profile: ManuscriptProfile | null; ladder: LadderResult | null }
      if (data.profile) setProfile(data.profile)
      if (data.ladder) setLadder(data.ladder)
      setPhase('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  /* ---- Manual path (no upload, synchronous) ---- */

  /**
   * Run the deterministic match. Called twice on the manual path: once to get an
   * (empty, self-reported) profile to put in front of the author, and again once
   * they have filled it in and answered the questions. It is a pure local
   * computation server-side — no model call, no job — so running it twice costs
   * nothing and keeps the manual and upload paths on the same screens.
   */
  async function runMatch(nextPhase: Phase) {
    if (articleType === '') return
    setError(null)
    const stats: ManuscriptStats = {
      articleType,
      wordCount: null,
      abstractWordCount: null,
      figureCount: null,
      tableCount: null,
      referenceCount: null,
      subspecialty,
    }
    try {
      const res = await fetch('/api/finder/match', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stats, sortBy: 'fit', mode: 'ladder', selfAssessment, profileEdits }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || 'The Journal Finder is unavailable right now. Please try again.')
      }
      const data = (await res.json()) as FinderResult & { profile: ManuscriptProfile; ladder: LadderResult }
      setMatchResult(data)
      setProfile(data.profile)
      setLadder(data.ladder)
      setJobId(null)
      setPhase(nextPhase)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  async function runManual(e: React.FormEvent) {
    e.preventDefault()
    // Manual authors now see the same profile screen an uploader does — theirs
    // just starts empty. Filling it in is the whole value of the manual path;
    // before this, a manual run produced a ladder from the article type alone.
    await runMatch('profile_review')
  }

  const runManualLadder = () => runMatch('results')

  /* ---- Handoff into the formatter ---- */

  const handoffTo = useCallback(
    (slug: string) => {
      if (articleType === '') return
      requestFormatJournal({ slug, articleType })
      router.push('/studio/format')
    },
    [articleType, router],
  )

  const allEligible = useMemo(() => {
    const list = ladder?.allEligible ?? matchResult?.results.filter((r) => r.eligible) ?? []
    return sortScores(list as JournalScore[], 'fit')
  }, [ladder, matchResult])

  const typePhrase = articleType ? ARTICLE_TYPE_PHRASE[articleType] ?? 'this article type' : 'this article type'

  function reset() {
    forgetJob()
    abortRef.current?.abort()
    setPhase('idle')
    setError(null)
    setProfile(null)
    setLadder(null)
    setMatchResult(null)
    setJobId(null)
    setManuscript(null)
    setProfileEdits({})
    setJobStatus('uploaded')
  }

  const errorBanner = error ? (
    <div role="alert" className="rounded-xl border border-[#F0C7C4] bg-[#FBEAE9] px-4 py-3 text-sm text-fmt-bad">
      {error}
    </div>
  ) : null

  /* ------------------------------ ERROR ---------------------------- */
  if (phase === 'error') {
    return (
      <div className="space-y-4">
        {errorBanner}
        <button type="button" onClick={reset} className="btn btn-primary text-sm">
          Start over
        </button>
      </div>
    )
  }

  /* --------------------------- PROCESSING -------------------------- */
  if (phase === 'uploading' || phase === 'processing') {
    return <FinderProgress status={phase === 'uploading' ? 'uploaded' : jobStatus} />
  }

  /* ------------------------ PROFILE REVIEW ------------------------- */
  if (phase === 'profile_review' && profile) {
    return (
      <div className="space-y-6">
        {errorBanner}
        <FinderProfileCard profile={profile} edits={profileEdits} onEditsChange={setProfileEdits} />
        <FinderSelfAssessmentForm value={selfAssessment} onChange={setSelfAssessment} />
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={buildLadderWithAnswers}
            className="btn btn-primary w-full sm:w-auto sm:min-w-[240px]"
          >
            {FINDER_V2.buildLadderCta}
          </button>
          <button type="button" onClick={reset} className="text-xs text-fmt-ink-3 underline hover:text-fmt-ink-2">
            {jobId ? 'Start over with a different manuscript' : 'Start over'}
          </button>
        </div>
      </div>
    )
  }

  /* ----------------------------- RESULTS --------------------------- */
  if (phase === 'results' && ladder && profile) {
    return (
      <div className="space-y-6">
        <FinderLadderView
          ladder={ladder}
          articleTypePhrase={typePhrase}
          sjrYear={ladder.slots.find((s) => s.meta.sjr.year !== null)?.meta.sjr.year ?? 2025}
          onFormat={(slot: LadderSlot) => handoffTo(slot.slug)}
          onFormatOscrsj={() => handoffTo('oscrsj')}
        />

        <details className="rounded-xl border border-fmt-hairline bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-fmt-ink-2">
            {finderAllEligibleLabel(ladder.eligibleCount)}
          </summary>
          <div className="space-y-4 border-t border-fmt-hairline p-5">
            {allEligible.map((s) => (
              <ResultCard key={s.slug} score={s} onFormat={(sc) => handoffTo(sc.slug)} />
            ))}
          </div>
        </details>

        <details className="rounded-xl border border-fmt-hairline bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-fmt-ink-2">
            {FINDER_V2.profileHeading}
          </summary>
          <div className="border-t border-fmt-hairline p-5">
            <FinderProfileCard profile={profile} />
          </div>
        </details>

        <div className="flex justify-center">
          <button type="button" onClick={reset} className="btn btn-secondary text-sm">
            Start over
          </button>
        </div>
      </div>
    )
  }

  /* --------------------------- MANUAL FORM ------------------------- */
  if (phase === 'manual_form') {
    return (
      <form onSubmit={runManual} className="space-y-6">
        {errorBanner}
        <div className="rounded-xl border border-fmt-hairline bg-white p-6">
          <h3 className="mb-1 font-fmt-display text-xl text-fmt-ink">Tell us about your manuscript</h3>
          <p className="mb-5 text-sm text-fmt-ink-2">
            {FINDER_V2.selfReportedBanner} On the next screen you can state your study design, sample size and
            follow-up, which is what makes a no-upload ladder worth anything.
          </p>
          <TypeAndScope
            articleType={articleType}
            setArticleType={setArticleType}
            subspecialty={subspecialty}
            setSubspecialty={setSubspecialty}
          />
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            type="submit"
            disabled={articleType === ''}
            className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[240px]"
          >
            Continue →
          </button>
          <button type="button" onClick={reset} className="text-xs text-fmt-ink-3 underline hover:text-fmt-ink-2">
            Upload a manuscript instead
          </button>
        </div>
      </form>
    )
  }

  /* ------------------------------ IDLE ----------------------------- */
  return (
    <form onSubmit={handleUpload} className="space-y-6">
      {errorBanner}

      {handoffFilename && (
        <div className="flex items-start gap-3 rounded-xl border border-[#CDE9D8] bg-[#E8F5EE] px-4 py-3 text-sm text-fmt-ink">
          <span aria-hidden="true" className="mt-0.5 font-bold text-fmt-ok">
            ↑
          </span>
          <p>
            Carried over from <strong>{handoffFilename}</strong>. Upload the same manuscript to get a full profile, or
            answer a few questions instead.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-fmt-hairline bg-white p-6">
        <h3 className="mb-1 font-fmt-display text-xl text-fmt-ink">Upload your manuscript</h3>
        <p className="mb-5 text-sm text-fmt-ink-2">
          A blinded Word .docx, up to {formatBytes(MAX_MANUSCRIPT_BYTES)}. We read it to build the profile below, and it
          is deleted within seven days.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            chooseFile(e.dataTransfer.files?.[0] ?? null)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? 'border-fmt-accent bg-fmt-accent/5' : 'border-fmt-hairline bg-fmt-surface hover:border-fmt-ink-3'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          />
          {manuscript ? (
            <p className="text-sm font-medium text-fmt-ink">
              {manuscript.name} · {formatBytes(manuscript.size)} ✓
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-fmt-ink">Drop your .docx here, or click to choose</p>
              <p className="mt-1 font-fmt-mono text-xs text-fmt-ink-3">
                Microsoft Word only · max {formatBytes(MAX_MANUSCRIPT_BYTES)}
              </p>
            </>
          )}
        </div>

        <div className="mt-5">
          <TypeAndScope
            articleType={articleType}
            setArticleType={setArticleType}
            subspecialty={subspecialty}
            setSubspecialty={setSubspecialty}
          />
        </div>

        <div className="mt-5">
          <label htmlFor="finder-email" className="mb-1 block text-sm font-medium text-fmt-ink">
            Email <span className="text-fmt-bad">*</span>
          </label>
          <input
            id="finder-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-fmt-hairline bg-white px-4 py-2.5 text-sm text-fmt-ink placeholder:text-fmt-ink-3 focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40"
          />
          <p className="mt-1 text-xs text-fmt-ink-3">Used to retrieve your assessment if this tab is closed.</p>
        </div>

        {/* Required consent, gated again server-side so a hand-rolled POST
            cannot slip an address in without it. Same wording and version as
            the formatter: one Studio, one promise. */}
        <div className="mt-5 rounded-lg border border-fmt-hairline bg-fmt-surface p-4">
          <label htmlFor="finder-consent" className="flex cursor-pointer items-start gap-3">
            <input
              id="finder-consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-fmt-accent"
            />
            <span className="text-sm font-medium leading-snug text-fmt-ink">{CONSENT_LABEL}</span>
          </label>
          <p className="mt-2 pl-7 text-xs leading-relaxed text-fmt-ink-2">{CONSENT_DETAIL}</p>
          <p className="mt-2 pl-7 text-xs text-fmt-ink-2">
            See our{' '}
            <a href="/privacy" className="underline hover:text-fmt-accent" target="_blank" rel="noopener">
              privacy policy
            </a>
            .
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={!canUpload}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[240px]"
        >
          Build my profile
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setPhase('manual_form')
          }}
          className="text-sm text-fmt-ink-2 underline hover:text-fmt-accent-deep"
        >
          {FINDER_V2.manualLink}
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared article-type + subspecialty inputs                           */
/* ------------------------------------------------------------------ */

function TypeAndScope({
  articleType,
  setArticleType,
  subspecialty,
  setSubspecialty,
}: {
  articleType: ArticleType | ''
  setArticleType: (t: ArticleType) => void
  subspecialty: ScopeTag | null
  setSubspecialty: (s: ScopeTag | null) => void
}) {
  return (
    <>
      <div>
        <label htmlFor="finder-type" className="mb-1 block text-sm font-medium text-fmt-ink">
          Article type <span className="text-fmt-bad">*</span>
        </label>
        <select
          id="finder-type"
          value={articleType}
          onChange={(e) => setArticleType(e.target.value as ArticleType)}
          className="w-full rounded-lg border border-fmt-hairline bg-white px-4 py-2.5 text-sm text-fmt-ink focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40"
        >
          <option value="">Select an article type…</option>
          {ARTICLE_TYPE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-fmt-ink">
          Subspecialty <span className="font-normal text-fmt-ink-3">(optional, sharpens the ladder)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {SCOPE_TAGS.map((tag) => {
            const active = subspecialty === tag
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => setSubspecialty(active ? null : tag)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-fmt-accent bg-fmt-accent/10 text-fmt-accent-deep'
                    : 'border-fmt-hairline bg-white text-fmt-ink-2 hover:border-fmt-ink-3'
                }`}
              >
                {SCOPE_TAG_LABELS[tag]}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
