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
import ArticlesBrowser, { type BrowserArticle } from './ArticlesBrowser'

// Public page — peer-reviewed articles published in OSCRSJ.
// Pulls directly from `manuscripts` filtered to status='published',
// matching the Phase 4 publishing-pipeline pattern shipped at
// /articles/in-press in Session 16. Admin client (service-role) on
// the server side because RLS would otherwise block an anonymous
// read; the narrow status='published' filter is the safety fence.
//
// Pre-launch state (no published articles yet) renders an EmptyState
// matching the in-press shape — no fake-DOI samples, no E-E-A-T risk
// from broken doi.org redirects. Per [[2026-04-30 John — Thin-Content
// Sweep]] D1 (Option B locked by Manvir 2026-04-30).

export const metadata: Metadata = { title: 'Articles — OSCRSJ' }

// Always fetch fresh — published-state transitions are editor-driven
// and rare; cheap query so revalidation overhead is fine.
export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

// Internal SUBSPECIALTIES slugs (DB-persisted) → descriptive URL
// slugs used in /articles?topic=... So old /topics/<slug> 301s land
// on a pre-filtered view and the in-page topic filter buttons match.
const INTERNAL_TO_URL_SLUG: Record<string, string> = {
  trauma: 'trauma',
  sports: 'sports-medicine',
  spine: 'spine',
  arthroplasty: 'arthroplasty',
  pediatrics: 'pediatric-orthopedics',
  hand: 'hand-wrist',
  'foot-ankle': 'foot-ankle',
  tumor: 'orthopedic-oncology',
}

// Derive subspecialty labels from canonical SUBSPECIALTIES list so
// slug→label changes propagate to one place.
const SUBSPECIALTY_LABELS: Record<string, string> = Object.fromEntries(
  SUBSPECIALTIES.map((s) => [s.slug, s.name])
)

const tabs = [
  { label: 'All Articles', href: '/articles' },
  { label: 'Current Issue', href: '/articles/current-issue' },
  { label: 'Articles in Press', href: '/articles/in-press' },
  { label: 'Most Read', href: '/articles/most-read' },
  { label: 'Most Cited', href: '/articles/most-cited' },
]

async function loadPublishedArticles(): Promise<BrowserArticle[]> {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('status', 'published')
    .order('published_date', { ascending: false })

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
    const authorsLine = authors.map((a) => a.full_name).join(', ')
    const internalSlug = m.subspecialty || ''
    const urlSlug = INTERNAL_TO_URL_SLUG[internalSlug] || internalSlug
    const subspecialtyLabel =
      SUBSPECIALTY_LABELS[internalSlug] || internalSlug
    const typeLabel = m.manuscript_type
      ? TYPE_LABELS[m.manuscript_type]
      : 'Case Report'
    const date = m.published_date
      ? new Date(m.published_date).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
        })
      : ''
    return {
      id: m.id,
      type: typeLabel,
      title: m.title || '(untitled manuscript)',
      authors: authorsLine,
      doi: m.doi,
      topic: subspecialtyLabel,
      topicSlug: urlSlug,
      date,
      abstract: m.abstract || '',
      publishedDate: m.published_date,
    }
  })
}

export default async function ArticlesPage() {
  const articles = await loadPublishedArticles()

  if (articles.length === 0) {
    return (
      <div>
        <PageHeader
          label="Research"
          title="Articles"
          subtitle="Browse peer-reviewed case reports and case series in orthopedic surgery."
        />
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-14">
          {/* Tabs preserved so visitors can still navigate to In Press
              etc. while no articles are published yet */}
          <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab.href === '/articles'
                    ? 'border-peach text-brown'
                    : 'border-transparent text-brown hover:text-ink'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <section className="mb-10 bg-cream-alt border border-border rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="section-heading mb-3">No Published Articles Yet</h2>
            <p className="text-ink leading-relaxed max-w-xl mx-auto">
              OSCRSJ is in pre-launch. Our first peer-reviewed case reports
              and series will appear here as they complete editorial
              review. In the meantime, you can submit a manuscript, see
              what is currently in press, or learn how our peer review
              process works.
            </p>
          </section>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/submit" className="btn-primary-light">
              Submit a Manuscript
            </Link>
            <Link href="/articles/in-press" className="btn-outline">
              See Articles in Press
            </Link>
            <Link href="/peer-review" className="btn-outline">
              How Peer Review Works
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <ArticlesBrowser articles={articles} />
}
