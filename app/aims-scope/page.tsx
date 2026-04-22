import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Aims & Scope' }

export default function AimsScopePage() {
  return (
    <div>
      <PageHeader label="Journal Information" title="Aims & Scope" />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20 journal-prose">
        <div className="prose-like space-y-8 text-sm leading-relaxed">

          <section className="mb-12">
            <span className="section-label">Our Purpose</span>
            <h2 className="section-heading mb-3">Purpose</h2>
            <p className="text-ink">
              The Orthopedic Surgery Case Reports &amp; Series Journal (OSCRSJ) is a peer-reviewed, open-access journal dedicated to the publication of case reports and case series in all subspecialties of orthopedic surgery and musculoskeletal medicine. Our purpose is to disseminate clinically instructive, novel, and educationally valuable case-based literature to a global audience, with a particular emphasis on supporting trainees at the early stages of their surgical careers.
            </p>
          </section>

          <section className="mb-12">
            <span className="section-label">Article Types</span>
            <h2 className="section-heading mb-3">What We Publish</h2>
            <p className="text-ink mb-3">OSCRSJ publishes:</p>
            <ul className="space-y-2 pl-4">
              {[
                'Case Reports: detailed documentation of a single clinical case with unusual presentation, rare diagnosis, novel treatment approach, or important teaching value.',
                'Case Series: a collection of three or more cases sharing meaningful clinical features, analyzed collectively to identify patterns, outcomes, or complications.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brown mt-1 flex-shrink-0">→</span>
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <span className="section-label">Coverage</span>
            <h2 className="section-heading mb-3">Subspecialties Covered</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                'Trauma & Fractures', 'Sports Medicine & Arthroscopy', 'Spine Surgery',
                'Total Joint Arthroplasty', 'Pediatric Orthopedics', 'Hand, Wrist & Elbow',
                'Foot & Ankle Surgery', 'Orthopedic Oncology & Tumors', 'Shoulder & Shoulder Arthroplasty',
                'Nerve & Peripheral Nerve Surgery', 'Revision Surgery', 'Rare & Unusual Presentations',
              ].map((sub) => (
                <div key={sub} className="flex items-center gap-2 bg-white border border-border rounded-lg px-4 py-2.5">
                  <svg className="w-3.5 h-3.5 text-brown flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-ink">{sub}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <span className="section-label">Readership</span>
            <h2 className="section-heading mb-3">Target Audience</h2>
            <p className="text-ink">
              OSCRSJ is designed for and authored by medical students, residents, fellows, and attending orthopedic surgeons. We are committed to being the most accessible, trainee-friendly peer-reviewed orthopedic journal in the United States — lowering the barrier to publishing without compromising the rigor of peer review.
            </p>
          </section>

          <section className="mb-12">
            <span className="section-label">Access</span>
            <h2 className="section-heading mb-3">Open Access Policy</h2>
            <p className="text-ink">
              All articles published in OSCRSJ are freely available to read, download, and share under a Creative Commons Attribution (CC BY 4.0) license. We do not charge readers or institutions for access. The journal is sustained through article processing charges (APCs), which are currently waived during our launch phase. We believe that publicly relevant medical literature should be publicly accessible.
            </p>
          </section>

          <section className="mb-12">
            <span className="section-label">Exclusions</span>
            <h2 className="section-heading mb-3">What We Do Not Publish</h2>
            <ul className="space-y-2 pl-4">
              {[
                'Randomized controlled trials, cohort studies, or other study designs (these are better suited to primary research journals)',
                'Review articles or systematic reviews',
                'Editorials, commentaries, or opinion pieces',
                'Animal studies or basic science research',
                'Submissions without appropriate patient consent or IRB documentation',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brown mt-1 flex-shrink-0">&#10005;</span>
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link href="/submit" className="btn-primary-light">Submit a Manuscript</Link>
          <Link href="/guide-for-authors" className="btn-outline">Guide for Authors</Link>
        </div>
      </div>
    </div>
  )
}
