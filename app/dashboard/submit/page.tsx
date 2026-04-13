import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'New Submission — OSCRSJ' }

export default function SubmitPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-brown-dark">Submit a Manuscript</h1>
        <p className="text-sm text-tan mt-1">
          Our 5-step submission wizard is being finalized. It will be available in your dashboard shortly.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl p-8 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-cream-alt rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-tan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h2 className="font-serif text-xl text-brown-dark mb-2">Coming Soon</h2>
        <p className="text-sm text-tan mb-6">
          The manuscript submission wizard will walk you through uploading your files, entering metadata, adding co-authors, and completing required declarations.
        </p>
        <p className="text-sm text-tan mb-4">
          In the meantime, you can submit your manuscript by email:
        </p>
        <a href="mailto:submit@oscrsj.com" className="text-brown font-semibold hover:underline">
          submit@oscrsj.com
        </a>

        <div className="mt-6 pt-4 border-t border-border">
          <Link href="/guide-for-authors" className="text-sm text-brown hover:underline">
            Review the Guide for Authors before submitting &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
