import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Editorial Board' }

export default function EditorialBoardPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Editorial Board</h1>
        <p className="text-charcoal-muted mt-2">
          OSCRSJ is guided by an editorial board of practicing orthopedic surgeons and researchers committed to rigorous, fair peer review.
        </p>
      </div>

      {/* Editor-in-Chief */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-charcoal-muted uppercase tracking-widest mb-4">Editor-in-Chief</h2>
        <div className="bg-white border border-border rounded-xl p-6 flex items-start gap-5">
          <div className="w-14 h-14 rounded-full bg-coral/10 flex-shrink-0 flex items-center justify-center">
            <svg className="w-7 h-7 text-coral/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-charcoal">Position Available</p>
            <p className="text-sm text-charcoal-muted mt-0.5">Editor-in-Chief · OSCRSJ</p>
            <p className="text-sm text-charcoal-muted mt-2">
              We are actively recruiting an Editor-in-Chief with expertise in orthopedic surgery and academic publishing. Interested?{' '}
              <Link href="/contact" className="text-coral hover:underline">Get in touch →</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Associate Editors */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-charcoal-muted uppercase tracking-widest mb-4">Associate Editors</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            'Trauma & Fractures', 'Sports Medicine', 'Spine', 'Arthroplasty',
            'Pediatric Orthopedics', 'Hand & Wrist', 'Foot & Ankle', 'Tumor & Oncology',
          ].map((specialty) => (
            <div key={specialty} className="bg-white border border-border rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-sand flex-shrink-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-charcoal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal-muted italic">Recruiting</p>
                <p className="text-xs text-charcoal-light mt-0.5">Associate Editor · {specialty}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Join the board CTA */}
      <div className="bg-gradient-to-br from-coral/10 to-sand border border-coral/20 rounded-2xl p-8 text-center">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-2">Join Our Editorial Board</h2>
        <p className="text-charcoal-muted text-sm mb-6 max-w-xl mx-auto">
          We are building an editorial board of practicing orthopedic surgeons across all subspecialties. Board members contribute to the mission of providing fast, fair, high-quality peer review for early-career surgeons.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/contact" className="btn-primary">Express Interest</Link>
          <Link href="/about" className="btn-outline">Learn More About OSCRSJ</Link>
        </div>
      </div>
    </div>
  )
}
