import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Media & Press Kit',
  description:
    'Official OSCRSJ logos, journal seal, mastheads, color palette, and boilerplate copy for press, partners, and institutional use.',
}

type Asset = {
  name: string
  description: string
  href: string
  filename: string
  recommendedUse: string
}

const LOCKUPS: Asset[] = [
  {
    name: 'Wordmark (peach on dark)',
    description: 'Inline logotype for dark backgrounds — site headers, footers, dark social posts.',
    href: '/brand/wordmark-peach.svg',
    filename: 'wordmark-peach.svg',
    recommendedUse: 'Dark backgrounds',
  },
  {
    name: 'Wordmark (ink on light)',
    description: 'Inline logotype for cream/white backgrounds — letterheads, email signatures, print.',
    href: '/brand/wordmark-ink.svg',
    filename: 'wordmark-ink.svg',
    recommendedUse: 'Light backgrounds',
  },
  {
    name: 'Seal (cream)',
    description: 'Circular journal seal on a cream backdrop — profile photos, About pages, book-style covers.',
    href: '/brand/seal-cream.svg',
    filename: 'seal-cream.svg',
    recommendedUse: 'Profile avatars, social images',
  },
  {
    name: 'Seal (dark)',
    description: 'Circular journal seal on a dark backdrop — the mirror of seal-cream for dark UIs.',
    href: '/brand/seal-dark.svg',
    filename: 'seal-dark.svg',
    recommendedUse: 'Dark UIs, reversed print',
  },
  {
    name: 'Masthead (cream)',
    description: 'Full lockup — eyebrow, wordmark, diamond rule, italic subtitle — on cream.',
    href: '/brand/masthead-cream.svg',
    filename: 'masthead-cream.svg',
    recommendedUse: 'Cover art, press releases',
  },
  {
    name: 'Masthead (dark)',
    description: 'Full lockup on dark — used in the homepage hero and Open Graph card.',
    href: '/brand/masthead-dark.svg',
    filename: 'masthead-dark.svg',
    recommendedUse: 'Hero images, dark covers',
  },
  {
    name: 'Combined lockup (cream)',
    description: 'Seal + wordmark composed lockup on cream — editorial stationery, one-pagers.',
    href: '/brand/combined-cream.svg',
    filename: 'combined-cream.svg',
    recommendedUse: 'Stationery, reports',
  },
  {
    name: 'Combined lockup (dark)',
    description: 'Seal + wordmark composed lockup on dark — dark stationery, partnership decks.',
    href: '/brand/combined-dark.svg',
    filename: 'combined-dark.svg',
    recommendedUse: 'Dark decks, partner slides',
  },
]

const COLORS = [
  { name: 'Peach', hex: '#FFDBBB', rgb: '255, 219, 187', usage: 'CTAs on dark, accent highlights' },
  { name: 'Peach Dark', hex: '#F0C49A', rgb: '240, 196, 154', usage: 'CTAs on light, eyebrow text' },
  { name: 'Brown', hex: '#664930', rgb: '102, 73, 48', usage: 'Accent text on light, button ink' },
  { name: 'Brown Dark', hex: '#3d2a18', rgb: '61, 42, 24', usage: 'Headings, nav, seal backdrop' },
  { name: 'Tan', hex: '#997E67', rgb: '153, 126, 103', usage: 'Decorative dividers only (never text)' },
  { name: 'Ink', hex: '#120D08', rgb: '18, 13, 8', usage: 'Body paragraph text on light (v2.3)' },
  { name: 'Dark', hex: '#1c0f05', rgb: '28, 15, 5', usage: 'Hero bg, nav bg, footer bg' },
  { name: 'Cream', hex: '#FDFBF8', rgb: '253, 251, 248', usage: 'Main page background — reading mode (v2.3)' },
]

export default function MediaPage() {
  return (
    <div>
      <PageHeader
        label="Media & Press"
        title="Press Kit"
        subtitle="Official OSCRSJ brand assets, colors, and boilerplate copy for press, institutional partners, and contributors. All assets are free to use with attribution."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Seal anchor */}
        <section className="mb-16 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/seal-cream.svg"
            alt="OSCRSJ journal seal"
            width={200}
            height={200}
            className="w-[160px] h-[160px] md:w-[200px] md:h-[200px]"
          />
        </section>

        {/* Boilerplate */}
        <section className="mb-16">
          <span className="section-label">About OSCRSJ</span>
          <h2 className="section-heading mb-4">Boilerplate Copy</h2>
          <div className="bg-white border border-border rounded-2xl p-8 space-y-4">
            <div>
              <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Short (one line)</p>
              <p className="text-ink leading-relaxed">
                OSCRSJ is an independent, peer-reviewed, open-access orthopedic journal for medical students, residents, and fellows.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Medium (one paragraph)</p>
              <p className="text-ink leading-relaxed">
                The Orthopedic Surgery Case Reports &amp; Series Journal (OSCRSJ) is an independent, peer-reviewed, open-access journal founded in 2026. OSCRSJ publishes case reports, case series, surgical techniques, and images in orthopedics across every musculoskeletal subspecialty. The journal is built specifically for trainees — medical students, residents, and fellows — and operates a fast, double-blind peer review process with a target of 30-day first decisions.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Long (two paragraphs)</p>
              <p className="text-ink leading-relaxed mb-3">
                The Orthopedic Surgery Case Reports &amp; Series Journal (OSCRSJ) is an independent, peer-reviewed, open-access journal founded in 2026 to give early-career orthopedic clinicians a credible, US-based venue for scholarly publication. OSCRSJ publishes case reports, case series, surgical techniques, images in orthopedics, letters to the editor, and invited review articles across every musculoskeletal subspecialty — trauma, sports medicine, spine, adult reconstruction, pediatric orthopedics, hand and wrist, foot and ankle, and orthopedic oncology.
              </p>
              <p className="text-ink leading-relaxed">
                Every article receives a Crossref DOI at acceptance, is published open access under a CC BY-NC-ND 4.0 license, and is indexed in Google Scholar with an active pathway toward PubMed indexing. The journal operates a double-blind peer review process, publishes monthly, and waives article processing charges for trainees and authors in low-income countries. OSCRSJ is a COPE member committed to the highest standards of publication ethics.
              </p>
            </div>
          </div>
        </section>

        {/* Logos & Lockups */}
        <section className="mb-16">
          <span className="section-label">Brand Library</span>
          <h2 className="section-heading mb-2">Logos, Seals &amp; Lockups</h2>
          <p className="text-ink leading-relaxed mb-6 max-w-3xl">
            All files are SVG — vector, resolution-independent, and safe for web, print, and presentation. Right-click any file and choose &ldquo;Save link as&hellip;&rdquo; to download.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {LOCKUPS.map((asset) => (
              <div key={asset.filename} className="bg-white border border-border rounded-xl p-6">
                <div
                  className="flex items-center justify-center rounded-lg mb-4 overflow-hidden"
                  style={{
                    background: asset.filename.includes('dark') || asset.filename.includes('peach')
                      ? '#3d2a18'
                      : '#FDFBF8',
                    minHeight: '140px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.href} alt={asset.name} className="max-w-[80%] max-h-[120px]" />
                </div>
                <p className="font-semibold text-ink mb-1">{asset.name}</p>
                <p className="text-sm text-ink/70 mb-2 leading-relaxed">{asset.description}</p>
                <p className="text-xs text-brown uppercase tracking-widest mb-3">{asset.recommendedUse}</p>
                <a
                  href={asset.href}
                  download={asset.filename}
                  className="text-sm text-brown hover:underline font-medium"
                >
                  Download {asset.filename} ↓
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Color palette */}
        <section className="mb-16">
          <span className="section-label">Brand Colors</span>
          <h2 className="section-heading mb-2">Color Palette</h2>
          <p className="text-ink leading-relaxed mb-6 max-w-3xl">
            The OSCRSJ palette is warm editorial — peach on brown-dark. Use the hex values below in design software or HTML/CSS.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {COLORS.map((c) => (
              <div key={c.hex} className="bg-white border border-border rounded-xl overflow-hidden">
                <div style={{ background: c.hex, height: '72px' }} />
                <div className="p-4">
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-brown font-mono mt-0.5">{c.hex}</p>
                  <p className="text-xs text-ink/60 font-mono mt-0.5">rgb({c.rgb})</p>
                  <p className="text-xs text-ink/60 mt-2 leading-snug">{c.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <span className="section-label">Typography</span>
          <h2 className="section-heading mb-2">Fonts</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-border rounded-xl p-6">
              <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Headings</p>
              <p className="font-serif text-ink text-3xl mb-2">DM Serif Display</p>
              <p className="text-sm text-ink/70">
                Editorial serif for headings, masthead, seal wordmark. Available free on Google Fonts.
              </p>
            </div>
            <div className="bg-white border border-border rounded-xl p-6">
              <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Body</p>
              <p className="text-ink text-3xl mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>Inter</p>
              <p className="text-sm text-ink/70">
                Clean sans-serif for UI, body copy, metadata. Available free on Google Fonts.
              </p>
            </div>
          </div>
        </section>

        {/* Usage guidelines */}
        <section className="mb-16">
          <span className="section-label">Rules of the Road</span>
          <h2 className="section-heading mb-4">Usage Guidelines</h2>
          <div className="bg-white border border-border rounded-xl p-6 space-y-4">
            <div>
              <p className="font-semibold text-ink mb-1">✓ Do</p>
              <ul className="text-ink leading-relaxed list-disc list-inside space-y-1">
                <li>Use the peach wordmark on dark backgrounds and the ink wordmark on cream or white.</li>
                <li>Maintain at least a 16px padding of empty space around any lockup.</li>
                <li>Credit articles as &ldquo;Published in OSCRSJ (oscrsj.com)&rdquo; when referenced in press.</li>
                <li>Link the journal name to <Link href="/" className="text-brown hover:underline">oscrsj.com</Link> when used online.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">✗ Don&rsquo;t</p>
              <ul className="text-ink leading-relaxed list-disc list-inside space-y-1">
                <li>Recolor the wordmark outside the official palette.</li>
                <li>Add drop shadows, outlines, or effects to any lockup.</li>
                <li>Stretch, rotate, or skew any brand asset.</li>
                <li>Use the seal as a watermark over clinical imagery.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section>
          <div className="bg-cream-alt rounded-2xl p-8 text-center">
            <span className="section-label">Press Inquiries</span>
            <h2 className="section-heading mb-4">Need Something Custom?</h2>
            <p className="text-ink leading-relaxed max-w-2xl mx-auto mb-6">
              For interview requests, bespoke asset sizes, or press releases, reach out to the editorial office.
            </p>
            <Link href="/contact" className="btn-primary-light">
              Contact the Editorial Office
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
