// Submission Studio -- free-run allowance + unlock survey (Sushant, 2026-07-26).
//
// Covers the two pieces of logic that decide whether a real user gets to use
// the tool, and which are therefore the expensive ones to get wrong:
//
//   1. WHAT CONSUMES A RUN. Completed runs cost a slot, failures are free, and
//      in-flight work holds a slot only for the grace window. Each of those is
//      a promise made in writing on /studio/terms, so each has a test.
//   2. THAT THE ONE RESET IS EXACTLY ONE. The double-submit case is the normal
//      case (slow response, impatient second click), not an exotic one.
//
// Plus the survey validator and, importantly, that surveySheetRow() lines up
// with surveySheetHeaders(). A drift there does not throw; it silently files
// every answer under the wrong column, and nobody notices until the analysis.
//
// No database. Every quota function takes an admin client as its last argument
// precisely so it can be driven by the fake below, which is a small stand-in
// for the slice of the PostgREST builder these functions actually use.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  STUDIO_FREE_RUNS,
  STUDIO_MAX_RESETS,
  daysUntilPaid,
  studioIsFree,
  normalizeEmail,
} from '@/lib/studio/quotaConstants'
import {
  getQuotaStatus,
  checkStudioQuota,
  grantSurveyReset,
  IN_FLIGHT_GRACE_MINUTES,
} from '@/lib/studio/quota'
import {
  validateSurvey,
  surveySheetHeaders,
  surveySheetRow,
  promotedColumns,
  visibleQuestions,
  SURVEY_QUESTIONS,
  OTHER_PREFIX,
} from '@/lib/studio/survey'

// ---------------------------------------------------------------------------
// A fake PostgREST builder good enough for the two tables quota.ts touches.
// ---------------------------------------------------------------------------
function fakeAdmin(opts: {
  jobs: Array<{ status: string; created_at: string }>
  quotaRow?: {
    email: string
    quota_reset_at: string | null
    reset_count: number
    survey_completed_at: string | null
    reset_survey_id: string | null
  } | null
  onQuotaUpdate?: (patch: Record<string, unknown>, matchedLt: number | null) => boolean
  onQuotaInsert?: (row: Record<string, unknown>) => boolean
}) {
  let quotaRow = opts.quotaRow ?? null
  const api: any = {
    from(table: string) {
      if (table === 'formatting_jobs') {
        let gte: string | null = null
        const b: any = {
          select: () => b,
          eq: () => b,
          gte: (_c: string, v: string) => {
            gte = v
            return b
          },
          order: () => b,
          limit: () =>
            Promise.resolve({
              data: opts.jobs.filter((j) => (gte ? j.created_at >= gte : true)),
              error: null,
            }),
        }
        return b
      }
      if (table === 'studio_email_quota') {
        let ltValue: number | null = null
        const b: any = {
          select: () => b,
          eq: () => b,
          lt: (_c: string, v: number) => {
            ltValue = v
            return b
          },
          maybeSingle: () => Promise.resolve({ data: quotaRow, error: null }),
          insert: (row: Record<string, unknown>) => {
            const ok = opts.onQuotaInsert ? opts.onQuotaInsert(row) : true
            if (ok) quotaRow = row as any
            return Promise.resolve({ error: ok ? null : { message: 'conflict' } })
          },
          update: (patch: Record<string, unknown>) => {
            const chain: any = {
              eq: () => chain,
              lt: (_c: string, v: number) => {
                ltValue = v
                return chain
              },
              select: () => {
                const allowed =
                  opts.onQuotaUpdate
                    ? opts.onQuotaUpdate(patch, ltValue)
                    : quotaRow !== null && (ltValue === null || quotaRow.reset_count < ltValue)
                if (allowed && quotaRow) Object.assign(quotaRow, patch)
                return Promise.resolve({
                  data: allowed ? [{ email: quotaRow?.email ?? 'x' }] : [],
                  error: null,
                })
              },
            }
            return chain
          },
        }
        return b
      }
      throw new Error('unexpected table ' + table)
    },
    _row: () => quotaRow,
  }
  return api
}

const NOW = new Date('2026-07-26T12:00:00Z')
const ago = (mins: number) => new Date(NOW.getTime() - mins * 60_000).toISOString()

/* ------------------------------ quota counting --------------------------- */

test('completed runs consume the allowance', async () => {
  const a = fakeAdmin({
    jobs: [
      { status: 'complete', created_at: ago(1000) },
      { status: 'complete', created_at: ago(900) },
    ],
  })
  const s = await getQuotaStatus('A@Example.COM ', NOW, a)
  assert.equal(s.email, 'a@example.com')
  assert.equal(s.completedRuns, 2)
  assert.equal(s.used, 2)
  assert.equal(s.remaining, STUDIO_FREE_RUNS - 2)
  assert.equal(s.locked, false)
})

test('failed runs are free and never consume a slot', async () => {
  const a = fakeAdmin({
    jobs: [
      { status: 'failed', created_at: ago(10) },
      { status: 'failed', created_at: ago(20) },
      { status: 'failed', created_at: ago(30) },
      { status: 'failed', created_at: ago(40) },
      { status: 'complete', created_at: ago(50) },
    ],
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.used, 1, 'four failures cost nothing')
  assert.equal(s.remaining, STUDIO_FREE_RUNS - 1)
})

test('an in-flight job holds a slot, then stops counting after the grace window', async () => {
  const fresh = fakeAdmin({ jobs: [{ status: 'parsed', created_at: ago(5) }] })
  assert.equal((await getQuotaStatus('x@y.com', NOW, fresh)).used, 1)

  const stale = fakeAdmin({
    jobs: [{ status: 'parsed', created_at: ago(IN_FLIGHT_GRACE_MINUTES + 1) }],
  })
  assert.equal((await getQuotaStatus('x@y.com', NOW, stale)).used, 0)
})

test('parking jobs cannot hoard capacity past the grace window', async () => {
  const a = fakeAdmin({
    jobs: Array.from({ length: 50 }, () => ({
      status: 'uploaded',
      created_at: ago(IN_FLIGHT_GRACE_MINUTES + 60),
    })),
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.used, 0)
  assert.equal(s.locked, false)
})

test('three completed runs locks the address and offers the survey', async () => {
  const a = fakeAdmin({
    jobs: Array.from({ length: STUDIO_FREE_RUNS }, (_, i) => ({
      status: 'complete',
      created_at: ago(100 + i),
    })),
  })
  const gate = await checkStudioQuota('x@y.com', NOW, a)
  assert.equal(gate.ok, false)
  assert.equal(gate.code, 'quota_exhausted')
  assert.match(gate.reason!, /survey/i)
  assert.equal(gate.status!.canUnlockWithSurvey, true)
})

test('after the one reset is spent, the wall is final and the message changes', async () => {
  const a = fakeAdmin({
    jobs: Array.from({ length: STUDIO_FREE_RUNS }, () => ({
      status: 'complete',
      created_at: ago(10),
    })),
    quotaRow: {
      email: 'x@y.com',
      quota_reset_at: ago(1000),
      reset_count: STUDIO_MAX_RESETS,
      survey_completed_at: ago(1000),
      reset_survey_id: 's1',
    },
  })
  const gate = await checkStudioQuota('x@y.com', NOW, a)
  assert.equal(gate.code, 'quota_exhausted_final')
  assert.equal(gate.status!.canUnlockWithSurvey, false)
  assert.doesNotMatch(gate.reason!, /Answer a short feedback survey/i)
})

test('the reset epoch excludes older runs without deleting them', async () => {
  const resetAt = ago(500)
  const a = fakeAdmin({
    jobs: [
      { status: 'complete', created_at: ago(600) }, // before epoch
      { status: 'complete', created_at: ago(550) }, // before epoch
      { status: 'complete', created_at: ago(100) }, // after epoch
    ],
    quotaRow: {
      email: 'x@y.com',
      quota_reset_at: resetAt,
      reset_count: 1,
      survey_completed_at: resetAt,
      reset_survey_id: 's1',
    },
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.used, 1, 'only post-reset runs count')
  assert.equal(s.remaining, STUDIO_FREE_RUNS - 1)
})

test('a database error fails CLOSED as retryable, not as a lockout', async () => {
  const broken: any = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          gte: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }) }),
          order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }),
        }),
      }),
    }),
  }
  const gate = await checkStudioQuota('x@y.com', NOW, broken)
  assert.equal(gate.ok, false)
  assert.equal(gate.code, 'quota_unavailable', 'must be a 503, not a 429')
})

/* ------------------------------ reset granting --------------------------- */

test('a first-time reset is granted and restores the full allowance', async () => {
  const a = fakeAdmin({
    jobs: Array.from({ length: STUDIO_FREE_RUNS }, () => ({
      status: 'complete',
      created_at: ago(600),
    })),
    quotaRow: null,
  })
  const r = await grantSurveyReset('x@y.com', 'survey-1', NOW, a)
  assert.equal(r.granted, true)
  assert.equal(r.status!.remaining, STUDIO_FREE_RUNS, 'old runs no longer count')
  assert.equal(r.status!.locked, false)
})

test('a double submit grants exactly once', async () => {
  const a = fakeAdmin({
    jobs: Array.from({ length: STUDIO_FREE_RUNS }, () => ({
      status: 'complete',
      created_at: ago(600),
    })),
    quotaRow: null,
  })
  const first = await grantSurveyReset('x@y.com', 's1', NOW, a)
  const second = await grantSurveyReset('x@y.com', 's2', NOW, a)
  assert.equal(first.granted, true)
  assert.equal(second.granted, false, 'the second click must not grant a second reset')
  assert.match(second.reason!, /already used/i)
  assert.equal(a._row().reset_count, STUDIO_MAX_RESETS)
})

test('a reset is refused once reset_count is at the cap', async () => {
  const a = fakeAdmin({
    jobs: [],
    quotaRow: {
      email: 'x@y.com',
      quota_reset_at: ago(10),
      reset_count: STUDIO_MAX_RESETS,
      survey_completed_at: ago(10),
      reset_survey_id: 's1',
    },
  })
  const r = await grantSurveyReset('x@y.com', 's2', NOW, a)
  assert.equal(r.granted, false)
})

/* ------------------------------ survey ----------------------------------- */

const goodAnswers = () => ({
  tools_used: ['Manuscript Formatter'],
  usefulness: 4,
  time_saved: 'Saved me about an hour',
  output_usable: 'Most of it, minor fixes',
  problems: ['Tables', 'References or citation style'],
  most_important_fix: 'Table borders came out wrong every single time.',
  fair_price: '$10 to $25',
})

test('a complete submission validates', () => {
  const r = validateSurvey(goodAnswers())
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(r.clean!.usefulness, 4)
})

test('every required question is actually enforced', () => {
  const required = SURVEY_QUESTIONS.filter((q) => q.required && !q.showIf).map((q) => q.id)
  for (const id of required) {
    const a: any = goodAnswers()
    delete a[id]
    const r = validateSurvey(a)
    assert.equal(r.ok, false, `${id} should be required`)
    assert.ok(r.errors[id], `${id} should carry its own error message`)
  }
})

test('an option the server does not know is rejected', () => {
  const r = validateSurvey({ ...goodAnswers(), fair_price: '$1,000,000' })
  assert.equal(r.ok, false)
  assert.ok(r.errors.fair_price)
})

test('"Other" is accepted only when it carries text', () => {
  const empty = validateSurvey({ ...goodAnswers(), problems: [OTHER_PREFIX] })
  assert.equal(empty.ok, false, 'a bare Other prefix is not an answer')

  const filled = validateSurvey({
    ...goodAnswers(),
    problems: [OTHER_PREFIX + 'Equations were mangled'],
  })
  assert.equal(filled.ok, true)
  assert.deepEqual(filled.clean!.problems, [OTHER_PREFIX + 'Equations were mangled'])
})

test('the too-short free text is caught', () => {
  const r = validateSurvey({ ...goodAnswers(), most_important_fix: 'good' })
  assert.equal(r.ok, false)
  assert.match(r.errors.most_important_fix, /at least/i)
})



test('the sheet row lines up with the sheet header, every column', () => {
  const answers = validateSurvey(goodAnswers()).clean!
  const headers = surveySheetHeaders()
  const row = surveySheetRow({
    submittedAtIso: NOW.toISOString(),
    email: 'x@y.com',
    answers,
    grantedReset: true,
    durationSeconds: 142,
    followUpOk: true,
  })
  assert.equal(row.length, headers.length, 'a header/row mismatch silently misfiles every answer')
  assert.equal(row[headers.indexOf('Email')], 'x@y.com')
  assert.equal(row[headers.indexOf('Granted Reset')], 'yes')
  assert.equal(row[headers.indexOf('Usefulness (1-5)')], 4)
  assert.equal(
    row[headers.indexOf('Problems')],
    'Tables; References or citation style',
    'multi-selects join with the shared delimiter',
  )
})

test('the one promoted column is pulled out of the blob', () => {
  const p = promotedColumns(validateSurvey(goodAnswers()).clean!)
  assert.equal(p.usefulness, 4)
})

test('the cut questions are really gone from the definition', () => {
  // Cut 2026-07-26 (Kanwar). Asserted rather than assumed because a stray
  // re-add would silently reintroduce a column nothing persists.
  const ids = SURVEY_QUESTIONS.map((q) => q.id)
  for (const gone of ['role', 'journal_available', 'missing_journal', 'willingness_to_pay', 'anything_else']) {
    assert.ok(!ids.includes(gone), `${gone} should no longer be a question`)
  }
  const price = SURVEY_QUESTIONS.find((q) => q.id === 'fair_price')!
  assert.ok(!price.options!.includes('It should be free'), 'the free option was removed')
})

/* ------------------------------ free period ------------------------------ */

test('the free period ends at Pacific midnight, not UTC midnight', () => {
  assert.equal(studioIsFree(new Date('2026-09-01T06:59:00Z')), true, 'still Aug 31 in California')
  assert.equal(studioIsFree(new Date('2026-09-01T07:00:00Z')), false)
})

test('the countdown counts whole days', () => {
  assert.equal(daysUntilPaid(new Date('2026-08-31T07:00:00Z')), 1)
  assert.ok(daysUntilPaid(new Date('2026-09-02T07:00:00Z')) < 0)
})

test('email normalisation is shared by the client and the server', () => {
  assert.equal(normalizeEmail('  MiXeD@Case.Com  '), 'mixed@case.com')
})

/* ------------- regressions found in adversarial review, 2026-07-26 --------- */

test('REGRESSION: in-flight jobs lock the address but must NOT offer the survey', async () => {
  // Three failed uploads inside the grace window look like "3 used". Offering
  // the survey here would spend the one lifetime reset for zero completed work,
  // and the reset would appear to work because it advances the epoch.
  const a = fakeAdmin({
    jobs: Array.from({ length: STUDIO_FREE_RUNS }, () => ({
      status: 'uploaded',
      created_at: ago(5),
    })),
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.locked, true, 'still locked: the slots are genuinely held')
  assert.equal(s.completedRuns, 0)
  assert.equal(s.canUnlockWithSurvey, false, 'MUST NOT burn the reset on nothing')
  assert.equal(s.lockedByInFlightOnly, true)

  const gate = await checkStudioQuota('x@y.com', NOW, a)
  assert.equal(gate.code, 'quota_in_flight')
  assert.doesNotMatch(gate.reason!, /survey/i, 'the message must not mention the survey')
})

test('REGRESSION: a quota-table read error is a retryable 503, never a silent lockout', async () => {
  // Most likely on the deploy where code ships before migration 031 runs.
  // Returning null there made quota_reset_at look null and reset_count look 0:
  // a hard lockout for everyone with 3+ lifetime jobs, blamed on the user.
  const a: any = {
    from: (t: string) => {
      if (t === 'studio_email_quota') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: { message: 'relation does not exist' } }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
            order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          }),
        }),
      }
    },
  }
  const gate = await checkStudioQuota('x@y.com', NOW, a)
  assert.equal(gate.code, 'quota_unavailable', 'must be our fault (503), not theirs (429)')
})

test('REGRESSION: a genuinely absent quota row is normal, not an error', async () => {
  const a = fakeAdmin({ jobs: [{ status: 'complete', created_at: ago(10) }], quotaRow: null })
  const s = await getQuotaStatus('new@user.com', NOW, a)
  assert.equal(s.used, 1)
  assert.equal(s.resetCount, 0)
})

test('REGRESSION: an in-flight lock resolves itself once the job fails', async () => {
  const a = fakeAdmin({
    jobs: [
      { status: 'failed', created_at: ago(5) },
      { status: 'failed', created_at: ago(4) },
      { status: 'failed', created_at: ago(3) },
    ],
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.locked, false, 'three failures cost nothing at all')
  assert.equal(s.remaining, STUDIO_FREE_RUNS)
})

test('REGRESSION: a ticked but empty "Something else" is not a valid answer', () => {
  // Previously stored the literal "Other:  " as a real selection, which then
  // surfaced in the ranked problems list as a genuine write-in.
  const multi = validateSurvey({ ...goodAnswers(), problems: [OTHER_PREFIX + ' '] })
  assert.equal(multi.ok, false, 'an empty write-in must not pass on a multi-select')
})

test('REGRESSION: a write-in is stored with its whitespace collapsed', () => {
  const r = validateSurvey({
    ...goodAnswers(),
    problems: [OTHER_PREFIX + '  Equations were mangled  '],
  })
  assert.equal(r.ok, true)
  assert.deepEqual(r.clean!.problems, [OTHER_PREFIX + 'Equations were mangled'])
})

test('REGRESSION: a valid write-in alongside real options still passes', () => {
  const r = validateSurvey({
    ...goodAnswers(),
    problems: ['Tables', OTHER_PREFIX + 'Equations were mangled'],
  })
  assert.equal(r.ok, true)
  assert.deepEqual(r.clean!.problems, ['Tables', OTHER_PREFIX + 'Equations were mangled'])
})

/* ---------------- rolling weekly window (Kanwar revision, 2026-07-26) ------ */

const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString()

test('runs older than the window do not count', async () => {
  const a = fakeAdmin({
    jobs: [
      { status: 'complete', created_at: daysAgo(8) },
      { status: 'complete', created_at: daysAgo(9) },
      { status: 'complete', created_at: daysAgo(30) },
      { status: 'complete', created_at: daysAgo(1) },
    ],
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.used, 1, 'only the run inside the last 7 days counts')
  assert.equal(s.remaining, STUDIO_FREE_RUNS - 1)
  assert.equal(s.locked, false)
})

test('the allowance refills on its own without any survey', async () => {
  // Three runs, all just outside the window. Under the old lifetime model this
  // address was locked forever; under the weekly one it is simply back to full.
  const a = fakeAdmin({
    jobs: Array.from({ length: STUDIO_FREE_RUNS }, (_, i) => ({
      status: 'complete',
      created_at: daysAgo(7.5 + i),
    })),
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.used, 0)
  assert.equal(s.remaining, STUDIO_FREE_RUNS)
})

test('nextRunAvailableAt is the oldest counted run plus one window', async () => {
  const oldest = daysAgo(6)
  const a = fakeAdmin({
    jobs: [
      { status: 'complete', created_at: oldest },
      { status: 'complete', created_at: daysAgo(2) },
      { status: 'complete', created_at: daysAgo(1) },
    ],
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.locked, true)
  const expected = new Date(Date.parse(oldest) + 7 * 24 * 60 * 60 * 1000).toISOString()
  assert.equal(s.nextRunAvailableAt, expected, 'tells the user when a slot frees itself')
  // roughly one day out, which is the whole point of surfacing it
  assert.ok(Date.parse(s.nextRunAvailableAt!) > NOW.getTime())
})

test('nextRunAvailableAt is null when nothing is counted', async () => {
  const a = fakeAdmin({ jobs: [] })
  assert.equal((await getQuotaStatus('x@y.com', NOW, a)).nextRunAvailableAt, null)
})

test('the exhausted message offers BOTH the wait and the survey', async () => {
  const a = fakeAdmin({
    jobs: Array.from({ length: STUDIO_FREE_RUNS }, () => ({
      status: 'complete',
      created_at: daysAgo(2),
    })),
  })
  const gate = await checkStudioQuota('x@y.com', NOW, a)
  assert.equal(gate.code, 'quota_exhausted')
  assert.match(gate.reason!, /frees up/i, 'waiting must be presented as a real option')
  assert.match(gate.reason!, /survey/i)
  assert.match(gate.reason!, /week/i, 'must not imply a lifetime cap')
})

test('a reset inside the window starts the count from the reset, not 7 days back', async () => {
  const a = fakeAdmin({
    jobs: [
      { status: 'complete', created_at: daysAgo(3) }, // before the reset
      { status: 'complete', created_at: daysAgo(2) }, // before the reset
      { status: 'complete', created_at: daysAgo(0.5) }, // after
    ],
    quotaRow: {
      email: 'x@y.com',
      quota_reset_at: daysAgo(1),
      reset_count: 1,
      survey_completed_at: daysAgo(1),
      reset_survey_id: 's1',
    },
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.used, 1, 'the refill wiped the two runs that preceded it')
})

test('an OLD reset does not widen the window beyond 7 days', async () => {
  // The window start is max(reset, now-7d). A reset from a month ago must not
  // drag the lookback back to a month.
  const a = fakeAdmin({
    jobs: [
      { status: 'complete', created_at: daysAgo(20) },
      { status: 'complete', created_at: daysAgo(15) },
      { status: 'complete', created_at: daysAgo(1) },
    ],
    quotaRow: {
      email: 'x@y.com',
      quota_reset_at: daysAgo(30),
      reset_count: 1,
      survey_completed_at: daysAgo(30),
      reset_survey_id: 's1',
    },
  })
  const s = await getQuotaStatus('x@y.com', NOW, a)
  assert.equal(s.used, 1)
})

/* ---------------- admin bypass -------------------------------------------- */

test('the admin address bypasses the allowance entirely', async () => {
  const exploded = {
    from() {
      throw new Error('the admin path must not touch the database at all')
    },
  } as any
  const s = await getQuotaStatus('kanwarpartap@live.com', NOW, exploded)
  assert.equal(s.isAdmin, true)
  assert.equal(s.locked, false)
  assert.equal(s.used, 0)
  assert.equal(s.canUnlockWithSurvey, false, 'nothing to unlock, and no reset to spend')

  const gate = await checkStudioQuota('  KanwarPartap@Live.com ', NOW, exploded)
  assert.equal(gate.ok, true, 'case and whitespace insensitive')
})

test('a non-admin lookalike address is NOT treated as admin', async () => {
  const a = fakeAdmin({
    jobs: Array.from({ length: STUDIO_FREE_RUNS }, () => ({
      status: 'complete',
      created_at: daysAgo(1),
    })),
  })
  const s = await getQuotaStatus('kanwarpartap@live.com.evil.com', NOW, a)
  assert.equal(s.isAdmin, false)
  assert.equal(s.locked, true)
})

test('plus-addressing is deliberately NOT collapsed', async () => {
  // Kanwar directive: another address is another contact, and that is fine.
  assert.notEqual(normalizeEmail('a+one@x.com'), normalizeEmail('a@x.com'))
})
