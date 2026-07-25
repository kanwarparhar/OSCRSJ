import type { Metadata } from 'next'
import Link from 'next/link'
import { JOURNAL_SUMMARIES } from '@/lib/formatting/journalList'
import BeforeAfterDemo from '../_components/BeforeAfterDemo'
import FormatterMotion from '../_components/FormatterMotion'
import { StudioNav, StudioFooter } from '../_components/StudioChrome'
import { BUILT_WITH, DATA_HANDLING, DISCLAIMER, HOW_IT_WORKS, NEVER_DOES, SOURCES_LINE } from '../_copy'
import { studioBreadcrumb, studioMetadata } from '../_seo'

const JOURNAL_COUNT = JOURNAL_SUMMARIES.length

export const metadata: Metadata = studioMetadata({
  title: 'Submission Studio by OSCRSJ: free orthopedic manuscript tools',
  description: `Free tools for orthopedic authors. Find which of ${JOURNAL_COUNT} journals your manuscript is eligible for, then format it to that journal's published requirements in minutes. OSCRSJ never rewrites your science.`,
  path: '/studio',
  social: `Find where your manuscript fits across ${JOURNAL_COUNT} orthopedic journals, then format it to that journal's requirements. Free, with verified references and a transparent compliance report.`,
})

const faqs = [
  {
    q: 'Is Submission Studio free?',
    a: 'Yes. Both tools are free to use. We ask for your email only to prevent abuse of a free tool. Nothing is charged, and we do not share your address.',
  },
  {
    q: 'What file types can I upload?',
    a: 'A Microsoft Word .docx manuscript (up to 15 MB). You can optionally attach your figures as separate high-resolution image files (JPG, PNG, or TIFF).',
  },
  {
    q: 'Is my manuscript published or shared?',
    a: 'No. Your files are used only to produce your formatted output. Nothing is published or indexed, your work is never shown to another author or journal, and your download links expire after about an hour.',
  },
  {
    q: 'Does using the Studio submit my manuscript to OSCRSJ?',
    a: 'No. Formatting or scoring a manuscript here gives OSCRSJ no claim over your work and no visibility into where you submit it. You are free to format for any journal in the list, including our competitors.',
  },
  {
    q: 'Does formatting guarantee acceptance?',
    a: 'No. The Studio makes your manuscript compliant with a journal’s house style. It does not review or guarantee the science, and it is not affiliated with or endorsed by any journal listed. Always confirm against the journal’s current Guide for Authors before submitting.',
  },
  {
    q: 'Which journals are supported?',
    a: `${JOURNAL_COUNT} orthopedic journals today, each encoded directly from its published Guide for Authors and re-checked monthly. The full list, with the date each was last verified and a link to the source guide, is on the Supported journals page.`,
  },
  {
    q: 'What is the Journal Finder?',
    a: `A free tool that scores all ${JOURNAL_COUNT} orthopedic journals against your manuscript's actual numbers: article type, word count, abstract length, figures, tables, and references. It tells you which journals you are eligible for, which you fit, and exactly how far over each limit you are where you are not. It reads only the numbers you enter, never your manuscript text.`,
  },
  {
    q: 'What does the AI actually see?',
    a: 'A language model reads document structure only, meaning which lines are the title, authors, affiliations, and references. It never writes, paraphrases, or alters your prose. All formatting is applied by deterministic code.',
  },
]

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Submission Studio',
  alternateName: 'Submission Studio by OSCRSJ',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://www.oscrsj.com/studio',
  description:
    'Free tools that format an orthopedic manuscript to a target journal’s house style, verify references against Crossref and PubMed, and score every supported journal against a manuscript’s word count, figures, and article-type eligibility.',
  featureList: [
    'Deterministic journal formatting to house style',
    'Reference verification against Crossref and PubMed',
    'Transparent compliance report',
    'Journal Finder: eligibility and fit scoring across every supported journal',
  ],
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: {
    '@type': 'Organization',
    name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
    url: 'https://www.oscrsj.com',
  },
}

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function StudioHubPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([softwareLd, faqLd, studioBreadcrumb([])]) }}
      />
      <FormatterMotion />
      <StudioNav />

      {/* ---------- HERO ---------- */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="kicker reveal">
              Free to use · {JOURNAL_COUNT} orthopedic journals · references verified against Crossref &amp; PubMed
            </span>
            <h1 className="reveal">
              Manuscript formatting
              <br />
              and journal selection,
              <br />
              for orthopedic research.
            </h1>
            <p className="sub reveal">
              Two free tools from a working orthopedic journal. Find the journals your manuscript is actually eligible
              for, then format it to that journal&apos;s published requirements and download a submission-ready .docx
              with verified references. Neither tool changes a word of your science.
            </p>
            <div className="cta-row reveal">
              <Link className="btn btn-primary" href="/studio/format">
                Try it out for free now
              </Link>
              <Link className="btn btn-ghost" href="/studio/find">
                Find a journal →
              </Link>
            </div>
          </div>
          <BeforeAfterDemo />
        </div>
      </header>

      {/* ---------- THE TWO TOOLS ---------- */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">The tools</span>
          </div>
          <div className="tool-cards reveal">
            <Link className="tool-card" href="/studio/format">
              <span className="chip">Tool 01</span>
              <h3>Format a manuscript</h3>
              <p>
                Upload your .docx, pick a target journal, and download a manuscript formatted to that journal&apos;s
                house style, with references verified and renumbered and a plain-language compliance report.
              </p>
              <span className="go">Format a manuscript →</span>
            </Link>
            <Link className="tool-card" href="/studio/find">
              <span className="chip">Tool 02</span>
              <h3>Find a journal</h3>
              <p>
                Enter your article type and your real numbers. We score all {JOURNAL_COUNT} journals on eligibility and
                fit, and show you exactly how far over each limit you are where you do not fit.
              </p>
              <span className="go">Find a journal →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- STATS BAND ---------- */}
      <div className="stats">
        <div className="wrap grid">
          <div className="stat reveal">
            <div className="n" data-count="14">
              0
            </div>
            <div className="n small">hours</div>
            <div className="d">
              median time researchers spend formatting a single manuscript
              <a href="#sources" className="fn">
                1
              </a>
            </div>
          </div>
          <div className="stat reveal">
            <div className="n">
              $<span data-count="477">0</span>
            </div>
            <div className="d">
              median cost of formatting one paper, in your own wages
              <a href="#sources" className="fn">
                1
              </a>
            </div>
          </div>
          <div className="stat reveal">
            <div className="n">1 in 5</div>
            <div className="d">
              resubmissions delayed more than three months by reformatting alone
              <a href="#sources" className="fn">
                2
              </a>
            </div>
          </div>
          <div className="stat reveal">
            <div className="n">
              <span data-count="10000">0</span>+
            </div>
            <div className="d">
              citation styles in circulation. Your target journal wants exactly one
              <a href="#sources" className="fn">
                3
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- HOW IT WORKS ---------- */}
      <section
        id="how"
        style={{
          background: 'var(--fmt-surface)',
          borderTop: '1px solid var(--fmt-hairline)',
          borderBottom: '1px solid var(--fmt-hairline)',
          scrollMarginTop: '80px',
        }}
      >
        <div className="wrap">
          <div className="rule-head" style={{ borderTopColor: '#DDDDE4' }}>
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
          <div className="reveal" style={{ marginTop: '48px' }}>
            <Link className="btn btn-primary" href="/studio/format">
              Try it out for free now
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- WHAT IT NEVER DOES ---------- */}
      <section>
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
        </div>
      </section>

      {/* ---------- CONFIDENTIALITY ---------- */}
      <section
        id="confidentiality"
        style={{
          background: 'var(--fmt-surface)',
          borderTop: '1px solid var(--fmt-hairline)',
          borderBottom: '1px solid var(--fmt-hairline)',
          scrollMarginTop: '80px',
        }}
      >
        <div className="wrap">
          <div className="rule-head" style={{ borderTopColor: '#DDDDE4' }}>
            <span className="kicker">Confidentiality</span>
          </div>
          <h2 className="reveal">Your unpublished work stays yours</h2>
          <p className="sub reveal" style={{ marginTop: '16px', maxWidth: '70ch' }}>
            You are handing an unpublished manuscript to a website. That deserves a straight answer about what happens
            to it, so here is ours.
          </p>
          <div className="trust reveal" style={{ marginTop: '48px' }}>
            {DATA_HANDLING.map((d) => (
              <div key={d.title} className="cell">
                <h3>{d.title}</h3>
                <p>{d.body}</p>
              </div>
            ))}
          </div>
          <div className="built-with reveal">
            <h3>{BUILT_WITH.title}</h3>
            <p>{BUILT_WITH.body}</p>
          </div>
        </div>
      </section>

      {/* ---------- WHY WE BUILT THIS ---------- */}
      <section>
        <div className="wrap" style={{ maxWidth: '760px' }}>
          <div className="rule-head">
            <span className="kicker">Why we built this</span>
          </div>
          <h2 className="reveal">Good science stalls in the style-sheet stage</h2>
          <div
            className="reveal"
            style={{
              marginTop: '28px',
              display: 'grid',
              gap: '20px',
              fontSize: '17.5px',
              lineHeight: 1.7,
              color: 'var(--fmt-ink)',
            }}
          >
            <p>
              Researchers lose a median of fourteen hours, and $477 in their own time, formatting a single manuscript.
              <a href="#sources" className="fn">
                1
              </a>{' '}
              Not doing science. Moving margins, renumbering references, hunting the author-guidelines PDF for the
              running-title character limit.
            </p>
            <p>
              It gets worse after a rejection. Fewer than half of papers land at their first-choice journal,
              <a href="#sources" className="fn">
                2
              </a>{' '}
              and every new target means a new style sheet. Across the literature there are billions of possible
              combinations of formatting requirements,
              <a href="#sources" className="fn">
                4
              </a>{' '}
              and reformatting alone delays one in five resubmissions by more than three months.
              <a href="#sources" className="fn">
                2
              </a>{' '}
              Ninety-one percent of authors say this system needs to change.
              <a href="#sources" className="fn">
                2
              </a>
            </p>
            <p>
              We publish an orthopedic journal. We got tired of watching good science stall in the style-sheet stage, so
              we encoded the rules and automated the tedium. Paid services charge $75 per journal, per attempt, and take
              days.
              <a href="#sources" className="fn">
                5
              </a>{' '}
              This is free, takes minutes, and tells you exactly what it did.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- FAQ + DISCLAIMER + SOURCES ---------- */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: '760px' }}>
          <div className="rule-head">
            <span className="kicker">Questions</span>
          </div>
          <h2 className="reveal">Frequently asked</h2>
          <div className="reveal" style={{ marginTop: '32px' }}>
            {faqs.map((f) => (
              <div key={f.q} className="faq-item">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>

          <div className="disclaimer reveal">
            <strong style={{ color: 'var(--fmt-ink-2)' }}>Before you submit: </strong>
            {DISCLAIMER}
          </div>

          <div id="sources" className="srcs reveal" style={{ scrollMarginTop: '80px' }}>
            {SOURCES_LINE}
          </div>
        </div>
      </section>

      <StudioFooter />
    </>
  )
}
