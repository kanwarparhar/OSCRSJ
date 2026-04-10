import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Register — OSCRSJ' }

export default function RegisterPage() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Register</h1>
        <p className="text-charcoal-muted mt-2 text-lg">
          Create your OSCRSJ author account
        </p>
      </div>

      <section className="mb-8 bg-gradient-to-br from-coral/10 to-sand border border-coral/20 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Registration Opening Soon</h2>
        <p className="text-charcoal-muted leading-relaxed mb-4">
          Our author and reviewer registration portal is under development. Once live, you will be able to create a profile, submit manuscripts online, and track the status of your submissions through every stage of peer review.
        </p>
        <p className="text-charcoal-muted leading-relaxed">
          Want to be notified when registration opens? Subscribe to our mailing list below.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5 text-center">What You'll Get</h2>
        <div className="space-y-3">
          {[
            { title: 'Author Dashboard', desc: 'Track your submissions from initial upload through peer review to final publication.' },
            { title: 'Reviewer Access', desc: 'Registered orthopedic surgeons can join our reviewer pool and manage assigned reviews.' },
            { title: 'Profile Page', desc: 'Your published articles, ORCID link, and institutional affiliation in one place.' },
            { title: 'Email Notifications', desc: 'Real-time updates on submission status, editorial decisions, and publication.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 bg-white border border-border rounded-xl p-5">
              <svg className="w-5 h-5 text-coral mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-charcoal text-sm">{item.title}</p>
                <p className="text-sm text-charcoal-muted mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 items-center">
        <Link href="/subscribe" className="btn-primary">Subscribe for Updates</Link>
        <div className="text-sm text-charcoal-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-coral hover:text-coral-dark transition-colors font-medium">
            Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
