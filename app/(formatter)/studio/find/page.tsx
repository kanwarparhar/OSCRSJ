import type { Metadata } from 'next'
import Link from 'next/link'
import { JOURNAL_SUMMARIES } from '@/lib/formatting/journalList'
import FinderClient from '../../_components/FinderClient'
import FormatterMotion from '../../_components/FormatterMotion'
import { StudioNav, StudioFooter } from '../../_components/StudioChrome'
import { DISCLAIMER } from '../../_copy'
import { studioBreadcrumb, studioMetadata, studioToolSchema } from '../../_seo'

const JOURNAL_COUNT = JOURNAL_SUMMARIES.length

export const metadata: Metadata = studioMetadata({
  title: 'Find a journal | Submission Studio by OSCRSJ',
  description: `Score your manuscript against ${JOURNAL_COUNT} orthopedic journals on the numbers that decide eligibility: article type, word count, abstract length, figures, tables, and references. See what fits and exactly how far over you are where it does not. Free to use.`,
  path: '/studio/find',
  social: `Which orthopedic journals is your manuscript eligible for? Score it against ${JOURNAL_COUNT} journals on the counts that decide eligibility, not on topical impression. Free to use.`,
})

// Tool-level schema. Deliberately describes a constraint checker, not a
// recommender — the Finder scores published limits and does not model
// acceptance odds or topical fit, and the schema should not imply otherwise.
const toolLd = studioToolSchema({
  name: 'Find a journal — Submission Studio',
  path: '/studio/find',
  description: `Scores a manuscript against ${JOURNAL_COUNT} orthopedic journals on published constraints: article-type eligibility, word count, abstract length, figures, tables, and references. Reports which journals fit, which are near misses, and the exact delta where a limit is exceeded.`,
  featureList: [
    'Article-type eligibility gating',
    'Word count, abstract, figure, table and reference limit checks',
    'Exact over-limit deltas rather than pass/fail',
    'Explicit count of how many of your numbers were actually checked',
    'No self-preference: OSCRSJ is scored by the same rules as every other journal',
  ],
})

const howScored = [
  {
    step: '1',
    title: 'Eligibility first',
    body: 'A journal that does not accept your article type is not a near miss, it is a no. Those are gated out before anything is scored, and listed separately so you can see why.',
  },
  {
    step: '2',
    title: 'Then the numbers',
    body: "Each of your counts is checked against that journal's published limit. Within limit fits. Up to ten percent over is a near miss. Beyond that is over, and we show you the exact delta.",
  },
  {
    step: '3',
    title: 'No thumb on the scale',
    body: 'OSCRSJ is scored by the same math as every other journal, with no boost. Where a journal publishes no limit, that constraint is neutral rather than a guess.',
  },
]

export default function FindToolPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            toolLd,
            studioBreadcrumb([{ name: 'Find a journal', path: '/studio/find' }]),
          ]),
        }}
      />
      <FormatterMotion />
      <StudioNav />

      {/* ---------- TOOL ---------- */}
      <section id="finder" style={{ paddingBottom: '72px', scrollMarginTop: '80px' }}>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">Tool 02</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--fmt-ink-3)' }}>
              {JOURNAL_COUNT} journals scored
            </span>
          </div>
          <h1 className="reveal">Find where your manuscript fits</h1>
          <p className="sub reveal" style={{ marginTop: '16px', maxWidth: '70ch' }}>
            Journal selection is a question of stated constraints, not topical impression. Enter your article type,
            word count, figure count, and reference count, and each value is checked against every journal&apos;s
            published limits: which journals your manuscript is eligible for, which of your counts fall within their
            limits, and the exact margin by which any limit is exceeded. Counts from a completed formatting job are
            carried over automatically. Only the values you enter are read; your manuscript text is never processed.
          </p>
          <div className="reveal" style={{ marginTop: '40px' }}>
            <FinderClient />
          </div>
        </div>
      </section>

      {/* ---------- HOW IT'S SCORED ---------- */}
      <section
        style={{
          background: 'var(--fmt-surface)',
          borderTop: '1px solid var(--fmt-hairline)',
          borderBottom: '1px solid var(--fmt-hairline)',
        }}
      >
        <div className="wrap">
          <div className="rule-head" style={{ borderTopColor: '#DDDDE4' }}>
            <span className="kicker">How it is scored</span>
          </div>
          <h2 className="reveal">Deterministic, and shown in full</h2>
          <div className="steps" style={{ marginTop: '48px' }}>
            {howScored.map((s) => (
              <div key={s.step} className="step reveal">
                <div className="num">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FOUND ONE? ---------- */}
      <section>
        <div className="wrap">
          <div className="cross-sell reveal">
            <div>
              <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Found your journal?</h2>
              <p style={{ color: 'var(--fmt-ink-2)', maxWidth: '60ch' }}>
                Send it straight into the formatter. Every result carries a &ldquo;Format for this journal&rdquo; link
                that preselects it for you.
              </p>
            </div>
            <Link className="btn btn-primary" href="/studio/format">
              Format a manuscript →
            </Link>
          </div>

          <div className="disclaimer reveal" style={{ maxWidth: '760px' }}>
            <strong style={{ color: 'var(--fmt-ink-2)' }}>Before you submit: </strong>
            {DISCLAIMER}{' '}
            <Link href="/studio/journals">See every supported journal and its last-verified date →</Link>
          </div>
        </div>
      </section>

      <StudioFooter />
    </>
  )
}
