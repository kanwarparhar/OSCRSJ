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

export const metadata: Metadata = { title: 'Articles in Press — OSCRSJ' }

// Always fetch fresh on each request — In Press transitions are
// editor-driven and rare; cheap query so revalidation overhead is fine.
export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
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

  return (
    <div>
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
                desc: 'Reviewed by at least two orthopedic surgeons within 30 days.',
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
