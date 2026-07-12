import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { JOURNAL_SUMMARIES, ARTICLE_TYPE_LABELS } from '@/lib/formatting/journalList'
import FormatClient from './FormatClient'

export const metadata: Metadata = {
  title: 'Journal Formatter — by OSCRSJ | Free orthopedic manuscript formatting',
  description:
    'Upload your Word manuscript, pick an orthopedic journal, and get a submission-ready, journal-compliant .docx with verified references and a transparent compliance report — in minutes. Free during beta. OSCRSJ never rewrites your science.',
  alternates: { canonical: 'https://www.oscrsj.com/format' },
  openGraph: {
    title: 'Journal Formatter — by OSCRSJ | Free orthopedic manuscript formatting',
    description:
      'Format your orthopedic manuscript to a target journal in minutes — deterministic formatting, verified references, and a transparent compliance report. Free beta from OSCRSJ.',
    url: 'https://www.oscrsj.com/format',
    type: 'website',
  },
}

/* ------------------------------------------------------------------ */
/*  Server-rendered marketing copy (indexable)                         */
/* ------------------------------------------------------------------ */

const intro: string[] = [
  'The Journal Formatter takes a finished orthopedic manuscript in Microsoft Word and returns a version that already follows your target journal’s house style. Upload your .docx, choose one of the supported orthopedic journals and your article type, and in a few minutes you get back a clean, journal-compliant Word file, a reference list that has been checked against Crossref and PubMed, and a plain-language compliance report that tells you exactly what changed and what still needs your attention before you submit.',
  'It exists because formatting is the tedious, error-prone part of getting published — margins, fonts, line spacing, heading case, title-page order, blinding, Vancouver reference style, DOIs, figure callouts. Every journal wants something slightly different, and getting it wrong triggers a desk rejection or a frustrating round of technical revisions. This tool applies each journal’s rules deterministically, from a validated rule set encoded directly from that journal’s published Guide for Authors, so you can spend your time on the science instead of the style sheet.',
]

const howItWorks: { step: string; title: string; body: string }[] = [
  {
    step: '1',
    title: 'Upload your manuscript',
    body: 'Drop in your blinded manuscript as a Word .docx (up to 15 MB). Optionally attach your figures as separate high-resolution image files. Nothing is published — your files are used only to produce your formatted output.',
  },
  {
    step: '2',
    title: 'Pick a journal and article type',
    body: 'Choose your target orthopedic journal and the article type you are submitting — case report, case series, original research, review, technical note, and more. The formatter loads that journal’s exact requirements.',
  },
  {
    step: '3',
    title: 'Download and review',
    body: 'Download your journal-formatted manuscript and compliance report directly on the page, with your reference list verified and renumbered. Read the report, apply anything flagged for your attention, and submit with confidence.',
  },
]

const neverDoes: { title: string; body: string }[] = [
  {
    title: 'It never rewrites your science',
    body: 'Content immutability is guaranteed. The engine only restyles, reorders sections, and renumbers citations — every word of your body text stays byte-for-byte identical. A built-in immutability gate compares the text before and after and refuses to ship if anything other than a citation marker moved.',
  },
  {
    title: 'The AI is used for understanding only',
    body: 'A language model is used to read structure — to recognize which lines are the title, the authors, the affiliations, and the reference strings. It never writes, paraphrases, or "improves" your prose. All formatting is applied by deterministic code from the journal’s rules.',
  },
  {
    title: 'It never upscales your figures',
    body: 'Figures are checked against the journal’s accepted formats and minimum resolution and are flagged in your report if they fall short. They are never re-rendered, upsampled, or artificially sharpened — a low-resolution image is reported honestly, not disguised.',
  },
  {
    title: 'It never invents a requirement',
    body: 'Where a journal’s guide is silent on a setting, the formatter preserves your original choice rather than imposing a guess. Fields the journal does not specify are left as you wrote them and noted in the report.',
  },
]

const disclaimer =
  'This tool applies formatting rules encoded from each journal’s published Guide for Authors, verified as of the date shown on every journal card below. Journal requirements change without notice. Always confirm your manuscript against the journal’s current Guide for Authors before you submit. The Journal Formatter is a free beta provided by OSCRSJ on an as-is basis; it does not guarantee acceptance and is not affiliated with, sponsored by, or endorsed by any of the journals listed.'

function friendlyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FormatPage() {
  return (
    <div>
      <PageHeader
        label="Free Tool · Beta"
        title="Journal Formatter"
        subtitle="Format an orthopedic manuscript to a target journal in minutes — deterministic formatting, verified references, and a transparent compliance report. Built by OSCRSJ."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        {/* ---- What it does ---- */}
        <section className="mb-16">
          <span className="section-label">What It Does</span>
          <h2 className="section-heading mb-5">Journal-compliant formatting, without touching your words</h2>
          <div className="space-y-4 max-w-3xl">
            {intro.map((p, i) => (
              <p key={i} className="text-ink leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </section>

        {/* ---- How it works ---- */}
        <section className="mb-16">
          <span className="section-label">How It Works</span>
          <h2 className="section-heading mb-6">Three steps, a few minutes</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {howItWorks.map((s) => (
              <div key={s.step} className="card">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-cream-alt font-serif text-lg text-brown-dark">
                  {s.step}
                </div>
                <h3 className="mb-2 font-serif text-lg text-brown-dark">{s.title}</h3>
                <p className="text-sm leading-relaxed text-ink">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- What it never does ---- */}
        <section className="mb-16">
          <span className="section-label">Trust &amp; Safety</span>
          <h2 className="section-heading mb-6">What it never does</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {neverDoes.map((n) => (
              <div key={n.title} className="rounded-xl border border-border bg-cream-alt/50 p-6">
                <h3 className="mb-2 font-serif text-lg text-brown-dark">{n.title}</h3>
                <p className="text-sm leading-relaxed text-ink">{n.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Supported journals ---- */}
        <section className="mb-16">
          <span className="section-label">Coverage</span>
          <h2 className="section-heading mb-2">Supported journals</h2>
          <p className="mb-6 max-w-3xl text-sm leading-relaxed text-ink">
            {JOURNAL_SUMMARIES.length} orthopedic journals are supported today, each encoded from its live Guide for
            Authors. The date on every card is when those rules were last verified against the journal&apos;s published
            guidelines.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {JOURNAL_SUMMARIES.map((j) => (
              <div key={j.slug} className="card flex flex-col">
                <h3 className="font-serif text-lg leading-snug text-brown-dark">{j.name}</h3>
                <p className="mt-1 text-xs text-brown">{j.publisher ?? 'Independent'}</p>
                <p className="mt-3 text-xs leading-relaxed text-ink">
                  <span className="font-semibold text-brown">Article types: </span>
                  {j.articleTypes.map((t) => ARTICLE_TYPE_LABELS[t]).join(', ')}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[11px] text-brown">Verified {friendlyDate(j.verifiedDate)}</span>
                  <a
                    href={j.guidelinesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-brown-dark underline hover:text-brown"
                  >
                    Guide for Authors
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Disclaimer ---- */}
        <section className="mb-16">
          <div className="rounded-xl border border-peach/40 bg-tan/10 p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brown">Before you submit</p>
            <p className="max-w-3xl text-sm leading-relaxed text-ink">{disclaimer}</p>
            <p className="mt-3 text-sm text-brown">
              New to OSCRSJ formatting conventions? See the{' '}
              <Link href="/guide-for-authors" className="font-medium text-brown-dark underline hover:text-brown">
                Guide for Authors
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ---- Interactive tool ---- */}
        <section id="tool" className="scroll-mt-24">
          <span className="section-label">Start Now</span>
          <h2 className="section-heading mb-6">Format your manuscript</h2>
          <FormatClient journals={JOURNAL_SUMMARIES} />
        </section>
      </div>
    </div>
  )
}
