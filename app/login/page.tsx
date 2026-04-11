import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Log In — OSCRSJ' }

export default function LoginPage() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Log In</h1>
        <p className="text-tan mt-2 text-lg">
          OSCRSJ Author & Reviewer Portal
        </p>
      </div>

      <section className="mb-8 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Submission Portal Coming Soon</h2>
        <p className="text-tan leading-relaxed mb-4">
          We are building a modern, AI-assisted submission and peer review portal. When it launches, you will be able to log in here to submit manuscripts, track review progress, and manage your author profile.
        </p>
        <p className="text-tan leading-relaxed">
          In the meantime, please submit your manuscript by email.
        </p>
      </section>

      <section className="mb-8 bg-cream border border-border rounded-xl p-6 text-center">
        <h3 className="font-semibold text-brown-dark mb-2">Submit by Email</h3>
        <p className="text-sm text-tan mb-3">
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
  )
}
