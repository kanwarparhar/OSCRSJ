// Builder for NewsArticle + nested ScholarlyArticle JSON-LD.
// Rendered into every brief page as a <script type="application/ld+json">
// inside the server-rendered React tree (see app/news/.../[brief]/page.tsx).
// This guarantees the structured data ships in the initial SSR HTML —
// verify with Google's Rich Results Test on the deployed page.
//
// Spec references (schema.org, verified April 2026):
//   https://schema.org/NewsArticle
//   https://schema.org/ScholarlyArticle

export interface NewsArticleSchemaInput {
  headline: string
  datePublished: string // ISO date (YYYY-MM-DD) preferred
  summary: string // short description / bottom-line
  url: string // canonical URL of the brief page
  authors?: string[] // OSCRSJ authors of the brief (editorial voice = OSCRSJ)
  originalPaperTitle: string
  originalPaperJournal: string
  originalPaperDate: string // publication date of the source paper
  originalPaperAuthors?: string // Vancouver-style author string, e.g. "Smith JA, Chen L, et al."
  doi?: string // "10.2106/JBJS.25.00001" — no URL prefix
  sourceUrl?: string // fallback if no DOI
}

interface NewsArticleSchema {
  '@context': 'https://schema.org'
  '@type': 'NewsArticle'
  headline: string
  datePublished: string
  description: string
  url: string
  mainEntityOfPage: { '@type': 'WebPage'; '@id': string }
  publisher: {
    '@type': 'Organization'
    name: string
    url: string
  }
  author: Array<{ '@type': 'Organization' | 'Person'; name: string }>
  citation: {
    '@type': 'ScholarlyArticle'
    name: string
    datePublished: string
    isPartOf: { '@type': 'Periodical'; name: string }
    author?: string
    sameAs?: string
    identifier?: { '@type': 'PropertyValue'; propertyID: 'DOI'; value: string }
  }
}

/**
 * Build a NewsArticle JSON-LD object with nested ScholarlyArticle citation
 * pointing at the source paper. Emit this inside a
 * <script type="application/ld+json"> tag within a Server Component so it
 * renders in SSR HTML.
 */
export function buildNewsArticleSchema(
  input: NewsArticleSchemaInput
): NewsArticleSchema {
  const doiUrl = input.doi ? `https://doi.org/${input.doi}` : undefined

  const citation: NewsArticleSchema['citation'] = {
    '@type': 'ScholarlyArticle',
    name: input.originalPaperTitle,
    datePublished: input.originalPaperDate,
    isPartOf: {
      '@type': 'Periodical',
      name: input.originalPaperJournal,
    },
  }

  if (input.originalPaperAuthors) citation.author = input.originalPaperAuthors
  if (doiUrl || input.sourceUrl) citation.sameAs = doiUrl ?? input.sourceUrl
  if (input.doi) {
    citation.identifier = {
      '@type': 'PropertyValue',
      propertyID: 'DOI',
      value: input.doi,
    }
  }

  const authors =
    input.authors && input.authors.length > 0
      ? input.authors.map((name) => ({ '@type': 'Person' as const, name }))
      : [{ '@type': 'Organization' as const, name: 'OSCRSJ Editorial' }]

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: input.headline,
    datePublished: input.datePublished,
    description: input.summary,
    url: input.url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    publisher: {
      '@type': 'Organization',
      name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
      url: 'https://oscrsj.com',
    },
    author: authors,
    citation,
  }
}
