// Canonical OSCRSJ social channel data — the single source of truth referenced by:
//   - components/Footer.tsx (icon row above copyright)
//   - app/contact/page.tsx ("Follow Us" section)
//   - app/media/page.tsx ("Official Channels" section in Press Kit)
//   - app/layout.tsx (Organization JSON-LD `sameAs` array — Knowledge Graph entity signal)
//
// When adding or changing a channel, update HERE ONLY — every consumer reads from this array.
// The `sameAs` array Google ingests is built from `SOCIAL_CHANNELS.map(c => c.url)`, so URL drift
// between footer/contact and JSON-LD is impossible by construction.
//
// Listing order matters for `sameAs` precedence (first listed = slight indexer preference).
// Convention here: highest professional-context-fit first.

export type SocialName = 'LinkedIn' | 'X' | 'Instagram' | 'YouTube'

export type SocialChannel = {
  name: SocialName
  url: string
  handle: string
  ariaLabel: string
}

export const SOCIAL_CHANNELS: SocialChannel[] = [
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/oscrsj-journal/',
    handle: 'oscrsj-journal',
    ariaLabel: 'OSCRSJ on LinkedIn',
  },
  {
    name: 'X',
    url: 'https://x.com/OSCRSJ',
    handle: '@OSCRSJ',
    ariaLabel: 'OSCRSJ on X (formerly Twitter)',
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/oscrsj/',
    handle: '@oscrsj',
    ariaLabel: 'OSCRSJ on Instagram',
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/@OSCRSJ',
    handle: '@OSCRSJ',
    ariaLabel: 'OSCRSJ on YouTube',
  },
]
