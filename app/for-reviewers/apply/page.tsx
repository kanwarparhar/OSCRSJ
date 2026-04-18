import type { Metadata } from 'next'
import PageHeader from '@/components/PageHeader'
import ApplyForm from './ApplyForm'

export const metadata: Metadata = {
  title: 'Apply to Review — OSCRSJ',
  description:
    'Apply to join the OSCRSJ reviewer pool. Medical students, residents, fellows, and attending orthopedic surgeons are welcome to review case reports and series.',
}

export default function ApplyPage() {
  return (
    <div>
      <PageHeader
        label="For Reviewers"
        title="Apply to Review"
        subtitle="Join the OSCRSJ reviewer pool. We welcome medical students, residents, fellows, and attending orthopedic surgeons."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white border border-border rounded-xl p-6 mb-8">
          <h2 className="font-serif text-lg text-brown-dark mb-2">
            What to expect
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-ink leading-relaxed">
            <li>
              Applications are reviewed by the editorial office, usually within
              14 days.
            </li>
            <li>
              Accepted reviewers are invited to review manuscripts matched to
              their subspecialty interests. Typical turnaround is three weeks
              per review.
            </li>
            <li>
              Reviewer contributions are recognised annually and count toward
              the ACGME peer review scholarly activity requirement.
            </li>
          </ul>
        </div>

        <ApplyForm />
      </div>
    </div>
  )
}
