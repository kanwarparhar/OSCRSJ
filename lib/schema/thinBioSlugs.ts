// Editorial board member bio slugs whose live BOARD_MEMBER_BIOS entry is
// currently a boilerplate summary only — no education, experience,
// achievements, memberships, or awards. These pages emit
// `robots: { index: false, follow: true }` and are filtered out of the
// sitemap so Google's helpful-content classifier doesn't flag templated
// filler against the domain-level quality score.
//
// **Auto-flip mechanic:** when a thin bio is fleshed out (real `experience`
// or `achievements` array landed in `lib/schema/editorialBoard.ts`'s
// `BOARD_MEMBER_BIOS[<slug>]`), remove the slug from this Set in the same
// commit. The next `next build` rebuilds the static page with standard
// metadata + the sitemap re-includes the URL automatically.
//
// Per [[2026-04-30 John — Thin-Content Sweep]] (audit at
// 02 - OSCRSJ/Notes/2026-04-30 John — Thin-Content Sweep.md in the vault).
//
// Seed list (5 entries) reflects the post-2026-04-30-iteration-2 state:
// kanwar-parhar dropped (Founding Editor self-bio expansion),
// manvir-kaur dropped (Managing Editor promotion + bio expansion).

export const THIN_BIO_SLUGS = new Set<string>([
  'sukhman-singh',
  'shreya-chaudhuri',
  'abhijit-jayan',
  'akshay-phupate',
  'adithyaa-sivaramakrishnan',
])
