import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Editorial Board' }

export default function EditorialBoardPage() {
  return (
    <div>
      <PageHeader
        label="Our Team"
        title="Editorial Board"
        subtitle="OSCRSJ is guided by an editorial board of practicing orthopedic surgeons and researchers committed to rigorous, fair peer review."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Editor-in-Chief */}
        <section className="mb-12">
          <span className="section-label">Leadership</span>
          <h2 className="section-heading mb-4">Editor-in-Chief</h2>
          <div className="bg-white border border-border rounded-xl p-6 flex items-start gap-5">
            <div className="w-14 h-14 rounded-full bg-tan/20 flex-shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 text-brown/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-ink">Position Available</p>
              <p className="text-sm text-brown mt-0.5">Editor-in-Chief · OSCRSJ</p>
              <p className="text-sm text-ink mt-2">
                We are actively recruiting an Editor-in-Chief with expertise in orthopedic surgery and academic publishing. Interested?{' '}
                <Link href="/contact" className="text-brown hover:underline">Get in touch →</Link>
              </p>
            </div>
          </div>
        </section>

        {/* Associate Editors */}
        <section className="mb-12">
          <span className="section-label">Subspecialty Editors</span>
          <h2 className="section-heading mb-4">Associate Editors</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { name: 'Nathaniel Schaffer, MD', specialty: 'Trauma & Fractures', recruiting: false },
              { name: null, specialty: 'Sports Medicine', recruiting: true },
              { name: 'Miguel A. Schmitz, MD', specialty: 'Spine', recruiting: false },
              { name: 'Bill K. Huang, MD', specialty: 'Adult Reconstruction', recruiting: false },
              { name: null, specialty: 'Pediatric Orthopedics', recruiting: true },
              { name: null, specialty: 'Hand & Wrist', recruiting: true },
              { name: null, specialty: 'Foot & Ankle', recruiting: true },
              { name: null, specialty: 'Tumor & Oncology', recruiting: true },
            ].map((member) => (
              <div key={member.specialty} className="bg-white border border-border rounded-xl p-6 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${member.recruiting ? 'bg-cream' : 'bg-peach/20'}`}>
                  <svg className={`w-5 h-5 ${member.recruiting ? 'text-brown' : 'text-brown'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  {member.recruiting ? (
                    <p className="text-sm font-medium text-brown italic">Recruiting</p>
                  ) : (
                    <p className="text-sm font-semibold text-ink">{member.name}</p>
                  )}
                  <p className="text-xs text-brown mt-0.5">Associate Editor · {member.specialty}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Join the board CTA */}
        <div className="bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 text-center">
          <span className="section-label">Get Involved</span>
          <h2 className="section-heading mb-2">Join Our Editorial Board</h2>
          <p className="text-ink text-sm mb-6 max-w-xl mx-auto">
            We are building an editorial board of practicing orthopedic surgeons across all subspecialties. Board members contribute to the mission of providing fast, fair, high-quality peer review for early-career surgeons.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/contact" className="btn-primary-light">Express Interest</Link>
            <Link href="/about" className="btn-outline">Learn More About OSCRSJ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
