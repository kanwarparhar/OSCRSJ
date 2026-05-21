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

// Always fetch fresh — published-state transitions are editor-driven
// and rare; cheap query so revalidation overhead is fine.
export const dynamic = 'force-dynamic'

// Soft 404 guard for /articles?topic=<slug> empty-filter views (per
// John's 2026-04-24 handoff `^handoff-soft-404-guard-articles-filter`).
// GSC flagged /topics/hand-wrist + /pediatric-orthopedics + /orthopedic-
// oncology as Soft 404 on 2026-04-23 because the post-redirect target
// rendered zero matching articles. Rather than per-page noindex on every
// possibly-empty filter URL, we count matches at request time and emit
// noindex only when the filter genuinely matches zero. Canonical always
// points at the bare /articles URL because filter variants are UX
// discovery aids, not canonical pages — that avoids a future duplicate-
// content signal across filter URLs once each topic fills with content.
export async function generateMetadata({
  searchParams,
}: {
  searchParams?: { topic?: string }
}): Promise<Metadata> {
  const topic = searchParams?.topic ?? ''
  const canonical = 'https://www.oscrsj.com/articles'

  // No filter set → always indexable. Skip the count query — homepage
  // and bare /articles share the same coverage.
  if (!topic) {
    return {
      title: 'Articles',
      description:
        'Browse peer-reviewed orthopedic case reports and case series published in OSCRSJ.',
      alternates: { canonical },
      openGraph: {
        title: 'Articles | OSCRSJ',
        description:
          'Browse peer-reviewed orthopedic case reports and case series published in OSCRSJ.',
        url: canonical,
        type: 'website',
      },
    }
  }

  // Topic filter present → count matches against the published set.
  // Map URL slug → internal SUBSPECIALTIES slug so the DB query can
  // match. Mirrors INTERNAL_TO_URL_SLUG below in the same file.
  const URL_TO_INTERNAL_SLUG: Record<string, string> = {
    trauma: 'trauma',
    'sports-medicine': 'sports',
    spine: 'spine',
    arthroplasty: 'arthroplasty',
    'pediatric-orthopedics': 'pediatrics',
    'hand-wrist': 'hand',
    'foot-ankle': 'foot-ankle',
    'orthopedic-oncology': 'tumor',
  }
  const internalSlug = URL_TO_INTERNAL_SLUG[topic] ?? topic

  const admin = createAdminClient()
  const { count } = await admin
    .from('manuscripts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('subspecialty', internalSlug)

  const matchCount = count ?? 0

  // Topic label for the title — fall back to the slug if it's not in
  // the canonical list (someone hand-typed an unknown ?topic= value).
  const topicLabels: Record<string, string> = {
    trauma: 'Trauma & Fractures',
    'sports-medicine': 'Sports Medicine',
    spine: 'Spine',
    arthroplasty: 'Arthroplasty',
    'pediatric-orthopedics': 'Pediatric Orthopedics',
    'hand-wrist': 'Hand & Wrist',
    'foot-ankle': 'Foot & Ankle',
    'orthopedic-oncology': 'Tumor & Oncology',
  }
  const topicLabel = topicLabels[topic] ?? topic

  // Empty filter → noindex,follow + canonical to bare /articles. This
  // pre-empts Google's Soft 404 detector AND consolidates link equity
  // back to the indexable parent page. follow:true keeps the topic
  // sidebar links crawlable for discovery.
  if (matchCount === 0) {
    return {
      title: `${topicLabel} — no articles yet`,
      description: `No articles published in ${topicLabel} yet. OSCRSJ is pre-launch — submit your case report or browse other subspecialties.`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    }
  }

  // Filter has matches → indexable, but canonical still points at bare
  // /articles so we don't fragment ranking signals across filter URLs.
  return {
    title: `${topicLabel} articles`,
    description: `Browse OSCRSJ peer-reviewed case reports and case series in ${topicLabel}.`,
    alternates: { canonical },
    openGraph: {
      title: `${topicLabel} articles | OSCRSJ`,
      description: `Browse OSCRSJ peer-reviewed case reports and case series in ${topicLabel}.`,
      url: canonical,
      type: 'website',
    },
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
      pdfStoragePath: m.published_pdf_storage_path ?? null,
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
