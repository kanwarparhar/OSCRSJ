import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AI_ORTHO_BRIEFS,
  getBrief,
  getCategory,
  type AiOrthoCategorySlug,
} from '@/lib/ai-ortho/data'
import { buildNewsArticleSchema } from '@/lib/schema/newsArticle'
import { buildBreadcrumbSchema } from '@/lib/schema/breadcrumb'

interface PageProps {
  params: { slug: string; brief: string }
}

export function generateStaticParams() {
  return AI_ORTHO_BRIEFS.map((b) => ({ slug: b.category, brief: b.slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const cat = getCategory(params.slug)
  if (!cat) return { title: 'AI in Orthopedics' }
  const brief = getBrief(params.slug as AiOrthoCategorySlug, params.brief)
  if (!brief) return { title: `${cat.label} | AI in Orthopedics` }
  return {
    title: brief.headline,
    description: brief.summary,
    alternates: {
      canonical: `https://www.oscrsj.com/news/ai-in-orthopedics/${cat.slug}/${brief.slug}`,
    },
    openGraph: {
      title: brief.headline,
      description: brief.summary,
      type: 'article',
      publishedTime: brief.publishedAt,
      url: `https://www.oscrsj.com/news/ai-in-orthopedics/${cat.slug}/${brief.slug}`,
    },
  }
}

export default function BriefPage({ params }: PageProps) {
  const cat = getCategory(params.slug)
  if (!cat) notFound()

  const brief = getBrief(params.slug as AiOrthoCategorySlug, params.brief)
  if (!brief) notFound()

  const briefUrl = `https://www.oscrsj.com/news/ai-in-orthopedics/${cat.slug}/${brief.slug}`
  const doiUrl = brief.source.doi ? `https://doi.org/${brief.source.doi}` : brief.source.url

  const jsonLd = buildNewsArticleSchema({
    headline: brief.headline,
    datePublished: brief.publishedAt,
    summary: brief.summary,
    url: briefUrl,
    originalPaperTitle: brief.source.paperTitle,
    originalPaperJournal: brief.source.journal,
    originalPaperDate: brief.source.paperPublishedAt,
    originalPaperAuthors: brief.source.authors,
    doi: brief.source.doi,
    sourceUrl: brief.source.url,
  })

  const breadcrumbLd = buildBreadcrumbSchema([
    { name: 'News', url: 'https://www.oscrsj.com/news' },
    { name: 'AI in Orthopedics', url: 'https://www.oscrsj.com/news/ai-in-orthopedics' },
    { name: cat.short, url: `https://www.oscrsj.com/news/ai-in-orthopedics/${cat.slug}` },
    { name: brief.headline, url: briefUrl },
  ])

  return (
    <div>
      {/* JSON-LD — rendered in SSR HTML by being inside a Server Component's JSX */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Breadcrumb */}
        <nav className="text-xs text-brown mb-6">
          <Link href="/news" className="hover:text-ink transition-colors">
            News
          </Link>
          <span className="mx-2">/</span>
          <Link href="/news/ai-in-orthopedics" className="hover:text-ink transition-colors">
            AI in Orthopedics
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/news/ai-in-orthopedics/${cat.slug}`}
            className="hover:text-ink transition-colors"
          >
            {cat.short}
          </Link>
        </nav>

        {/* Category pill + read time */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-medium text-brown bg-tan/20 px-3 py-1 rounded-full">
            {cat.short}
          </span>
          <span className="text-xs text-brown">{brief.readMinutes} min read</span>
        </div>

        {/* Headline */}
        <h1
          className="font-serif text-brown-dark font-normal mb-5"
          style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
        >
          {brief.headline}
        </h1>

        {/* Source metadata */}
        <div className="text-sm text-brown leading-relaxed mb-8 pb-8 border-b border-border">
          <p>
            <span className="text-ink font-medium">Source:</span> {brief.source.journal}
            <span className="mx-2">&middot;</span>
            <span className="text-ink font-medium">Published:</span>{' '}
            {brief.source.paperPublishedAt}
          </p>
          <p className="mt-1">
            <span className="text-ink font-medium">Authors:</span> {brief.source.authors}
            {doiUrl && (
              <>
                <span className="mx-2">&middot;</span>
                <a
                  href={doiUrl}
                  target="_blank"
                  rel="noopener"
                  className="text-brown hover:text-ink transition-colors underline decoration-border"
                >
                  {brief.source.doi ? `DOI: ${brief.source.doi}` : 'Source'}
                </a>
              </>
            )}
            {brief.source.openAccess && (
              <span className="ml-2 text-xs font-medium text-brown bg-peach/40 px-2 py-0.5 rounded">
                Open Access
              </span>
            )}
          </p>
          {brief.keyFigure && (
            <p className="mt-2">
              <span className="text-ink font-medium">Key {brief.keyFigure.label.toLowerCase().startsWith('table') ? 'table' : 'figure'}:</span>{' '}
              <span className="text-ink">{brief.keyFigure.label}</span>
              {' — '}
              {brief.keyFigure.description}
              {brief.keyFigure.url && (
                <>
                  {' '}
                  <a
                    href={brief.keyFigure.url}
                    target="_blank"
                    rel="noopener"
                    className="text-brown hover:text-ink transition-colors underline decoration-border"
                  >
                    View in source
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        {/* Bottom line callout */}
        <div
          className="rounded-xl p-5 mb-10 border"
          style={{
            backgroundColor: 'rgba(255,219,187,0.35)',
            borderColor: 'rgba(102,73,48,0.18)',
          }}
        >
          <p className="text-sm text-ink leading-relaxed">
            <span className="font-semibold">Bottom line: </span>
            {brief.bottomLine}
          </p>
        </div>

        {/* Body sections */}
        <div className="prose-oscrsj space-y-8">
          <section>
            <h2 className="font-serif text-xl text-brown-dark mb-3">What the study did</h2>
            <p className="text-ink leading-relaxed">{brief.whatTheyDid}</p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-brown-dark mb-3">What they found</h2>
            <p className="text-ink leading-relaxed">{brief.whatTheyFound}</p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-brown-dark mb-3">Why it matters for orthopedic practice</h2>
            <p className="text-ink leading-relaxed">{brief.whyItMatters}</p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-brown-dark mb-3">Limitations</h2>
            <p className="text-ink leading-relaxed">{brief.limitations}</p>
          </section>

          {brief.furtherReading && brief.furtherReading.length > 0 && (
            <section>
              <h2 className="font-serif text-xl text-brown-dark mb-3">Further reading</h2>
              <ul className="list-disc pl-6 space-y-1 text-ink">
                {brief.furtherReading.map((fr) => (
                  <li key={fr.href}>
                    <Link href={fr.href} className="text-brown hover:text-ink underline decoration-border">
                      {fr.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Full citation */}
        <div className="mt-12 pt-8 border-t border-border">
          <span className="section-label">Citation</span>
          <p className="text-sm text-ink leading-relaxed bg-cream-alt border border-border rounded-lg p-4">
            {brief.citation}
          </p>
        </div>

        {/* Cross-links */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={`/news/ai-in-orthopedics/${cat.slug}`}
            className="bg-white border border-border rounded-lg px-4 py-3 text-sm text-ink hover:border-tan hover:shadow-sm transition-all"
          >
            More in {cat.short} &rarr;
          </Link>
          <Link
            href="/news/ai-in-orthopedics"
            className="bg-white border border-border rounded-lg px-4 py-3 text-sm text-ink hover:border-tan hover:shadow-sm transition-all"
          >
            AI in Orthopedics hub &rarr;
          </Link>
        </div>

        {/* Submit CTA */}
        <div className="mt-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 text-center">
          <h3 className="font-serif text-xl text-brown-dark mb-2">Publishing AI research in orthopedics?</h3>
          <p className="text-sm text-ink/80 leading-relaxed mb-5 max-w-lg mx-auto">
            OSCRSJ accepts case reports and series on novel AI-assisted diagnoses and surgical planning. Free to publish in 2026.
          </p>
          <Link href="/submit" className="btn-primary-light">
            Submit a manuscript
          </Link>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-brown leading-relaxed mt-10">
          OSCRSJ News items are editorial summaries for educational purposes. They are not clinical recommendations, endorsements, or substitutes for the primary literature. Always consult the source paper and applicable specialty-society guidelines before changing practice.
        </p>
      </article>
    </div>
  )
}
