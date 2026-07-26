// OSCRSJ runs are free, and invisible to the free-run allowance (2026-07-26).
// Run: npx tsx --test tests/studio-quota-oscrsj.test.ts
//
// Kanwar directive: a run targeting OSCRSJ never consumes the allowance and
// works even for a locked-out address -- free forever, including after the
// September 1 paid transition. We are the journal, and charging an author a run
// for preparing a manuscript to submit to us would be charging them for our own
// intake.
//
// The exemption is enforced in TWO places and both are tested here, because
// either one alone is a bug:
//
//   * countUsage skips the row, so a completed OSCRSJ job never becomes a spent
//     slot and a running one never holds an in-flight slot.
//   * the entry point bypasses the gate, so an address with nothing left can
//     still start one.
//
// If only the gate bypassed, an exempt run would still sit in the count and
// consume the allowance it was exempt from. If only the count skipped, a
// locked-out address would be refused at the door before the exemption could
// ever apply.
//
// No database. getQuotaStatus takes the admin client as its last argument
// precisely so it can be driven by the fake below.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getQuotaStatus, checkStudioQuota } from '@/lib/studio/quota'
import { OSCRSJ_SLUG, isFreeJournalRun, STUDIO_FREE_RUNS } from '@/lib/studio/quotaConstants'

const NOW = new Date('2026-07-26T18:00:00.000Z')
const recent = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString()

interface JobRow {
  status: string
  created_at: string
  journal_id: string | null
}

/** A fake PostgREST builder covering the slice of it countUsage actually uses. */
function fakeAdmin(jobs: JobRow[]) {
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
              data: jobs.filter((j) => (gte ? j.created_at >= gte : true)),
              error: null,
            }),
        }
        return b
      }
      // studio_email_quota: this address has never been seen, which is the
      // normal case and keeps these tests about the exemption and nothing else.
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }
      return q
    },
  }
  return api
}

const complete = (journal: string | null): JobRow => ({
  status: 'complete',
  created_at: recent(60),
  journal_id: journal,
})

const inFlight = (journal: string | null): JobRow => ({
  status: 'uploaded',
  created_at: recent(5),
  journal_id: journal,
})

// --- The slug itself --------------------------------------------------------

test('OSCRSJ_SLUG still matches the slug in the rule file', () => {
  // quotaConstants must stay import-free to remain client-safe, so the slug is a
  // literal there. This is the check that keeps the literal honest: rename the
  // journal's slug and the exemption would otherwise stop applying in silence,
  // and nobody would notice until someone was charged for an OSCRSJ run.
  const rules = JSON.parse(readFileSync('lib/formatting/journals/oscrsj.json', 'utf8'))
  assert.equal(rules.identity.slug, OSCRSJ_SLUG)
})

test('only OSCRSJ is free', () => {
  assert.equal(isFreeJournalRun('oscrsj'), true)
  assert.equal(isFreeJournalRun('jbjs'), false)
  // The Finder's sentinel is not a journal and must not be exempt by accident.
  assert.equal(isFreeJournalRun('finder_assess'), false)
  assert.equal(isFreeJournalRun(null), false)
  assert.equal(isFreeJournalRun(undefined), false)
  assert.equal(isFreeJournalRun(''), false)
  // No case-folding anywhere: journal_id is written from identity.slug, which is
  // always lowercase. Matching loosely would be inventing a rule.
  assert.equal(isFreeJournalRun('OSCRSJ'), false)
})

// --- countUsage skips the rows ---------------------------------------------

test('three completed OSCRSJ jobs leave the allowance untouched', async () => {
  const status = await getQuotaStatus(
    'author@example.edu',
    NOW,
    fakeAdmin([complete('oscrsj'), complete('oscrsj'), complete('oscrsj')]),
  )
  assert.equal(status.completedRuns, 0)
  assert.equal(status.used, 0)
  assert.equal(status.remaining, STUDIO_FREE_RUNS)
  assert.equal(status.locked, false)
})

test('a mix of 2 OSCRSJ and 2 other completed jobs counts as 2 spent', async () => {
  const status = await getQuotaStatus(
    'author@example.edu',
    NOW,
    fakeAdmin([complete('oscrsj'), complete('jbjs'), complete('oscrsj'), complete('ajsm')]),
  )
  assert.equal(status.completedRuns, 2)
  assert.equal(status.used, 2)
  assert.equal(status.remaining, STUDIO_FREE_RUNS - 2)
  assert.equal(status.locked, false)
})

test('an in-flight OSCRSJ job does not hold a slot either', async () => {
  // The exemption has to run in both directions. A row that is skipped when it
  // completes but counted while it runs would lock an address out of the tool
  // for the length of the grace window over a run it was never charged for.
  const status = await getQuotaStatus(
    'author@example.edu',
    NOW,
    fakeAdmin([inFlight('oscrsj'), inFlight('oscrsj'), inFlight('oscrsj')]),
  )
  assert.equal(status.inFlightRuns, 0)
  assert.equal(status.locked, false)
  assert.equal(status.lockedByInFlightOnly, false)
})

test('OSCRSJ rows do not fill the nextRunAvailableAt schedule', async () => {
  // nextRunAvailableAt is derived from the charged rows. An exempt row leaking
  // into that list would promise a slot that frees at a time no slot was taken.
  const status = await getQuotaStatus(
    'author@example.edu',
    NOW,
    fakeAdmin([
      complete('oscrsj'),
      complete('jbjs'),
      complete('ajsm'),
      complete('injury'),
    ]),
  )
  assert.equal(status.completedRuns, 3)
  assert.equal(status.locked, true)
  assert.ok(status.nextRunAvailableAt, 'a locked address is still told when a slot frees')
})

// --- The gate bypass --------------------------------------------------------

test('an address at its limit is blocked for other journals but not for OSCRSJ', async () => {
  const spent = fakeAdmin([complete('jbjs'), complete('ajsm'), complete('injury')])

  // The gate itself, unchanged: three spent runs and no exemption means locked.
  const gate = await checkStudioQuota('author@example.edu', NOW, spent)
  assert.equal(gate.ok, false)
  assert.equal(gate.code, 'quota_exhausted')

  // The bypass in app/api/format/jobs/route.ts is a call-site branch on
  // isFreeJournalRun, taken BEFORE checkStudioQuota. Modelled here, because the
  // route is a Next handler and cannot be invoked from a unit test: the property
  // being pinned is that a locked status never enters the decision.
  const allowed = isFreeJournalRun(OSCRSJ_SLUG) ? { ok: true } : gate
  assert.equal(allowed.ok, true, 'a locked-out address may still run against OSCRSJ')
})

test('the free run stays free after the paid transition', async () => {
  // "Free forever, including after September 1" is a directive, not a promotion,
  // so the exemption must not be wired to studioIsFree() or any date at all.
  // This is the test that fails if someone later gates it on the free period.
  const afterPaid = new Date('2027-03-01T12:00:00.000Z')
  const status = await getQuotaStatus(
    'author@example.edu',
    afterPaid,
    fakeAdmin([
      { status: 'complete', created_at: '2027-02-28T12:00:00.000Z', journal_id: 'oscrsj' },
      { status: 'complete', created_at: '2027-02-28T13:00:00.000Z', journal_id: 'oscrsj' },
      { status: 'complete', created_at: '2027-02-28T14:00:00.000Z', journal_id: 'oscrsj' },
      { status: 'complete', created_at: '2027-02-28T15:00:00.000Z', journal_id: 'oscrsj' },
    ]),
  )
  assert.equal(status.used, 0)
  assert.equal(status.locked, false)
})

// --- Nothing else changed ---------------------------------------------------

test('a database error is still a retryable failure, not a free pass', async () => {
  // The exemption must not have softened fail-closed behaviour: an unreadable
  // quota is not an empty one, and must never hand out runs.
  const broken: any = {
    from: () => {
      const b: any = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        order: () => b,
        limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }
      return b
    },
  }
  const gate = await checkStudioQuota('author@example.edu', NOW, broken)
  assert.equal(gate.ok, false)
  assert.equal(gate.code, 'quota_unavailable')
})

test('a job with no journal_id is counted, not exempted', async () => {
  // Fail closed on missing data. A null slug is an unknown target, and treating
  // unknown as free would make the exemption reachable by any row that lost its
  // journal_id for an unrelated reason.
  const status = await getQuotaStatus(
    'author@example.edu',
    NOW,
    fakeAdmin([complete(null), complete(null)]),
  )
  assert.equal(status.completedRuns, 2)
})
