import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SOCIAL_CHANNELS } from '@/lib/social'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://www.oscrsj.com/#website',
        name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
        url: 'https://www.oscrsj.com',
        description:
          'A peer-reviewed, open-access journal publishing orthopedic case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor.',
        publisher: { '@id': 'https://www.oscrsj.com/#organization' },
        inLanguage: 'en-US',
      },
      {
        '@type': 'Organization',
        '@id': 'https://www.oscrsj.com/#organization',
        name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
        alternateName: 'OSCRSJ',
        url: 'https://www.oscrsj.com',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.oscrsj.com/logo.svg',
        },
        foundingDate: '2026',
        description:
          'Independent, peer-reviewed, open-access orthopedic journal publishing case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor for the global orthopedic surgery community.',
        // sameAs: Knowledge Graph entity disambiguation — when Google sees these URLs in
        // Organization JSON-LD, it links the OSCRSJ entity to the social profiles, strengthening
        // the brand SERP panel and AI-citation surface presence (ChatGPT, Claude, Perplexity, etc.).
        // URLs are sourced from lib/social.ts so footer + contact + press-kit + JSON-LD never drift.
        sameAs: SOCIAL_CHANNELS.map((c) => c.url),
      },
      {
        '@type': 'Periodical',
        '@id': 'https://www.oscrsj.com/#periodical',
        name: 'Orthopedic Surgery Case Reports and Series Journal',
        alternateName: 'OSCRSJ',
        url: 'https://www.oscrsj.com',
        publisher: { '@id': 'https://www.oscrsj.com/#organization' },
        inLanguage: 'en-US',
        // issn: '' — populate once Janine lands ISSN (Gate 1, post-5-articles)
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  )
}
