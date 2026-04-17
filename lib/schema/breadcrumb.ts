// Helper for emitting BreadcrumbList JSON-LD. Wraps the visual breadcrumbs
// already rendered in the page so Google can surface breadcrumb-enhanced
// SERP snippets. Inject via:
//   <script
//     type="application/ld+json"
//     dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbSchema([...])) }}
//   />
// inside a Server Component's JSX to guarantee SSR emission.

export interface BreadcrumbItem {
  name: string
  url: string
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
