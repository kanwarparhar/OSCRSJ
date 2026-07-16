import type { Metadata } from 'next'
import Link from 'next/link'
import { JOURNAL_SUMMARIES } from '@/lib/formatting/journalList'
import FormatClient from './FormatClient'
import FormatterMotion from '../../_components/FormatterMotion'
import { StudioNav, StudioFooter } from '../../_components/StudioChrome'
import { DISCLAIMER, HOW_IT_WORKS, NEVER_DOES } from '../../_copy'

const JOURNAL_COUNT = JOURNAL_SUMMARIES.length

export const metadata: Metadata = {
  title: { absolute: 'Format a manuscript | Submission Studio by OSCRSJ' },
  description: `Upload your Word manuscript, pick one of ${JOURNAL_COUNT} orthopedic journals, and download a submission-ready .docx with verified references and a transparent compliance report. Free to use. OSCRSJ never rewrites your science.`,
  alternates: { canonical: 'https://www.oscrsj.com/studio/format' },
  openGraph: {
    title: 'Format a manuscript | Submission Studio by OSCRSJ',
    description: `Format your orthopedic manuscript to any of ${JOURNAL_COUNT} target journals in minutes. Deterministic formatting, verified references, and a transparent compliance report. Free to use.`,
    url: 'https://www.oscrsj.com/studio/format',
    type: 'website',
  },
}

export default function FormatToolPage() {
  return (
    <>
      <FormatterMotion />
      <StudioNav />

      {/* ---------- TOOL ---------- */}
      <section id="app" style={{ paddingBottom: '72px', scrollMarginTop: '80px' }}>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">Tool 01</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--fmt-ink-3)' }}>
              {JOURNAL_COUNT} journals supported
            </span>
          </div>
          <h1 className="reveal">Format a manuscript</h1>
          <p className="sub reveal" style={{ marginTop: '16px', maxWidth: '70ch' }}>
            Upload your .docx, choose your target journal, and download a manuscript formatted to that journal&apos;s
            published requirements, with references verified and renumbered. Free to use. Your files are used only to
            produce your output, and nothing is published or indexed.{' '}
            <Link href="/studio#confidentiality">How we handle your manuscript →</Link>
          </p>
          <div className="reveal" style={{ marginTop: '40px' }}>
            <FormatClient journals={JOURNAL_SUMMARIES} />
          </div>
        </div>
      </section>

      {/* ---------- NOT SURE WHICH JOURNAL? ---------- */}
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
          <div className="cross-sell reveal">
            <div>
              <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Not sure which journal to target?</h2>
              <p style={{ color: 'var(--fmt-ink-2)', maxWidth: '60ch' }}>
                The Journal Finder scores all {JOURNAL_COUNT} journals against your manuscript&apos;s real numbers and
                tells you which you are eligible for, which you fit, and how far over you are where you do not.
              </p>
            </div>
            <Link className="btn btn-primary" href="/studio/find">
              Find a journal →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">How it works</span>
          </div>
          <h2 className="reveal">Three steps, a few minutes</h2>
          <div className="steps" style={{ marginTop: '48px' }}>
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="step reveal">
                <div className="num">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- GUARANTEES ---------- */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">What it never does</span>
          </div>
          <h2 className="reveal">Guarantees, not promises</h2>
          <div className="trust reveal" style={{ marginTop: '48px' }}>
            {NEVER_DOES.map((n) => (
              <div key={n.title} className="cell">
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </div>
            ))}
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
