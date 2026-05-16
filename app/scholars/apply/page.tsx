import type { Metadata } from 'next'
import PageHeader from '@/components/PageHeader'
import ApplyForm from './ApplyForm'

export const metadata: Metadata = {
  title: 'Apply — OSCRSJ Research Scholars',
  description:
    'Apply to join the OSCRSJ Research Scholars program — a structured research-training program for pre-med students, medical students, and IMG candidates.',
  alternates: { canonical: 'https://www.oscrsj.com/scholars/apply' },
  openGraph: {
    title: 'Apply — OSCRSJ Research Scholars',
    description:
      'Apply to join the OSCRSJ Research Scholars program — structured research training and mentorship for pre-med, medical student, and IMG candidates.',
    url: 'https://www.oscrsj.com/scholars/apply',
    type: 'website',
  },
}

export default function ScholarsApplyPage() {
  return (
    <div>
      <PageHeader
        label="Research Scholars"
        title="Apply to the Program"
        subtitle="Tell us about yourself, pick a track, and share your research goals. We review every application carefully."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white border border-border rounded-xl p-6 mb-8">
          <h2 className="font-serif text-lg text-brown-dark mb-2">
            What to expect
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-ink leading-relaxed">
            <li>
              We review every application and reply within 2-3 weeks. We may
              reach out for a short conversation before deciding.
            </li>
            <li>
              Publication of any work produced in the program is conditional
              on independent peer review through OSCRSJ&apos;s standard
              editorial pipeline — the program promises training, mentorship,
              and structured projects, never publication itself.
            </li>
            <li>
              You will be asked to acknowledge our AI-use policy and
              participant agreement before submitting. These document what
              we provide and what we don&apos;t promise.
            </li>
          </ul>
        </div>

        <ApplyForm />
      </div>
    </div>
  )
}
