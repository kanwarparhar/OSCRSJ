/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // /topics/* pages were retired in favor of the in-page filter on /articles
    // (commit: "Retire topic pages, add in-page article filtering").
    // Both the old sitemap slug scheme (sports-medicine, hand-wrist, etc.)
    // AND the old route-key scheme (sports, hand, tumor, pediatrics) get
    // mapped explicitly so previously crawled or externally-linked URLs
    // still land on a pre-filtered /articles view.
    return [
      // Route-key → descriptive slug (old internal /topics/<key> URLs)
      { source: '/topics/sports', destination: '/articles?topic=sports-medicine', permanent: true },
      { source: '/topics/hand', destination: '/articles?topic=hand-wrist', permanent: true },
      { source: '/topics/pediatrics', destination: '/articles?topic=pediatric-orthopedics', permanent: true },
      { source: '/topics/tumor', destination: '/articles?topic=orthopedic-oncology', permanent: true },
      // Generic passthrough for every other slug (trauma, spine, arthroplasty,
      // foot-ankle, sports-medicine, hand-wrist, pediatric-orthopedics,
      // orthopedic-oncology, and any unknowns).
      { source: '/topics/:slug', destination: '/articles?topic=:slug', permanent: true },
      // /topics index page also retired.
      { source: '/topics', destination: '/articles', permanent: true },
    ]
  },
}

module.exports = nextConfig
