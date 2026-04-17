import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AI_ORTHO_CATEGORIES,
  getBriefsByCategory,
  getCategory,
} from '@/lib/ai-ortho/data'
import { buildBreadcrumbSchema } from '@/lib/schema/breadcrumb'

interface PageProps {
  params: { slug: string }
}

export function generateStaticParams() {
  return AI_ORTHO_CATEGORIES.map((c) => ({ slug: c.slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const cat = getCategory(params.slug)
  if (!cat) return { title: 'AI in Orthopedics' }
  return {
    title: `${cat.label} | AI in Orthopedics`,
    description: cat.description,
    alternates: {
      canonical: `https://oscrsj.com/news/ai-in-orthopedics/${cat.slug}`,
    },
  }
}

export default function CategoryArchive({ params }: PageProps) {
  const cat = getCategory(params.slug)
  if (!cat) notFound()

  const briefs = getBriefsByCategory(cat.slug)
  const Icon = cat.Icon

  const breadcrumbLd = buildBreadcrumbSchema([
    { name: 'News', url: 'https://oscrsj.com/news' },
    { name: 'AI in Orthopedics', url: 'https://oscrsj.com/news/ai-in-orthopedics' },
    { name: cat.short, url: `https://oscrsj.com/news/ai-in-orthopedics/${cat.slug}` },
  ])

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* Hero */}
      <section
        className="relative flex items-center justify-center text-center"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, var(--brown) 0%, var(--dark) 70%)',
          minHeight: '280px',
          padding: '80px 24px',
        }}
      >
        <div className="max-w-content mx-auto">
          <span
            className="uppercase font-medium mb-3 block text-peach/60"
            style={{ fontSize: '11px', letterSpacing: '0.12em' }}
          >
            AI in Orthopedics
          </span>
          <div className="inline-flex items-center gap-3 mb-3 text-peach">
            <Icon className="w-7 h-7" />
            <h1
              className="font-serif font-normal"
              style={{ fontSize: 'clamp(30px, 4vw, 40px)', letterSpacing: '-0.02em' }}
            >
              {cat.label}
            </h1>
          </div>
          <p className="text-peach/70 text-base max-w-xl mx-auto mt-3 leading-relaxed">
            {cat.description}
          </p>
        </div>
      </section>

      {/* Breadcrumb */}
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <nav className="text-xs text-tan">
          <Link href="/news" className="hover:text-brown-dark transition-colors">
            News
          </Link>
          <span className="mx-2">/</span>
          <Link href="/news/ai-in-orthopedics" className="hover:text-brown-dark transition-colors">
            AI in Orthopedics
          </Link>
          <span className="mx-2">/</span>
          <span className="text-brown-dark">{cat.short}</span>
        </nav>
      </div>

      {/* Briefs feed */}
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {briefs.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-10 text-center">
            <p className="text-brown-dark text-base font-medium mb-1">
              Briefs in this category publish in the next editorial cycle.
            </p>
            <p className="text-tan text-sm max-w-md mx-auto mt-2">
              Follow the hub or subscribe for updates. Every brief will link to the primary peer-reviewed source.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link href="/news/ai-in-orthopedics" className="btn-primary-light">
                Back to hub
              </Link>
              <Link href="/subscribe" className="text-sm text-brown font-medium self-center hover:text-brown-dark">
                Subscribe &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {briefs.map((b) => (
              <Link
                key={b.slug}
                href={`/news/ai-in-orthopedics/${cat.slug}/${b.slug}`}
                className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-medium text-brown bg-tan/20 px-3 py-1 rounded-full">
                    {cat.short}
                  </span>
                  <span className="text-xs text-tan">{b.readMinutes} min read</span>
                </div>
                <h3 className="font-serif text-lg text-brown-dark leading-snug mb-2">
                  {b.headline}
                </h3>
                <p className="text-sm text-brown-dark/80 leading-relaxed mb-3">
                  {b.summary}
                </p>
                <p className="text-xs text-tan">
                  {b.source.journal} &middot;{' '}
                  {new Date(b.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}

        {/* Cross-links to other categories */}
        <div className="mt-16 pt-10 border-t border-border">
          <span className="section-label">Other categories</span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {AI_ORTHO_CATEGORIES.filter((c) => c.slug !== cat.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/news/ai-in-orthopedics/${c.slug}`}
                className="bg-white border border-border rounded-lg px-4 py-3 text-sm text-brown-dark hover:border-tan hover:shadow-sm transition-all"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
