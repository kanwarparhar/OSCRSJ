import type { Metadata } from 'next'
import { JOURNAL_SUMMARIES } from '@/lib/formatting/journalList'
import FormatClient from './FormatClient'
import BeforeAfterDemo from '../_components/BeforeAfterDemo'
import JournalWall from '../_components/JournalWall'
import FormatterMotion from '../_components/FormatterMotion'

export const metadata: Metadata = {
  // `absolute` so the layout's "%s | Journal Formatter" template doesn't append
  // to a title that already ends in "by OSCRSJ".
  title: { absolute: 'Journal Formatter — free orthopedic manuscript formatting | by OSCRSJ' },
  description:
    'Upload your Word manuscript, pick an orthopedic journal, and get a submission-ready, journal-compliant .docx with verified references and a transparent compliance report — in minutes. Free during beta. OSCRSJ never rewrites your science.',
  alternates: { canonical: 'https://www.oscrsj.com/format' },
  openGraph: {
    title: 'Journal Formatter — free orthopedic manuscript formatting | by OSCRSJ',
    description:
      'Format your orthopedic manuscript to a target journal in minutes — deterministic formatting, verified references, and a transparent compliance report. Free beta from OSCRSJ.',
    url: 'https://www.oscrsj.com/format',
    type: 'website',
  },
}

/* ------------------------------------------------------------------ */
/*  Copy deck (build brief §5) — verbatim; typo-level edits only.      */
/* ------------------------------------------------------------------ */

const JOURNAL_COUNT = JOURNAL_SUMMARIES.length

const howItWorks = [
  {
    step: '1',
    title: 'Upload your manuscript',
    body: 'Drop in your blinded manuscript as a Word .docx. Optionally attach figures as separate high-resolution files. Nothing is published — your files only produce your output.',
  },
  {
    step: '2',
    title: 'Pick a journal & article type',
    body: "Choose your target orthopedic journal and article type. The formatter loads that journal's exact requirements, encoded from its published Guide for Authors.",
  },
  {
    step: '3',
    title: 'Download and review',
    body: 'Get your journal-formatted manuscript and compliance report on the page — references verified and renumbered. Apply anything flagged, and submit with confidence.',
  },
]

// The four "It never…" guarantees — the product's spine (brief §3). Tightened per
// the approved mockup, not weakened.
const neverDoes = [
  {
    title: 'Never rewrites your science',
    body: 'Content immutability is guaranteed. An automated gate compares your text before and after — if anything but a citation marker moved, it refuses to ship.',
  },
  {
    title: 'AI reads structure only',
    body: 'A language model recognizes which lines are the title, authors, and references. It never writes, paraphrases, or "improves" your prose. All formatting is deterministic code.',
  },
  {
    title: 'Never upscales your figures',
    body: "Figures are checked against the journal's requirements and flagged honestly if they fall short — never re-rendered, upsampled, or artificially sharpened.",
  },
  {
    title: 'Never invents a requirement',
    body: "Where a journal's guide is silent, your original choice is preserved and noted in the report — not overwritten by a guess.",
  },
]

// Verbatim from the current /format page — legally worded; do not alter.
const disclaimer =
  'This tool applies formatting rules encoded from each journal’s published Guide for Authors, verified as of the date shown on every journal card below. Journal requirements change without notice. Always confirm your manuscript against the journal’s current Guide for Authors before you submit. The Journal Formatter is a free beta provided by OSCRSJ on an as-is basis; it does not guarantee acceptance and is not affiliated with, sponsored by, or endorsed by any of the journals listed.'

const faqs = [
  {
    q: 'Is the Journal Formatter free?',
    a: 'Yes — it is free during beta. We ask for your email only to track beta usage and prevent abuse; nothing is charged, and we do not share your address.',
  },
  {
    q: 'What file types can I upload?',
    a: 'A Microsoft Word .docx manuscript (up to 15 MB). You can optionally attach your figures as separate high-resolution image files (JPG, PNG, or TIFF).',
  },
  {
    q: 'Is my manuscript published or shared?',
    a: 'No. Your files are used only to produce your formatted output. Nothing is published, indexed, or shared, and your download links expire after about an hour.',
  },
  {
    q: 'Does formatting guarantee acceptance?',
    a: 'No. The formatter makes your manuscript compliant with a journal’s house style; it does not review or guarantee the science, and it is not affiliated with or endorsed by any journal listed. Always confirm against the journal’s current Guide for Authors before submitting.',
  },
  {
    q: 'Which journals are supported?',
    a: `${JOURNAL_COUNT} orthopedic journals today, each encoded directly from its published Guide for Authors and re-checked monthly. The full list, with the date each was last verified, is on this page.`,
  },
  {
    q: 'What does the AI actually see?',
    a: 'A language model reads document structure only — which lines are the title, authors, affiliations, and references. It never writes, paraphrases, or alters your prose; all formatting is applied by deterministic code.',
  },
]

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

/* ------------------------------------------------------------------ */
/*  Structured data (brief §5): SoftwareApplication + FAQPage.         */
/*  Built as objects + JSON.stringify so quotes escape correctly.      */
/* ------------------------------------------------------------------ */

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Journal Formatter',
  alternateName: 'Journal Formatter — by OSCRSJ',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://www.oscrsj.com/format',
  description:
    'Free tool that formats an orthopedic manuscript to a target journal’s house style, verifies references against Crossref and PubMed, and returns a submission-ready .docx with a transparent compliance report.',
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

/* ------------------------------------------------------------------ */

export default function FormatPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([softwareLd, faqLd]) }}
      />
      <FormatterMotion />

      {/* ---------- TOP BAR ---------- */}
      <nav className="fmt-nav">
        <div className="wrap">
          <span className="wordmark">
            Journal Formatter
            <a className="by" href="https://www.oscrsj.com">
              by OSCRSJ
            </a>
          </span>
          <span className="links">
            <a href="#how">How it works</a>
            <a href="#journals">Journals</a>
            <a href="#finder">Journal Finder</a>
            <a className="btn btn-primary" href="#app">
              Format a manuscript
            </a>
          </span>
        </div>
      </nav>

      {/* ---------- HERO ---------- */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="kicker reveal">
              Free during beta · {JOURNAL_COUNT} orthopedic journals · references verified against Crossref &amp; PubMed
            </span>
            <h1 className="reveal">
              Your science.
              <br />
              Their style sheet.
              <br />
              Done in minutes.
            </h1>
            <p className="sub reveal">
              Upload your orthopedic manuscript, pick a target journal, and download a submission-ready .docx with
              verified references and a plain-language compliance report. It never rewrites a word of your science.
            </p>
            <div className="cta-row reveal">
              <a className="btn btn-primary" href="#app">
                Format your manuscript — free
              </a>
              <a className="btn btn-ghost" href="#demo">
                See it work ↓
              </a>
            </div>
          </div>
          <BeforeAfterDemo />
        </div>
      </header>

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
              $
              <span data-count="477">0</span>
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

      {/* ---------- APP ---------- */}
      <section id="app" style={{ scrollMarginTop: '80px' }}>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">The tool</span>
          </div>
          <h2 className="reveal">Format a manuscript</h2>
          <p className="sub reveal" style={{ marginTop: '16px' }}>
            Free during beta. Your files are used only to produce your output — nothing is published or shared.
          </p>
          <div className="reveal" style={{ marginTop: '40px' }}>
            <FormatClient journals={JOURNAL_SUMMARIES} />
          </div>
        </div>
      </section>

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
            {howItWorks.map((s) => (
              <div key={s.step} className="step reveal">
                <div className="num">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
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
            {neverDoes.map((n) => (
              <div key={n.title} className="cell">
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- JOURNAL WALL ---------- */}
      <section id="journals" style={{ paddingTop: 0, scrollMarginTop: '80px' }}>
        <div className="wrap">
          <div className="rule-head">
            <span className="kicker">Supported journals</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--fmt-ink-3)' }}>
              {JOURNAL_COUNT} and growing
            </span>
          </div>
          <h2 className="reveal">Encoded from the source</h2>
          <JournalWall journals={wallJournals} />
          <p style={{ fontSize: '14px', color: 'var(--fmt-ink-3)', marginTop: '24px' }} className="reveal">
            Rules encoded directly from each journal&apos;s published Guide for Authors and re-checked monthly by an
            automated freshness cron.
          </p>
        </div>
      </section>

      {/* ---------- JOURNAL FINDER (shell — v1 lands in Session 2) ---------- */}
      <section
        id="finder"
        style={{
          background: 'var(--fmt-surface)',
          borderTop: '1px solid var(--fmt-hairline)',
          borderBottom: '1px solid var(--fmt-hairline)',
          scrollMarginTop: '80px',
        }}
      >
        <div className="wrap">
          <div className="rule-head" style={{ borderTopColor: '#DDDDE4' }}>
            <span className="kicker">Journal Finder</span>
            <span className="chip on">Coming soon</span>
          </div>
          <h2 className="reveal">Find where your manuscript actually fits</h2>
          <p className="sub reveal" style={{ marginTop: '16px' }}>
            The only journal finder that reads your actual manuscript — and the only one built just for orthopedics. Not
            topic vibes: your real word count, figures, and article type, checked against every journal&apos;s real
            limits.
          </p>
          <div className="finder-badge reveal">
            <span
              aria-hidden="true"
              style={{ width: '8px', height: '8px', borderRadius: '99px', background: 'var(--fmt-warn)' }}
            />
            Launching shortly — finish a formatting job and we&apos;ll tell you which journals your manuscript actually
            fits.
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
            style={{ marginTop: '28px', display: 'grid', gap: '20px', fontSize: '17.5px', lineHeight: 1.7, color: 'var(--fmt-ink)' }}
          >
            <p>
              Researchers lose a median of fourteen hours — and $477 in their own time — formatting a single manuscript.
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
              and every new target means a new style sheet — across the literature there are billions of possible
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
              We publish an orthopedic journal. We got tired of watching good science stall in the style-sheet stage — so
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
            <strong style={{ color: 'var(--fmt-ink-2)' }}>Before you submit — </strong>
            {disclaimer}
          </div>

          <div id="sources" className="srcs reveal" style={{ scrollMarginTop: '80px' }}>
            1. LeBlanc et al. PLOS ONE 2019;14(9):e0223116 &nbsp;·&nbsp; 2. Jiang et al. PLOS ONE 2019;14(10):e0223976
            &nbsp;·&nbsp; 3. Zotero Style Repository &nbsp;·&nbsp; 4. Clotworthy et al. BMC Medicine 2023;21:155
            &nbsp;·&nbsp; 5. aje.com/services/formatting
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="fmt-footer">
        <div className="wrap">
          <span>
            Journal Formatter — a free tool from the{' '}
            <a href="https://www.oscrsj.com">Orthopedic Surgery Case Reports &amp; Series Journal</a>
          </span>
          <span>
            <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/contact">Contact</a>
          </span>
        </div>
      </footer>
    </>
  )
}
