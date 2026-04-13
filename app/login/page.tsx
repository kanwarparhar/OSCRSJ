import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Log In — OSCRSJ' }

export default function LoginPage() {
  return (
    <div>
      <PageHeader
        label="Author Portal"
        title="Sign In"
        subtitle="OSCRSJ Author & Reviewer Portal"
      />

      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <section className="mb-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <span className="section-label">Status</span>
          <h2 className="section-heading mb-3">Submission Portal Coming Soon</h2>
          <p className="text-brown-dark leading-relaxed mb-4">
            We are building a modern, AI-assisted submission and peer review portal. When it launches, you will be able to log in here to submit manuscripts, track review progress, and manage your author profile.
          </p>
          <p className="text-brown-dark leading-relaxed">
            In the meantime, please submit your manuscript by email.
          </p>
        </section>

        <section className="mb-12 bg-white border border-border rounded-xl p-6 text-center">
          <h3 className="font-semibold text-brown-dark mb-2">Submit by Email</h3>
          <p className="text-sm text-brown-dark mb-3">
            Send your manuscript, cover letter, and supplementary files to:
          </p>
          <a href="mailto:submit@oscrsj.com" className="text-brown font-semibold hover:text-brown transition-colors">
            submit@oscrsj.com
          </a>
        </section>

        <div className="text-center text-sm text-tan">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-brown hover:text-brown transition-colors font-medium">
            Register here
          </Link>
        </div>
      </div>
    </div>
  )
}
