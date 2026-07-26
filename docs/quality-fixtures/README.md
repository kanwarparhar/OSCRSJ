# Methodological quality grading — live reproducibility check

**Status: owed before wide launch. Not run yet.**

Everything in `tests/quality-extract.test.ts` runs against an **injected `fetchImpl`**, so
CI never touches the network and never spends a DeepSeek credit. That proves the
*plumbing* is deterministic: a fixed model response always yields a fixed
`MethodologyScore`.

It proves nothing about the model.

## What is actually unverified

`temperature: 0` is not a bit-reproducibility guarantee. The open question is how
much a **real** DeepSeek grading of a **real** manuscript moves between runs — and
because the grade feeds the ladder anchor (§4.4), any wobble becomes a wobble in
which journals an author is told to consider.

Two mitigations already exist in code:

1. **The content-hash cache** (`lib/quality/cache.ts`, migration `032`). Once a
   manuscript is graded, the same text under the same instrument returns the
   identical stored score forever. So in production, variance can only appear on
   the *first* grading of a given manuscript — not between one author's reloads.
2. **The kill switch.** `FINDER_INSTRUMENT_ANCHOR=off` in Vercel makes the score
   display-only: the card, the item table and the gap list all still render, but
   the ladder reverts to exactly the pre-instrument anchor. No redeploy needed.

The cache narrows the blast radius; it does not answer the question. If two
authors upload the *same* study and get materially different grades, that is a
real problem the cache hides rather than fixes.

## The N=5 test-retest, by hand

Run this before the feature is announced widely.

**Setup.** Needs `DEEPSEEK_API_KEY` in the environment. This spends real credit
(~$0.001–0.002 per grading, so ~$0.05 for the whole exercise).

1. Pick **five manuscripts spanning five designs** — ideally one each of
   `case_report` (CARE), `case_series` (MINORS non-comparative),
   `retrospective_comparative` (MINORS comparative), `prospective_cohort` (NOS),
   and one `systematic_review` (AMSTAR-2). Real submissions are best; the
   published OSCRSJ articles e0001–e0006 are a legitimate source and are already
   on disk.
2. For each, call `extractMethodology(body, design, comparative)` **five times**,
   bypassing the cache (pass no store).
3. Record for every run: `obtained`, `applicableMax`, `normalized`,
   `overallRating`, and the per-item verdict vector.

**What to look at, in priority order:**

| Question | Why it matters | Concern threshold |
|---|---|---|
| Does `normalized` move between runs of the same manuscript? | It is the anchor input. | Any spread > **0.10** is a problem — that is most of the ±0.15 adjustment band. |
| Do individual item verdicts flip? | A flipping item makes the "what to improve" list unstable. | More than ~1 item in 12 flipping across runs. |
| Do the flips cluster on particular items? | A systematically ambiguous item is a *prompt* problem, fixable. | Same item flipping on 3+ of 5 manuscripts. |
| Does `overallRating` (RoB 2 / AMSTAR-2) ever change? | It is a categorical published judgement. | **Any** change at all. |
| How often is a quote rejected (`quoteRejections`)? | High rejection means the model is paraphrasing. | > 2 per manuscript. |

**If it disappoints:** set `FINDER_INSTRUMENT_ANCHOR=off`. The grade stays
visible and useful as a checklist — which is most of its value to an author —
and stops steering recommendations. That is the honest failure mode, and it is
one environment variable.

## Also unverified

- **No live grading has been run at all.** Every score observed so far came from
  a mocked response. The prompt has never met a real manuscript.
- **The `not_met` vs `not_assessable` distinction** is the most semantically
  delicate thing being asked of the model, and it is load-bearing: `not_met`
  costs points, `not_assessable` leaves the denominator. Sample real outputs and
  read them before trusting the split.
- **Cost per grading** is estimated from the assess.ts call, not measured. The
  instrument prompt is larger (up to 24 items plus 6 readiness gates) and asks
  for up to 4096 output tokens against assess.ts's 2048, so it is likely to be
  the more expensive of the two calls per manuscript.
