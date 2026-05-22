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
