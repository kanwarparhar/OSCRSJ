import type { Metadata } from 'next'
import Link from 'next/link'
import { JOURNAL_SUMMARIES } from '@/lib/formatting/journalList'
import JournalWall from '../../_components/JournalWall'
import FormatterMotion from '../../_components/FormatterMotion'
import { StudioNav, StudioFooter } from '../../_components/StudioChrome'
import { DISCLAIMER } from '../../_copy'

const JOURNAL_COUNT = JOURNAL_SUMMARIES.length

export const metadata: Metadata = {
  title: { absolute: `Supported journals: ${JOURNAL_COUNT} orthopedic journals | Submission Studio by OSCRSJ` },
  description: `Every one of the ${JOURNAL_COUNT} orthopedic journals Submission Studio supports, each encoded directly from its own published Guide for Authors, re-checked monthly, with the last-verified date and a link to the source guide so you can check our work.`,
  alternates: { canonical: 'https://www.oscrsj.com/studio/journals' },
  openGraph: {
    title: `Supported journals: ${JOURNAL_COUNT} orthopedic journals | Submission Studio by OSCRSJ`,
    description: `Every supported orthopedic journal, encoded from its own published Guide for Authors, re-checked monthly, with a link to the source guide for every one.`,
    url: 'https://www.oscrsj.com/studio/journals',
    type: 'website',
  },
}

function verifiedLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const wallJournals = JOURNAL_SUMMARIES.map((j) => ({
  slug: j.slug,
  name: j.name,
  publisher: j.publisher ?? 'Independent',
  guidelinesUrl: j.guidelinesUrl,
  verified: verifiedLabel(j.verifiedDate),
  typeCount: j.articleTypes.length,
}))

// Item 8 (Kanwar directive 2026-07-15): authors care that we are following the
// journal's CURRENT guideline, and want to be able to check. This section leads
// on provenance, and every card links out to the journal's own guide.
const provenance = [
  {
    step: '1',
    title: 'Read from the journal itself',
    body: "Every rule comes from that journal's own published Guide for Authors. Not a style database, not a third-party summary, not a guess from a similar journal.",
  },
  {
    step: '2',
    title: 'Re-checked every month',
    body: 'An automated freshness check re-reads each journal’s guide on a rolling monthly cycle and flags anything that has moved, so an encoded rule does not quietly drift from the live one.',
  },
  {
    step: '3',
    title: 'Dated, and open to inspection',
    body: 'Each card below shows the date its rules were last verified and links straight to the source guide. If you want to check our work against the journal’s own words, you should. Every card is that link.',
  },
]

export default function JournalsPage() {
  return (
    <>
      <FormatterMotion />
      <StudioNav />

      {/* ---------- HEAD ---------- */}
      <section id="journals" style={{ paddingBottom: '48px', scrollMarginTop: '80px' }}>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">Supported journals</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--fmt-ink-3)' }}>
              {JOURNAL_COUNT} and growing
            </span>
          </div>
          <h1 className="reveal">Encoded from the source</h1>
          <p className="sub reveal" style={{ marginTop: '16px', maxWidth: '70ch' }}>
            {JOURNAL_COUNT} orthopedic journals, each encoded directly from its own published Guide for Authors and
            re-checked monthly against the live page. Every card shows when its rules were last verified and links
            straight to the journal&apos;s guide, so you never have to take our word for it.
          </p>
        </div>
      </section>

      {/* ---------- PROVENANCE ---------- */}
      <section
        style={{
          paddingTop: '64px',
          paddingBottom: '64px',
          background: 'var(--fmt-surface)',
          borderTop: '1px solid var(--fmt-hairline)',
          borderBottom: '1px solid var(--fmt-hairline)',
        }}
      >
        <div className="wrap">
          <div className="rule-head" style={{ borderTopColor: '#DDDDE4' }}>
            <span className="kicker">Where the rules come from</span>
          </div>
          <h2 className="reveal">We follow the journal&apos;s current guideline, and we show our work</h2>
          <div className="steps" style={{ marginTop: '48px' }}>
            {provenance.map((p) => (
              <div key={p.step} className="step reveal">
                <div className="num">{p.step}</div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- THE WALL ---------- */}
      <section>
        <div className="wrap">
          <h2 className="reveal">All {JOURNAL_COUNT} journals</h2>
          <p className="sub reveal" style={{ marginTop: '12px', maxWidth: '60ch' }}>
            Search by journal or publisher. Every card opens that journal&apos;s Guide for Authors in a new tab.
          </p>
          <JournalWall journals={wallJournals} />

          <div className="cross-sell reveal" style={{ marginTop: '56px' }}>
            <div>
              <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Do not see your journal?</h2>
              <p style={{ color: 'var(--fmt-ink-2)', maxWidth: '60ch' }}>
                The list grows on author demand. Tell us which journal you are targeting and we will look at encoding
                it.
              </p>
            </div>
            <a className="btn btn-primary" href="/contact">
              Request a journal →
            </a>
          </div>

          <div className="disclaimer reveal" style={{ maxWidth: '760px' }}>
            <strong style={{ color: 'var(--fmt-ink-2)' }}>Before you submit: </strong>
            {DISCLAIMER}
          </div>

          <div className="reveal" style={{ marginTop: '32px' }}>
            <Link className="btn btn-primary" href="/studio/format">
              Try it out for free now
            </Link>
          </div>
        </div>
      </section>

      <StudioFooter />
    </>
  )
}
