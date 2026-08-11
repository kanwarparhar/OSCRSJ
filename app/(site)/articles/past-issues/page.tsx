import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

// noindex thin-content placeholder per John's 2026-04-30 sweep
// (^handoff-thin-content-noindex-implementation-2026-04-30).
// FLIP TRIGGER: remove the `robots` line below when ≥1 volume is
// ARCHIVED — i.e. when Volume 2 opens on 2027-01-01 and Volume 1 (2026)
// moves here. Under the continuous-publication model (one volume per
// calendar year), Volume 1 is the *current* volume until then, so this
// archive is legitimately empty and correctly stays noindex for now.
// See vault [[Publication Cadence & Issue Schedule]].
export const metadata: Metadata = {
  title: 'Past Issues — OSCRSJ',
  robots: { index: false, follow: true },
}

export default function PastIssuesPage() {
  return (
    <div>
      <PageHeader
        label="Archive"
        title="Past Issues"
        subtitle="Archive of all published issues"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <section className="mb-12 bg-cream-alt border border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">📁</div>
          <h2 className="section-heading mb-3">No Past Volumes Yet</h2>
          <p className="text-ink leading-relaxed max-w-lg mx-auto mb-2">
            Volume 1, Issue 1 (2026) is our current volume — see it on the{' '}
            <Link href="/articles/current-issue" className="text-brown underline hover:text-ink">Current Issue</Link>{' '}
            page. It moves into this archive when Volume 2 opens in January 2027, with full article listings and downloadable PDFs.
          </p>
          <p className="text-ink leading-relaxed max-w-lg mx-auto">
            OSCRSJ publishes continuously and open access, collecting each year&apos;s peer-reviewed case reports and series into an annual volume — a permanent, citable archive of orthopedic case literature.
          </p>
        </section>

        <section className="mb-12">
          <span className="section-label">Details</span>
          <h2 className="section-heading mb-5">What to Expect</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Publication Model', value: 'Continuous — one annual volume' },
              { label: 'Format', value: 'Online, open access' },
              { label: 'Archiving', value: 'Permanent digital archive, Crossref DOIs' },
              { label: 'Access', value: 'Free to read, download, share, and adapt with attribution (CC BY 4.0)' },
            ].map((fact) => (
              <div key={fact.label} className="bg-white border border-border rounded-xl p-6">
                <p className="text-xs font-semibold text-brown uppercase tracking-widest">{fact.label}</p>
                <p className="text-sm font-medium text-ink mt-0.5">{fact.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/articles/current-issue" className="btn-primary-light">View Current Issue</Link>
          <Link href="/articles/in-press" className="btn-outline">Articles in Press</Link>
        </div>
      </div>
    </div>
  )
}
