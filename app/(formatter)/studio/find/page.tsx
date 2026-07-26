import type { Metadata } from 'next'
import Link from 'next/link'
import { JOURNAL_SUMMARIES } from '@/lib/formatting/journalList'
import FinderClient from '../../_components/FinderClient'
import FormatterMotion from '../../_components/FormatterMotion'
import { StudioNav, StudioFooter } from '../../_components/StudioChrome'
import { DISCLAIMER, FINDER_V2 } from '../../_copy'
import { studioBreadcrumb, studioMetadata, studioToolSchema } from '../../_seo'

const JOURNAL_COUNT = JOURNAL_SUMMARIES.length

export const metadata: Metadata = studioMetadata({
  title: 'Find a journal | Submission Studio by OSCRSJ',
  description: `Upload your manuscript and get a reach, target and safety ladder across ${JOURNAL_COUNT} orthopedic journals. Every study characteristic we report carries the sentence from your text that states it. Tier alignment, not a prediction of acceptance. Free to use.`,
  path: '/studio/find',
  social: `Where does your manuscript actually belong? Two journals worth reaching for, two aligned targets, one dependable fallback, across ${JOURNAL_COUNT} orthopedic journals. Free to use.`,
})

// Tool-level schema. v2 does band journals into tiers, so the schema says so —
// but it still must not imply an acceptance prediction, because the tool does
// not make one. "Tier alignment" is the honest description and the wording here
// deliberately matches the on-page disclaimer.
const toolLd = studioToolSchema({
  name: 'Find a journal — Submission Studio',
  path: '/studio/find',
  description: `Builds an evidence-quoted profile of a manuscript's study characteristics, then lays out a reach, target and safety ladder across ${JOURNAL_COUNT} orthopedic journals, banded by SJR standing among the journals eligible for that manuscript. Reports tier alignment, never a probability of acceptance.`,
  featureList: [
    'Manuscript profile with a verbatim quote behind every extracted fact',
    'Reach, target and safety ladder banded by SJR standing among eligible journals',
    'Article-type eligibility gating',
    'Formatting-fit detail with exact over-limit deltas per journal',
    'No self-preference: OSCRSJ is excluded from the ladder and disclosed separately',
  ],
})

const howScored = [
  {
    step: '1',
    title: 'Eligibility first',
    body: 'A journal that does not accept your article type is not a near miss, it is a no. Those are gated out before anything is banded, and listed separately so you can see why.',
  },
  {
    step: '2',
    title: 'Then a tier, relative to your options',
    body: 'Every eligible journal is placed by its SJR standing among the journals eligible for YOUR manuscript, not against the whole field. A spine case series is banded among spine venues that take case series.',
  },
  {
    step: '3',
    title: 'Evidence, or a dash',
    body: 'Each study characteristic we report carries the sentence from your manuscript that states it, checked as a real substring before we use it. Where the text is silent we show a dash rather than a guess.',
  },
  {
    step: '4',
    title: 'No thumb on the scale',
    body: 'OSCRSJ is removed from the ladder before any journal is placed in it. Our own journal appears only as a separate card that says it is ours and that its appearance owes nothing to your assessment.',
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
              {JOURNAL_COUNT} journals ranked
            </span>
          </div>
          <h1 className="reveal">{FINDER_V2.heroTitle}</h1>
          <p className="sub reveal" style={{ marginTop: '16px', maxWidth: '70ch' }}>
            {FINDER_V2.heroSub}
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
                Send it straight into the formatter. Every rung of the ladder carries a &ldquo;Format for this
                journal&rdquo; link that preselects it for you.
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
