import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptType,
} from '@/lib/types/database'

// Current Issue = the current VOLUME under OSCRSJ's publishing model:
// continuous publication, one volume per calendar year, one issue per
// volume. Volume 1, Issue 1 IS all of 2026 and stays OPEN until
// 2026-12-31 — it grows as articles publish; there is no "issue
// release" and nothing is "compiled." See vault
// [[Publication Cadence & Issue Schedule]] (locked 2026-07-17).
//
// DB-driven on purpose: never hard-code the article list. The page
// pulls status='published' and shows the current volume's articles,
// so a new publication appears here automatically.
//
// Flipped to INDEXABLE 2026-07-17 — this page now carries a real
// multi-article issue listing (well past the §7.7.1 300-word
// threshold), and its FLIP TRIGGER ("when V1 I1 ships") is
// permanently satisfied. The article set IS the inaugural issue.

// Always fetch fresh — published-state transitions are editor-driven
// and rare. Mirrors the /articles page pattern.
export const dynamic = 'force-dynamic'

const CURRENT_VOLUME_YEAR = 2026
// Founding year → Volume 1. Volume = (publish year − 2025).
const CURRENT_VOLUME = CURRENT_VOLUME_YEAR - 2025

export const metadata: Metadata = {
  title: 'Current Issue — OSCRSJ',
  description:
    'Volume 1, Issue 1 (2026) of the Orthopedic Surgery Case Reports & Series Journal — peer-reviewed orthopedic case reports and series, published continuously and open access.',
  alternates: { canonical: 'https://www.oscrsj.com/articles/current-issue' },
  openGraph: {
    title: 'Current Issue | OSCRSJ',
    description:
      'Volume 1, Issue 1 (2026) — peer-reviewed orthopedic case reports and series, open access.',
    url: 'https://www.oscrsj.com/articles/current-issue',
    type: 'website',
  },
}

const TYPE_LABELS: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Systematic Review & Meta-Analysis',
  narrative_review: 'Narrative Review',
}

type IssueArticle = {
  id: string
  elocationId: string | null
  type: string
  title: string
  authors: string
  date: string
}

async function loadCurrentIssue(): Promise<IssueArticle[]> {
  const admin = createAdminClient()

  // TODO: filter by `volume` once the volume/issue migration lands —
  // correct through 2026-12-31 only (every published article is in
  // Volume 1 until Volume 2 opens 2027-01-01). See vault handoff
  // ^handoff-sushant-volume-issue-dehardcode-2026-07-17.
  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('status', 'published')
    .order('elocation_id', { ascending: true })

  const manuscripts = (mData as ManuscriptRow[] | null) || []
  if (manuscripts.length === 0) return []

  const manuscriptIds = manuscripts.map((m) => m.id)

  const { data: aData } = await admin
    .from('manuscript_authors')
    .select('*')
    .in('manuscript_id', manuscriptIds)
    .order('author_order', { ascending: true })

  const authorsById = new Map<string, ManuscriptAuthorRow[]>()
  for (const a of (aData as ManuscriptAuthorRow[] | null) || []) {
    const bucket = authorsById.get(a.manuscript_id) || []
    bucket.push(a)
    authorsById.set(a.manuscript_id, bucket)
  }

  return manuscripts.map((m) => {
    const authors = authorsById.get(m.id) || []
    return {
      id: m.id,
      elocationId: m.elocation_id ?? null,
      type: m.manuscript_type ? TYPE_LABELS[m.manuscript_type] : 'Case Report',
      title: m.title || '(untitled manuscript)',
      authors: authors.map((a) => a.full_name).join(', '),
      date: m.published_date
        ? new Date(m.published_date).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '',
    }
  })
}

export default async function CurrentIssuePage() {
  const articles = await loadCurrentIssue()

  return (
    <div>
      <PageHeader
        label="Current Issue"
        title={`Volume ${CURRENT_VOLUME}, Issue 1`}
        subtitle={`${CURRENT_VOLUME_YEAR} · Open access`}
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Model explainer — continuous publication, open volume. */}
        <section className="mb-10 bg-cream-alt border border-border rounded-2xl p-6">
          <p className="text-sm text-ink leading-relaxed">
            OSCRSJ publishes continuously: each peer-reviewed article goes
            online as soon as it is accepted and receives a unique article
            identifier (for example, <span className="font-medium">e0001</span>).
            Articles are collected into an annual volume. This is
            Volume&nbsp;{CURRENT_VOLUME}, Issue&nbsp;1, covering{' '}
            {CURRENT_VOLUME_YEAR}; it remains open through the end of the year
            and grows as new articles are published.
          </p>
        </section>

        {articles.length === 0 ? (
          <section className="mb-10 bg-white border border-border rounded-2xl p-8 text-center">
            <h2 className="section-heading mb-3">No Articles Yet</h2>
            <p className="text-ink leading-relaxed max-w-xl mx-auto">
              The first peer-reviewed articles of Volume {CURRENT_VOLUME} will
              appear here as they complete editorial review.
            </p>
          </section>
        ) : (
          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-5">
              <span className="section-label">Table of Contents</span>
              <span className="text-xs text-brown">
                {articles.length}{' '}
                {articles.length === 1 ? 'article' : 'articles'}
              </span>
            </div>

            <div className="space-y-3">
              {articles.map((a) => (
                <Link
                  key={a.id}
                  href={`/articles/${a.id}`}
                  className="card block hover:border-tan hover:shadow-sm transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-brown uppercase tracking-widest">
                      {a.type}
                    </span>
                    {a.elocationId && (
                      <span className="text-xs font-mono text-brown bg-cream-alt border border-border rounded px-2 py-0.5">
                        {a.elocationId}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-lg text-brown-dark leading-snug mb-1">
                    {a.title}
                  </h3>
                  {a.authors && (
                    <p className="text-sm text-ink mb-1">{a.authors}</p>
                  )}
                  {a.date && <p className="text-xs text-brown">{a.date}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/articles" className="btn-primary-light">
            Browse All Articles
          </Link>
          <Link href="/articles/in-press" className="btn-outline">
            Articles in Press
          </Link>
          <Link href="/submit" className="btn-outline">
            Submit a Manuscript
          </Link>
        </div>
      </div>
    </div>
  )
}
