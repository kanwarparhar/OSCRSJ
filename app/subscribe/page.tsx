import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Subscribe — OSCRSJ' }

export default function SubscribePage() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Subscribe</h1>
        <p className="text-tan mt-2 text-lg">
          Stay updated on new articles, journal news, and calls for submissions
        </p>
      </div>

      <section className="mb-8 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-5 text-center">What Subscribers Receive</h2>
        <div className="space-y-3">
          {[
            { title: 'New Issue Alerts', desc: 'Be the first to know when a new issue is published, with article highlights and direct links.' },
            { title: 'Call for Submissions', desc: 'Special topic calls, deadline reminders, and submission tips for trainees.' },
            { title: 'Journal Updates', desc: 'Milestones like PubMed indexing progress, editorial board additions, and APC policy changes.' },
            { title: 'Author Resources', desc: 'Writing tips, peer review insights, and guides for early-career researchers.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
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

      <section className="mb-8 bg-cream border border-border rounded-xl p-6">
        <h3 className="font-semibold text-brown-dark mb-4 text-center">Join Our Mailing List</h3>
        <form className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-tan mb-1">Full Name</label>
            <input
              type="text"
              id="name"
              placeholder="Dr. Jane Smith"
              className="w-full text-sm px-4 py-2.5 bg-cream-alt border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 placeholder:text-taupe transition"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-tan mb-1">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="jane.smith@hospital.edu"
              className="w-full text-sm px-4 py-2.5 bg-cream-alt border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 placeholder:text-taupe transition"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-tan mb-1">Role (optional)</label>
            <select
              id="role"
              className="w-full text-sm px-4 py-2.5 bg-cream-alt border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 text-tan transition"
            >
              <option value="">Select your role</option>
              <option value="medical-student">Medical Student</option>
              <option value="resident">Resident</option>
              <option value="fellow">Fellow</option>
              <option value="attending">Attending Physician</option>
              <option value="researcher">Researcher</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">
            Subscribe
          </button>
        </form>
        <p className="text-xs text-taupe text-center mt-3">
          We respect your privacy. Unsubscribe at any time. No spam, ever.
        </p>
      </section>

      <div className="text-center">
        <Link href="/articles" className="text-sm text-brown hover:text-brown transition-colors font-medium">
          Browse current articles &rarr;
        </Link>
      </div>
    </div>
  )
}
