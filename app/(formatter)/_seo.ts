import type { Metadata } from 'next'

// Shared SEO plumbing for the Submission Studio route group (John, 2026-07-25).
//
// WHY THIS EXISTS. Each Studio route declared its own `openGraph` block. In the
// App Router a page-level `openGraph` REPLACES the root layout's, so three
// things silently dropped off every Studio URL:
//
//   1. `twitter:*` — never declared on any Studio page, so the root layout's
//      journal card leaked through. Sharing /studio/format rendered a card
//      titled "OSCRSJ — Orthopedic Surgery Case Reports & Series Journal"
//      described as "A peer-reviewed, open-access orthopedic journal
//      publishing case reports..." — the wrong product entirely. Verified live
//      2026-07-25 by curling the four routes.
//   2. `og:site_name` — set once in the root layout, dropped by the override.
//   3. `og:image` — no image tag is emitted anywhere on this site today, even
//      though app/opengraph-image.tsx renders fine (HTTP 200). Pointing at it
//      explicitly makes the Studio routes deterministic rather than relying on
//      a file-convention merge that demonstrably is not firing. The sitewide
//      absence is a separate defect; see the Franklin handoff.
//
// A launch announcement is mostly link shares, so a wrong or imageless card is
// a launch-day cost, not a cosmetic one. Route metadata goes through
// `studioMetadata()` so a future route cannot reintroduce the same gap by
// hand-rolling its own openGraph block.

const BASE = 'https://www.oscrsj.com'

/** The journal's default OG card. Correct-but-generic: it signs the Studio as
 *  OSCRSJ's, which is the product's main credibility asset. A Studio-specific
 *  card is a design task and is specced to Franklin, not invented here. */
const OG_IMAGE = {
  url: `${BASE}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
}

interface StudioMetaInput {
  /** Full <title>. Passed as `absolute` so the layout template does not double-suffix. */
  title: string
  /** Meta description. Distinct per route — each targets a different query intent. */
  description: string
  /** Path only, e.g. '/studio/find'. Canonical + og:url are derived from it. */
  path: string
  /** Social-card copy. Falls back to `description` when the SERP line already reads well socially. */
  social?: string
}

export function studioMetadata({ title, description, path, social }: StudioMetaInput): Metadata {
  const url = `${BASE}${path}`
  const socialCopy = social ?? description
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: socialCopy,
      url,
      siteName: 'Submission Studio by OSCRSJ',
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: socialCopy,
      images: [OG_IMAGE.url],
    },
  }
}

/** BreadcrumbList for a Studio route. The hub is always position 2 so the four
 *  URLs read as one product rather than four unrelated pages — the Studio is on
 *  a DA~0 domain and every structural signal that groups them is worth having.
 *  Pass `[]` for the hub itself. */
export function studioBreadcrumb(trail: { name: string; path: string }[]) {
  const items = [
    { name: 'Home', item: BASE },
    { name: 'Submission Studio', item: `${BASE}/studio` },
    ...trail.map((t) => ({ name: t.name, item: `${BASE}${t.path}` })),
  ]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  }
}

/** Per-tool schema. The hub carries the SoftwareApplication for the Studio as a
 *  whole; each tool page declares its own WebApplication so a tool URL is
 *  independently intelligible to a crawler or an LLM that lands on it directly
 *  without ever seeing the hub. `isPartOf` ties it back to the hub entity. */
export function studioToolSchema(opts: {
  name: string
  path: string
  description: string
  featureList: string[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: opts.name,
    url: `${BASE}${opts.path}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript.',
    description: opts.description,
    featureList: opts.featureList,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isPartOf: {
      '@type': 'SoftwareApplication',
      name: 'Submission Studio',
      url: `${BASE}/studio`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
      url: BASE,
    },
  }
}
