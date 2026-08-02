import type { MetadataRoute } from 'next'
import { AI_ORTHO_BRIEFS } from '@/lib/ai-ortho/data'
import { BOARD_MEMBER_BIOS } from '@/lib/schema/editorialBoard'
import { THIN_BIO_SLUGS } from '@/lib/schema/thinBioSlugs'
import { createAdminClient } from '@/lib/supabase/server'

const AI_ORTHO_CATEGORY_SLUGS = [
  'imaging',
  'surgical-planning',
  'robotics',
  'outcomes-prediction',
  'llms-and-decision-support',
  'research-tools',
]

/**
 * Regenerate hourly (2026-07-15). Without this the sitemap is generated ONCE
 * at build time and then served from the CDN indefinitely — observed live at
 * `x-vercel-cache: HIT`, `age: 7363` with e0005 and e0006 both missing hours
 * after publishing, i.e. Google could not discover either article until the
 * next unrelated deploy happened to rebuild it.
 *
 * Publishing is editor-driven and infrequent, so a fixed 1h ceiling makes new
 * articles discoverable promptly while keeping this cheap: crawlers hit
 * sitemap.xml rarely, and force-dynamic would run a DB query on every bot
 * request for no benefit. Pairs with the Data Cache fix in
 * lib/supabase/server.ts createAdminClient — without that, this route would
 * revalidate on schedule and still replay a cached PostgREST response.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.oscrsj.com'

  // Fetch all published article IDs for dynamic URL generation.
  // Failures here are non-fatal — sitemap falls back to static pages only.
  let articlePages: MetadataRoute.Sitemap = []
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('manuscripts')
      .select('id, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .returns<{ id: string; updated_at: string | null }[]>()
    if (data) {
      articlePages = data.map((m) => ({
        url: `${baseUrl}/articles/${m.id}`,
        lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.9,
      }))
    }
  } catch {
    // Supabase unavailable at build time — omit article URLs gracefully
  }

  const aiOrthoPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/news/ai-in-orthopedics`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...AI_ORTHO_CATEGORY_SLUGS.map((slug) => ({
      url: `${baseUrl}/news/ai-in-orthopedics/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // Individual briefs — one entry per AI_ORTHO_BRIEFS item
    ...AI_ORTHO_BRIEFS.map((brief) => ({
      url: `${baseUrl}/news/ai-in-orthopedics/${brief.category}/${brief.slug}`,
      lastModified: brief.publishedAt ? new Date(brief.publishedAt) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/news/ai-in-orthopedics/guides/imaging-primer-for-residents`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/news/ai-in-orthopedics/guides/llm-guide-for-trainees`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Submission Studio (2026-07-15). The old single /format page was never in
    // the sitemap at all, which is part of why it took six weeks to get crawled.
    // All four routes are listed now; each is independently indexable and each
    // targets a distinct author query.
    {
      url: `${baseUrl}/studio`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/studio/format`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/studio/find`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/studio/journals`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Added 2026-07-26 with the free-run allowance. /studio/unlock is a real
    // landing target (people search for how to get more free runs) and
    // /studio/terms is the document the mandatory tick box points at, so both
    // need to be crawlable rather than orphaned behind a form.
    {
      url: `${baseUrl}/studio/unlock`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/studio/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/articles/current-issue`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/articles/past-issues`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/articles/in-press`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/articles/most-read`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/articles/most-cited`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guide-for-authors`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/templates`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for-reviewers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/accessibility`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/apc`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/publication-agreement`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/peer-review`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/editorial-policies`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/open-access`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/aims-scope`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/editorial-board`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Individual board-member bio pages — one entry per member with a bio.
    // Filter out THIN_BIO_SLUGS (boilerplate-only entries that emit
    // robots:noindex on the page itself) so they don't get crawled.
    // When a thin bio is fleshed out, the slug is removed from
    // THIN_BIO_SLUGS in the same commit and the URL re-enters the sitemap
    // on next build — see lib/schema/thinBioSlugs.ts.
    ...Object.keys(BOARD_MEMBER_BIOS)
      .filter((slug) => !THIN_BIO_SLUGS.has(slug))
      .map((slug) => ({
        url: `${baseUrl}/editorial-board/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/media`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/subscribe`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/forgot-password`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/for-reviewers/apply`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/scholars`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/scholars/apply`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
  ]

  return [...articlePages, ...staticPages, ...aiOrthoPages]
}
