import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  BOARD_MEMBERS,
  buildEditorialBoardSchema,
} from '@/lib/schema/editorialBoard'

export const metadata: Metadata = { title: 'Editorial Board' }

export default function EditorialBoardPage() {
  const personSchema = buildEditorialBoardSchema(BOARD_MEMBERS)

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <PageHeader
        label="Our Team"
        title="Editorial Board"
        subtitle="OSCRSJ is guided by an editorial board of practicing orthopedic surgeons and researchers committed to rigorous, fair peer review."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Seal — anchors the Est. MMXXVI mood for the board page */}
        <section className="mb-12 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/seal-cream.svg"
            alt="OSCRSJ journal seal — est. MMXXVI"
            width={200}
            height={200}
            className="w-[160px] h-[160px] md:w-[200px] md:h-[200px]"
          />
        </section>

        {/* Editor-in-Chief */}
        <section className="mb-12">
          <span className="section-label">Leadership</span>
          <h2 className="section-heading mb-4">Editor-in-Chief</h2>
          <div className="bg-white border border-border rounded-xl p-6 flex items-start gap-5">
            <div className="w-14 h-14 rounded-full bg-peach/20 flex-shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-ink">Madhan Jeyaraman, MBBS, MS, MBA, PhD</p>
              <p className="text-sm text-brown mt-0.5">Editor-in-Chief · OSCRSJ</p>
              <p className="text-sm text-ink mt-2">
                Professor of Orthopaedics, Dr. MGR Educational and Research Institute, Chennai. Leads OSCRSJ&apos;s editorial direction with an emphasis on rigorous methodology, scholarly quality, and substantive review.
              </p>
            </div>
          </div>
        </section>

        {/* Founding Editor */}
        <section className="mb-12">
          <span className="section-label">Leadership</span>
          <h2 className="section-heading mb-4">Founding Editor</h2>
          <div className="bg-white border border-border rounded-xl p-6 flex items-start gap-5">
            <div className="w-14 h-14 rounded-full bg-peach/20 flex-shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-ink">Kanwar Parhar, MD</p>
              <p className="text-sm text-brown mt-0.5">Founding Editor · OSCRSJ</p>
              <p className="text-sm text-ink mt-2">
                Founded OSCRSJ in 2026 to give early-career orthopedic surgeons a rigorous, fast, and genuinely supportive venue for case reports and case series. Oversees editorial operations, journal development, and day-to-day management during the launch phase.
              </p>
            </div>
          </div>
        </section>

        {/* Section Editors */}
        <section className="mb-12">
          <span className="section-label">Subspecialty Leadership</span>
          <h2 className="section-heading mb-4">Section Editors</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { name: 'Nathaniel Schaffer, MD', specialty: 'Trauma' },
              { name: 'Miguel A. Schmitz, MD', specialty: 'Spine' },
              { name: 'Bill K. Huang, MD', specialty: 'Adult Reconstruction' },
              { name: 'Sukhman Singh, MBBS, MS', specialty: 'Foot & Ankle' },
              { name: 'Dheeraj Makkar, MBBS, MS', specialty: 'Sports Medicine' },
            ].map((member) => (
              <div key={member.specialty} className="bg-white border border-border rounded-xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-peach/20 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-5 h-5 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{member.name}</p>
                  <p className="text-xs text-brown mt-0.5">Section Editor · {member.specialty}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Associate Editors */}
        <section className="mb-12">
          <span className="section-label">Editorial Team</span>
          <h2 className="section-heading mb-4">Associate Editors</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { name: 'Vikash, MBBS, MS' },
              { name: 'Abhijit Jayan, MBBS, MS' },
              { name: 'Damarla Meghana, MBBS, MS' },
            ].map((member) => (
              <div key={member.name} className="bg-white border border-border rounded-xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-peach/20 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-5 h-5 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{member.name}</p>
                  <p className="text-xs text-brown mt-0.5">Associate Editor</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Review Editor */}
        <section className="mb-12">
          <span className="section-label">Editorial Team</span>
          <h2 className="section-heading mb-4">Review Editor</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-border rounded-xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-peach/20 flex-shrink-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Manvir Kaur, MS</p>
                <p className="text-xs text-brown mt-0.5">Review Editor</p>
              </div>
            </div>
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
