// Individual article detail page — /articles/[id] (Session 67, 2026-05-21)
//
// Fetches manuscript by UUID, renders the public-facing article landing page.
// Only published manuscripts are accessible; non-published or missing IDs get
// a 404. Data sourced from manuscripts + manuscript_authors +
// manuscript_affiliations + manuscript_metadata tables.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { SUBSPECIALTIES } from '@/lib/constants'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptAffiliationRow,
  ManuscriptMetadataRow,
  ManuscriptType,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

// ─── Label maps ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Systematic Review & Meta-Analysis',
  narrative_review: 'Narrative Review',
}

const SUBSPECIALTY_LABELS: Record<string, string> = Object.fromEntries(
  SUBSPECIALTIES.map((s) => [s.slug, s.name])
)

// ─── Data fetching ───────────────────────────────────────────────────────────

interface ArticleData {
  manuscript: ManuscriptRow
  authors: ManuscriptAuthorRow[]
  affiliations: ManuscriptAffiliationRow[]
  metadata: ManuscriptMetadataRow | null
}

async function loadArticle(id: string): Promise<ArticleData | null> {
  const admin = createAdminClient()

  const { data: m } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (!m) return null
  const manuscript = m as ManuscriptRow

  const [{ data: aData }, { data: affData }, { data: metaData }] =
    await Promise.all([
      admin
        .from('manuscript_authors')
        .select('*')
        .eq('manuscript_id', id)
        .order('author_order', { ascending: true }),
      admin
        .from('manuscript_affiliations')
        .select('*')
        .eq('manuscript_id', id)
        .order('affiliation_order', { ascending: true }),
      admin
        .from('manuscript_metadata')
        .select('*')
        .eq('manuscript_id', id)
        .single(),
    ])

  return {
    manuscript,
    authors: (aData as ManuscriptAuthorRow[] | null) || [],
    affiliations: (affData as ManuscriptAffiliationRow[] | null) || [],
    metadata: (metaData as ManuscriptMetadataRow | null) || null,
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const data = await loadArticle(params.id)
  if (!data) return { title: 'Article Not Found' }

  const { manuscript, authors } = data
  const description = manuscript.abstract
    ? manuscript.abstract.slice(0, 200) + '…'
    : 'Published in OSCRSJ — Orthopedic Surgery Case Reports & Series Journal.'

  const articleKeywords =
    manuscript.keywords && manuscript.keywords.length > 0
      ? manuscript.keywords
      : undefined

  // Highwire Press citation_* meta tags — required for Google Scholar indexing.
  // Google Scholar reads ONLY these tags; it ignores JSON-LD and OG for indexing.
  const citationDate = manuscript.published_date
    ? new Date(manuscript.published_date)
        .toLocaleDateString('en-CA') // YYYY-MM-DD
        .replace(/-/g, '/')           // YYYY/MM/DD (Scholar format)
    : undefined

  const citationMeta: Record<string, string | string[]> = {
    citation_title: manuscript.title || '',
    citation_author: authors.map((a) => a.full_name), // one <meta> per author
    citation_journal_title:
      'Orthopedic Surgery Case Reports and Series Journal',
    citation_publisher: 'OSCRSJ',
    citation_volume: '1',
    citation_issue: '1',
    citation_pdf_url: `https://www.oscrsj.com/api/articles/${params.id}/pdf`,
    citation_fulltext_html_url: `https://www.oscrsj.com/articles/${params.id}`,
  }
  if (citationDate) citationMeta.citation_publication_date = citationDate
  if (manuscript.elocation_id)
    citationMeta.citation_firstpage = manuscript.elocation_id
  if (manuscript.abstract)
    citationMeta.citation_abstract = manuscript.abstract
  if (articleKeywords)
    citationMeta.citation_keyword = articleKeywords // one <meta> per keyword

  return {
    title: manuscript.title || 'Article',
    description,
    keywords: articleKeywords,
    alternates: {
      canonical: `https://www.oscrsj.com/articles/${params.id}`,
    },
    openGraph: {
      title: manuscript.title || 'Article',
      description,
      url: `https://www.oscrsj.com/articles/${params.id}`,
      type: 'article',
      authors: authors.map((a) => a.full_name),
    },
    twitter: {
      card: 'summary_large_image',
      title: manuscript.title || 'Article',
      description,
    },
    other: citationMeta,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArticlePage({
  params,
}: {
  params: { id: string }
}) {
  const data = await loadArticle(params.id)
  if (!data) notFound()

  const { manuscript, authors, affiliations, metadata } = data

  const typeLabel = manuscript.manuscript_type
    ? TYPE_LABELS[manuscript.manuscript_type]
    : 'Article'
  const subspecialtyLabel = manuscript.subspecialty
    ? SUBSPECIALTY_LABELS[manuscript.subspecialty] || manuscript.subspecialty
    : null

  const publishedDate = manuscript.published_date
    ? new Date(manuscript.published_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const hasPdf = Boolean(manuscript.published_pdf_storage_path)

  // Build citation string: Authors. Title. OSCRSJ. Year;Vol(Issue):eLocation.
  const citationAuthors = authors
    .map((a) => {
      const parts = a.full_name.trim().split(' ')
      const last = parts[parts.length - 1]
      const initials = parts
        .slice(0, -1)
        .map((p) => p[0])
        .join('')
      return `${last} ${initials}`
    })
    .join(', ')
  const citationYear = manuscript.published_date
    ? new Date(manuscript.published_date).getFullYear()
    : ''
  const elocId = manuscript.elocation_id || manuscript.id.slice(0, 8)
  const citation = `${citationAuthors}. ${manuscript.title || ''}. OSCRSJ. ${citationYear};1(1):${elocId}.`

  // Build corresponding author info
  const corresponding = authors.find((a) => a.is_corresponding)

  // Build MedicalScholarlyArticle JSON-LD for AI tools and rich results.
  // Google Scholar uses citation_* meta tags (above); this targets AI chat
  // tools (Perplexity, ChatGPT, Gemini) and Google's rich-result system.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalScholarlyArticle',
    '@id': `https://www.oscrsj.com/articles/${manuscript.id}`,
    headline: manuscript.title || undefined,
    url: `https://www.oscrsj.com/articles/${manuscript.id}`,
    datePublished: manuscript.published_date ?? undefined,
    description: manuscript.abstract
      ? manuscript.abstract.slice(0, 300)
      : undefined,
    author: authors.map((a) => ({
      '@type': 'Person',
      name: a.full_name,
      ...(a.affiliation
        ? { affiliation: { '@type': 'Organization', name: a.affiliation } }
        : {}),
      ...(a.orcid_id
        ? { sameAs: `https://orcid.org/${a.orcid_id}` }
        : {}),
    })),
    publisher: { '@id': 'https://www.oscrsj.com/#organization' },
    isPartOf: { '@id': 'https://www.oscrsj.com/#periodical' },
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    ...(manuscript.subspecialty
      ? {
          about: {
            '@type': 'MedicalCondition',
            name: subspecialtyLabel || manuscript.subspecialty,
          },
        }
      : {}),
    ...(manuscript.elocation_id
      ? { pagination: manuscript.elocation_id }
      : {}),
    ...(manuscript.keywords && manuscript.keywords.length > 0
      ? { keywords: manuscript.keywords.join(', ') }
      : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    <div className="bg-cream min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-dark border-b border-white/10">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 text-xs text-taupe">
          <Link href="/articles" className="hover:text-peach transition-colors">
            Articles
          </Link>
          <span>/</span>
          <span className="text-white/60 truncate max-w-xs">{typeLabel}</span>
        </div>
      </div>

      {/* Hero header */}
      <div className="bg-dark pb-10 pt-8">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
          {/* Chips */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="text-xs font-semibold text-peach bg-peach/10 border border-peach/20 px-2.5 py-1 rounded-full">
              {typeLabel}
            </span>
            {subspecialtyLabel && (
              <span className="text-xs text-taupe bg-white/10 px-2.5 py-1 rounded-full">
                {subspecialtyLabel}
              </span>
            )}
            {publishedDate && (
              <span className="text-xs text-taupe ml-auto">{publishedDate}</span>
            )}
          </div>

          {/* Title */}
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-normal text-white leading-tight mb-5 max-w-4xl">
            {manuscript.title || '(untitled)'}
          </h1>

          {/* Authors */}
          {authors.length > 0 && (
            <p className="text-sm text-taupe mb-4">
              {authors.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && <span className="mx-1 text-white/20">,</span>}
                  <span className={a.is_corresponding ? 'text-peach' : ''}>
                    {a.full_name}
                    {a.degrees ? `, ${a.degrees}` : ''}
                    {a.is_corresponding ? '*' : ''}
                  </span>
                </span>
              ))}
            </p>
          )}

          {/* Affiliations */}
          {affiliations.length > 0 && (
            <div className="text-xs text-white/50 space-y-0.5 mb-5">
              {affiliations.map((aff, i) => (
                <p key={aff.id}>
                  <span className="text-white/30 mr-1">{i + 1}.</span>
                  {[aff.department, aff.affiliation_name, aff.city, aff.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              ))}
            </div>
          )}

          {/* Publication identifiers */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/50 mb-6 border-t border-white/10 pt-4">
            <span>
              <span className="text-white/30 uppercase tracking-widest mr-1">Journal</span>
              OSCRSJ Vol. 1, No. 1
            </span>
            {manuscript.elocation_id && (
              <span>
                <span className="text-white/30 uppercase tracking-widest mr-1">Article</span>
                {manuscript.elocation_id}
              </span>
            )}
            {manuscript.doi ? (
              <a
                href={`https://doi.org/${manuscript.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-peach transition-colors"
              >
                DOI: {manuscript.doi}
              </a>
            ) : (
              <span className="italic">DOI assignment pending</span>
            )}
          </div>

          {/* PDF download button */}
          {hasPdf ? (
            <a
              href={`/api/articles/${manuscript.id}/pdf?v=${manuscript.updated_at ? new Date(manuscript.updated_at).getTime() : '1'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-peach text-brown-dark font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-peach-dark transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v2.546l.943-1.048a.75.75 0 1 1 1.114 1.004l-2.25 2.5a.75.75 0 0 1-1.114 0l-2.25-2.5a.75.75 0 1 1 1.114-1.004l.943 1.048V8.75Z" clipRule="evenodd" />
              </svg>
              Download Full Text (PDF/A)
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-white/40 italic">
              Full text coming soon
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">

            {/* Abstract */}
            {manuscript.abstract && (
              <section className="bg-white border border-border rounded-xl p-6 sm:p-8">
                <h2 className="font-serif text-xl text-brown-dark mb-4">Abstract</h2>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                  {manuscript.abstract}
                </p>
                {manuscript.keywords && manuscript.keywords.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <span className="text-xs uppercase tracking-widest text-brown mr-2">Keywords:</span>
                    <span className="text-sm text-ink">
                      {manuscript.keywords.join(', ')}
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* Declarations */}
            {metadata && (
              <section className="bg-white border border-border rounded-xl p-6 sm:p-8 space-y-4">
                <h2 className="font-serif text-xl text-brown-dark mb-4">Declarations</h2>

                {metadata.conflict_of_interest && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-brown mb-1">Conflict of Interest</h3>
                    <p className="text-sm text-ink leading-relaxed">{metadata.conflict_of_interest}</p>
                  </div>
                )}

                {metadata.funding_sources && metadata.funding_sources.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-brown mb-1">Funding</h3>
                    <p className="text-sm text-ink leading-relaxed">{metadata.funding_sources.join('; ')}</p>
                  </div>
                )}

                {metadata.data_availability_statement && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-brown mb-1">Data Availability</h3>
                    <p className="text-sm text-ink leading-relaxed">{metadata.data_availability_statement}</p>
                  </div>
                )}

                {metadata.ai_tools_used && metadata.ai_tools_details && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-brown mb-1">AI Tools</h3>
                    <p className="text-sm text-ink leading-relaxed">{metadata.ai_tools_details}</p>
                  </div>
                )}

                {!metadata.ai_tools_used && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-brown mb-1">AI Tools</h3>
                    <p className="text-sm text-ink leading-relaxed">No AI tools were used in the preparation of this manuscript.</p>
                  </div>
                )}
              </section>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-5">

            {/* Citation */}
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="text-xs uppercase tracking-widest text-brown mb-3">Cite This Article</h3>
              <p className="text-xs text-ink leading-relaxed font-mono bg-cream-alt rounded-lg p-3 select-all">
                {citation}
              </p>
            </div>

            {/* License */}
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="text-xs uppercase tracking-widest text-brown mb-3">License</h3>
              <p className="text-xs text-ink leading-relaxed mb-2">
                This article is published open access under a{' '}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brown-dark underline hover:text-ink"
                >
                  Creative Commons Attribution 4.0 International (CC BY 4.0)
                </a>{' '}
                license. You are free to share and adapt with appropriate credit.
              </p>
              <p className="text-xs text-brown">© {citationYear} The Authors</p>
            </div>

            {/* Corresponding author */}
            {corresponding && (
              <div className="bg-white border border-border rounded-xl p-5">
                <h3 className="text-xs uppercase tracking-widest text-brown mb-3">Corresponding Author</h3>
                <p className="text-sm text-brown-dark font-medium">
                  {corresponding.full_name}
                  {corresponding.degrees ? `, ${corresponding.degrees}` : ''}
                </p>
                {corresponding.affiliation && (
                  <p className="text-xs text-ink mt-1">{corresponding.affiliation}</p>
                )}
                {corresponding.orcid_id && (
                  <a
                    href={`https://orcid.org/${corresponding.orcid_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brown-dark hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    ORCID: {corresponding.orcid_id}
                  </a>
                )}
              </div>
            )}

            {/* PDF download (sidebar repeat) */}
            {hasPdf && (
              <a
                href={`/api/articles/${manuscript.id}/pdf?v=${manuscript.updated_at ? new Date(manuscript.updated_at).getTime() : '1'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-brown-dark text-peach font-semibold text-sm px-4 py-3 rounded-xl hover:bg-ink transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v2.546l.943-1.048a.75.75 0 1 1 1.114 1.004l-2.25 2.5a.75.75 0 0 1-1.114 0l-2.25-2.5a.75.75 0 1 1 1.114-1.004l.943 1.048V8.75Z" clipRule="evenodd" />
                </svg>
                Download Full Text (PDF/A)
              </a>
            )}

            {/* Back link */}
            <Link
              href="/articles"
              className="flex items-center gap-1 text-sm text-brown hover:text-brown-dark transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              All Articles
            </Link>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
