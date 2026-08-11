import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  // Endpoints under /api that must stay out of the index. Previously this was
  // a single wildcard `/api/` disallow, which also blocked the public PDF
  // proxy that used to live at /api/articles/[id]/pdf — so Semantic Scholar,
  // Bing and Turnitin/iThenticate could never fetch a full text, and the
  // Crossref similarity-check crawler URL in every deposit would have been
  // unreachable.
  //
  // The PDF now lives at /articles/{eloc}/pdf, but /api/articles/ stays
  // crawlable because that legacy path is baked into the six already-published
  // PDFs and past author emails, and now serves a 308 to the canonical URL. A
  // crawler that cannot fetch the redirect cannot follow it.
  const sensitiveApi = [
    '/api/admin/',
    '/api/auth/',
    '/api/cron/',
    '/api/dashboard/',
    '/api/extract-metadata/',
    '/api/finder/',
    '/api/format/',
    '/api/preview/',
    '/api/publish/',
    '/api/studio/',
    '/api/submissions/',
    '/api/webhooks/',
  ]

  return {
    rules: [
      {
        userAgent: ['Googlebot', 'Googlebot-Scholar', 'Googlebot-Extended', 'GPTBot', 'Claudebot', 'Ccbot'],
        allow: '/',
        disallow: ['/dashboard/', '/review/', ...sensitiveApi],
      },
      {
        userAgent: 'Perplexitybot',
        allow: '/',
        disallow: ['/dashboard/', '/review/', ...sensitiveApi],
      },
      {
        userAgent: '*',
        allow: ['/', '/api/articles/'],
        disallow: ['/dashboard/', '/review/', ...sensitiveApi],
      },
    ],
    sitemap: 'https://www.oscrsj.com/sitemap.xml',
  }
}
