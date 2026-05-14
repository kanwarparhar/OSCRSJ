import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { createAdminClient } from '@/lib/supabase/server'
import { SUBSPECIALTIES } from '@/lib/constants'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptType,
} from '@/lib/types/database'

// Public page — accepted articles awaiting final issue assignment.
// As of Phase 4 (migration 013), this listing pulls directly from
// `manuscripts` filtered to status = 'in_production'. We use the
// admin client (service-role) on the server so RLS doesn't block an
// anonymous visitor; the narrow status filter is the safety fence.
// Drafts, under-review manuscripts, and desk-rejected/withdrawn
// work cannot land on this page because the query only accepts
// `in_production`.

// Always fetch fresh on each request — In Press transitions are
// editor-driven and rare; cheap query so revalidation overhead is fine.
export const dynamic = 'force-dynamic'

// Soft 404 guard + canonical/OG/JSON-LD per John's 2026-04-25 audit
// (`^handoff-soft-404-guard-in-press`). The empty-state version of this
// page is exactly what Google's Soft 404 detector treats as 404-equivalent
// (workflow explainer + CTAs but no actual articles), same shape that hit
// /articles?topic=hand-wrist on 2026-04-23. Solution: count manuscripts
// at request time and emit noindex only while the count is zero. Flips
// to indexable automatically as soon as the first manuscript reaches
// status='in_production'. Title drops the ` — OSCRSJ` suffix because the
// root layout's `%s | OSCRSJ` template adds ` | OSCRSJ` (otherwise the
// rendered title doubles).
export async function generateMetadata(): Promise<Metadata> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('manuscripts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'in_production')

  const isEmpty = !count || count === 0

  return {
    title: 'In Press — Forthcoming Orthopedic Case Reports',
    description:
      'Articles accepted for publication in OSCRSJ — peer-reviewed case reports and case series awaiting copyediting and final issue assignment, with author bylines and Crossref DOIs.',
    alternates: {
      canonical: 'https://www.oscrsj.com/articles/in-press',
    },
    openGraph: {
      title: 'In Press — Forthcoming Orthopedic Case Reports | OSCRSJ',
      description:
        'Accepted orthopedic case reports and case series awaiting final issue assignment in OSCRSJ.',
      url: 'https://www.oscrsj.com/articles/in-press',
      type: 'website',
    },
    robots: isEmpty
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

const TYPE_LABELS: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Systematic Review & Meta-Analysis',
}

// Derive subspecialty labels from the canonical SUBSPECIALTIES list
// in lib/constants.ts so slug changes in one place propagate.
const SUBSPECIALTY_LABELS: Record<string, string> = Object.fromEntries(
  SUBSPECIALTIES.map((s) => [s.slug, s.name])
)

interface InPressArticle {
  manuscript: ManuscriptRow
  authors: ManuscriptAuthorRow[]
}

async function loadInPressArticles(): Promise<InPressArticle[]> {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('status', 'in_production')
    .order('accepted_date', { ascending: false })

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

  return manuscripts.map((m) => ({
    manuscript: m,
    authors: authorsById.get(m.id) || [],
  }))
}

export default async function InPressPage() {
  const articles = await loadInPressArticles()

  // BreadcrumbList JSON-LD always; ItemList of ScholarlyArticle nodes
  // only when articles.length > 0 (Google warns on empty ItemList).
  // ScholarlyArticle nodes carry the per-manuscript signals indexing-
  // body crawlers care about: headline, author[] with optional ORCID
  // sameAs, identifier (DOI URL when present), dateAccepted, and a
  // back-reference to the journal Periodical declared in app/layout.tsx.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.oscrsj.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Articles',
        item: 'https://www.oscrsj.com/articles',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'In Press',
        item: 'https://www.oscrsj.com/articles/in-press',
      },
    ],
  }

  const itemListJsonLd =
    articles.length === 0
      ? null
      : {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'OSCRSJ Articles in Press',
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          numberOfItems: articles.length,
          itemListElement: articles.map(({ manuscript, authors }, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'ScholarlyArticle',
              headline: manuscript.title || '(untitled manuscript)',
              ...(manuscript.doi && {
                identifier: `https://doi.org/${manuscript.doi}`,
              }),
              ...(manuscript.accepted_date && {
                dateAccepted: manuscript.accepted_date,
              }),
              author: authors.map((a) => ({
                '@type': 'Person',
                name: a.full_name,
                ...(a.orcid_id && {
                  sameAs: `https://orcid.org/${a.orcid_id}`,
                }),
              })),
              isPartOf: { '@id': 'https://www.oscrsj.com/#periodical' },
            },
          })),
        }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <PageHeader
        label="In Press"
        title="Articles in Press"
        subtitle="Accepted articles awaiting final issue assignment"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {articles.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="mb-12">
            <span className="section-label">Forthcoming</span>
            <h2 className="section-heading mb-5">
              {articles.length}{' '}
              {articles.length === 1 ? 'article' : 'articles'} in press
            </h2>
            <ul className="space-y-4">
              {articles.map(({ manuscript, authors }) => (
                <ArticleCard
                  key={manuscript.id}
                  manuscript={manuscript}
                  authors={authors}
                />
              ))}
            </ul>
          </section>
        )}

        <section className="mb-12">
          <span className="section-label">Workflow</span>
          <h2 className="section-heading mb-5">From Submission to Publication</h2>
          <div className="space-y-3">
            {[
              {
                title: 'Submission Received',
                desc: 'Manuscript enters our editorial workflow.',
              },
              {
                title: 'Double-Blind Peer Review',
                desc: 'Initial editorial response within 10 days of submission; reviewed by at least two orthopedic surgeons over the following 14–21 days.',
              },
              {
                title: 'Acceptance & DOI Assignment',
                desc: 'Accepted articles receive a Crossref DOI and appear here.',
              },
              {
                title: 'Issue Publication',
                desc: 'Article moves to the current issue and is permanently archived.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="flex gap-4 bg-white border border-border rounded-xl p-6"
              >
                <span className="w-8 h-8 rounded-full bg-cream-alt flex items-center justify-center text-sm font-bold text-brown flex-shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-ink text-sm">{item.title}</p>
                  <p className="text-sm text-ink mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/submit" className="btn-primary-light">
            Submit a Manuscript
          </Link>
          <Link href="/articles/current-issue" className="btn-outline">
            Current Issue
          </Link>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <section className="mb-12 bg-cream-alt border border-border rounded-2xl p-8 text-center">
      <div className="text-4xl mb-4">📄</div>
      <h2 className="section-heading mb-3">No Articles in Press Yet</h2>
      <p className="text-ink leading-relaxed max-w-lg mx-auto">
        As we build our initial submission pipeline, accepted articles will
        appear here before they are assigned to an issue. Check back soon, or
        submit your own manuscript to be among the first.
      </p>
    </section>
  )
}

function ArticleCard({
  manuscript,
  authors,
}: {
  manuscript: ManuscriptRow
  authors: ManuscriptAuthorRow[]
}) {
  const typeLabel = manuscript.manuscript_type
    ? TYPE_LABELS[manuscript.manuscript_type]
    : null
  const subspecialtyLabel = manuscript.subspecialty
    ? SUBSPECIALTY_LABELS[manuscript.subspecialty] || manuscript.subspecialty
    : null

  return (
    <li className="bg-white border border-border rounded-xl p-6 hover:border-tan transition-colors">
      <div className="flex items-start flex-wrap gap-2 mb-3">
        {typeLabel && (
          <span className="text-[11px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border border-border bg-cream-alt text-brown">
            {typeLabel}
          </span>
        )}
        {subspecialtyLabel && (
          <span className="text-[11px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-border text-brown">
            {subspecialtyLabel}
          </span>
        )}
        <span className="text-[11px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 ml-auto">
          In Production
        </span>
      </div>

      <h3 className="font-serif text-xl text-brown-dark leading-snug mb-2">
        {manuscript.title || '(untitled manuscript)'}
      </h3>

      {authors.length > 0 && (
        <p className="text-sm text-ink mb-3">
          {authors.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              {a.orcid_id ? (
                <a
                  href={`https://orcid.org/${a.orcid_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline underline-offset-2"
                  title={`ORCID ${a.orcid_id}`}
                >
                  {a.full_name}
                </a>
              ) : (
                a.full_name
              )}
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-brown">
        {manuscript.accepted_date && (
          <span>
            Accepted{' '}
            {new Date(manuscript.accepted_date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
        {manuscript.doi && (
          <span>
            DOI{' '}
            <a
              href={`https://doi.org/${manuscript.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline underline-offset-2"
            >
              {manuscript.doi}
            </a>
          </span>
        )}
        <span className="italic">Full text available soon</span>
      </div>
    </li>
  )
}
