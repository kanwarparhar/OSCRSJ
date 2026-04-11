import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'About OSCRSJ' }

export default function AboutPage() {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">About OSCRSJ</h1>
        <p className="text-tan mt-2 text-lg">
          The Orthopedic Surgery Case Reports &amp; Series Journal
        </p>
      </div>

      {/* Mission */}
      <section className="mb-10 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Our Mission</h2>
        <p className="text-tan leading-relaxed">
          OSCRSJ exists to give medical students, residents, and fellows a credible, accessible, US-based venue to publish orthopedic case reports and case series. We believe that early-career clinicians produce important educational literature that deserves the same rigorous peer review — and lasting accessibility — as work from established researchers.
        </p>
      </section>

      {/* Key facts */}
      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-5">At a Glance</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Journal Type', value: 'Open Access, Peer-Reviewed' },
            { label: 'Based In', value: 'United States' },
            { label: 'Founded', value: '2026' },
            { label: 'Publisher', value: 'Independent (no commercial publisher)' },
            { label: 'DOI Registration', value: 'Crossref' },
            { label: 'Publication Frequency', value: 'Monthly issues' },
            { label: 'Current APC', value: 'Free through end of 2026' },
            { label: 'Indexing Goal', value: 'PubMed (2-year pathway)' },
          ].map((fact) => (
            <div key={fact.label} className="flex items-start gap-3 bg-cream border border-border rounded-xl p-4">
              <div>
                <p className="text-xs font-semibold text-tan uppercase tracking-widest">{fact.label}</p>
                <p className="text-sm font-medium text-brown-dark mt-0.5">{fact.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What we publish */}
      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">What We Publish</h2>
        <p className="text-tan leading-relaxed mb-4">
          We publish case reports and case series across all subspecialties of orthopedic surgery, including trauma and fractures, sports medicine, spine, arthroplasty, pediatric orthopedics, hand and wrist, foot and ankle, and orthopedic oncology.
        </p>
        <p className="text-tan leading-relaxed">
          We prioritize submissions that are instructive, novel, or that challenge current clinical thinking. Every article undergoes double-blind peer review by practicing orthopedic surgeons.
        </p>
      </section>

      {/* Why OSCRSJ */}
      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-5">Why Publish With Us?</h2>
        <div className="space-y-3">
          {[
            { title: 'Trainee-focused', desc: 'We specifically encourage submissions from medical students, residents, and fellows — the authors most large journals underserve.' },
            { title: 'Fast peer review', desc: 'Our target: first decision within 30 days. We respect your time and career timeline.' },
            { title: 'Free to publish in 2026', desc: 'No APCs during our launch phase. We want to earn your trust before asking for payment.' },
            { title: 'Transparent process', desc: 'Clear submission guidelines, clear pricing, clear peer review criteria. No surprises.' },
            { title: 'DOI-registered and indexed', desc: 'Every article receives a Crossref DOI. We are actively pursuing PubMed indexing.' },
            { title: 'LLM-assisted operations', desc: 'Our backend is AI-augmented, which means faster turnarounds and less admin delay than traditional journals.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 bg-cream border border-border rounded-xl p-5">
              <svg className="w-5 h-5 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-brown-dark text-sm">{item.title}</p>
                <p className="text-sm text-tan mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/aims-scope" className="btn-primary">View Aims & Scope</Link>
        <Link href="/editorial-board" className="btn-outline">Meet the Editorial Board</Link>
        <Link href="/contact" className="btn-outline">Contact Us</Link>
      </div>
    </div>
  )
}
