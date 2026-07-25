import type { Metadata } from 'next'
import Link from 'next/link'
import { JOURNAL_SUMMARIES } from '@/lib/formatting/journalList'
import { getDemoSpecs } from '@/lib/formatting/demoSpecs'
import FormatClient from './FormatClient'
import WordDemo from '../../_components/WordDemo'
import FormatterMotion from '../../_components/FormatterMotion'
import { StudioNav, StudioFooter } from '../../_components/StudioChrome'
import { DISCLAIMER, HOW_IT_WORKS, NEVER_DOES } from '../../_copy'
import { studioBreadcrumb, studioMetadata, studioToolSchema } from '../../_seo'

const JOURNAL_COUNT = JOURNAL_SUMMARIES.length

// Derived at build time on the server from the real encoded rule files, then
// handed to the client component as a prop — same contract as JOURNAL_SUMMARIES,
// so no rule JSON reaches the client bundle.
const DEMO_SPECS = getDemoSpecs()

export const metadata: Metadata = studioMetadata({
  title: 'Format a manuscript | Submission Studio by OSCRSJ',
  description: `Upload your Word manuscript, pick one of ${JOURNAL_COUNT} orthopedic journals, and download a submission-ready .docx with verified references and a transparent compliance report. Free to use. OSCRSJ never rewrites your science.`,
  path: '/studio/format',
  social: `Format your orthopedic manuscript to any of ${JOURNAL_COUNT} target journals in minutes. Deterministic formatting, verified references, and a transparent compliance report. Free to use.`,
})

// Tool-level schema. A crawler or an LLM can land on this URL directly without
// ever seeing the hub, so the page states what it is on its own terms and ties
// back to the hub entity via isPartOf. Claims here are limited to what the
// pipeline actually does (see lib/formatting/**) — nothing aspirational.
const toolLd = studioToolSchema({
  name: 'Format a manuscript — Submission Studio',
  path: '/studio/format',
  description: `Formats an orthopedic manuscript to a target journal's published house style across ${JOURNAL_COUNT} journals, verifies references against Crossref and PubMed, and returns a transparent compliance report. Body prose is never rewritten.`,
  featureList: [
    'Deterministic formatting to a journal\u2019s published Guide for Authors',
    'Reference verification and renumbering against Crossref and PubMed',
    'Journal-styled reference list for the target journal',
    'Transparent per-rule compliance report',
    'Immutability guarantee: body prose is not altered',
  ],
})

export default function FormatToolPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            toolLd,
            studioBreadcrumb([{ name: 'Format a manuscript', path: '/studio/format' }]),
          ]),
        }}
      />
      <FormatterMotion />
      <StudioNav />

      {/* ---------- SEE IT WORK (interactive Word demo) ----------
           Deliberately ABOVE the upload form (Kanwar directive): show what the
           tool does before asking anyone to hand over an unpublished manuscript.
           Starts on the author's own unformatted draft so the first transition is
           a real before/after rather than a tweak. */}
      <section id="see-it" style={{ paddingBottom: '64px', scrollMarginTop: '80px' }}>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">Tool 01</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--fmt-ink-3)' }}>
              {JOURNAL_COUNT} journals supported
            </span>
          </div>
          <h1 className="reveal">Format a manuscript</h1>
          <p className="sub reveal" style={{ marginTop: '16px', maxWidth: '72ch' }}>
            Start with your draft, pick a target journal, and watch the document change. Font, spacing, line numbers,
            margins, and the shape of every citation are read straight from that journal&apos;s published Guide for
            Authors. This is not a mockup: it is the exact ruleset the Studio applies to your manuscript.
          </p>
          <div className="reveal" style={{ marginTop: '36px' }}>
            <WordDemo specs={DEMO_SPECS} />
          </div>
          <div className="reveal" style={{ marginTop: '36px' }}>
            <a className="btn btn-primary" href="#app">
              Do this to my manuscript ↓
            </a>
          </div>
        </div>
      </section>

      {/* ---------- THE TOOL ---------- */}
      <section
        id="app"
        style={{
          paddingTop: '72px',
          paddingBottom: '72px',
          background: 'var(--fmt-surface)',
          borderTop: '1px solid var(--fmt-hairline)',
          borderBottom: '1px solid var(--fmt-hairline)',
          scrollMarginTop: '80px',
        }}
      >
        <div className="wrap">
          <div className="rule-head" style={{ borderTopColor: '#DDDDE4' }}>
            <span className="kicker">Your manuscript</span>
          </div>
          <h2 className="reveal">Format yours</h2>
          <p className="sub reveal" style={{ marginTop: '16px', maxWidth: '70ch' }}>
            Upload your .docx, choose your target journal, and download a submission-ready manuscript with references
            verified and renumbered. Free to use. Your files are used only to produce your output, and nothing is
            published or indexed.{' '}
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
