import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['Googlebot', 'Googlebot-Scholar', 'Googlebot-Extended', 'GPTBot', 'Claudebot', 'Ccbot'],
        allow: '/',
      },
      {
        userAgent: 'Perplexitybot',
        allow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: '/api/',
      },
    ],
    sitemap: 'https://oscrsj.com/sitemap.xml',
  }
}
