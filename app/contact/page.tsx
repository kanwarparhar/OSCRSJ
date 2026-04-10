import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contact' }

const contacts = [
  {
    label: 'General Inquiries',
    email: 'info@oscrsj.com',
    desc: 'Questions about the journal, policies, or general information.',
  },
  {
    label: 'Manuscript Submission',
    email: 'submit@oscrsj.com',
    desc: 'Submit your manuscript or follow up on an existing submission.',
  },
  {
    label: 'Editorial Board',
    email: 'editorial@oscrsj.com',
    desc: 'Interest in joining the editorial board or peer reviewing.',
  },
  {
    label: 'APC Waivers',
    email: 'waivers@oscrsj.com',
    desc: 'Waiver or discount requests with supporting documentation.',
  },
]

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Contact Us</h1>
        <p className="text-charcoal-muted mt-2">
          We aim to respond to all inquiries within 2 business days.
        </p>
      </div>

      {/* Contact cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {contacts.map((c) => (
          <a
            key={c.label}
            href={`mailto:${c.email}`}
            className="bg-white border border-border rounded-xl p-5 hover:border-coral/50 hover:shadow-sm transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-coral/10 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5">
                <svg className="w-4.5 h-4.5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-charcoal text-sm group-hover:text-coral transition-colors">{c.label}</p>
                <p className="text-xs text-coral mt-0.5">{c.email}</p>
                <p className="text-xs text-charcoal-muted mt-1.5">{c.desc}</p>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Contact form */}
      <div className="bg-white border border-border rounded-2xl p-8">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-6">Send a Message</h2>
        <form className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-charcoal-muted mb-1.5">First Name</label>
              <input type="text" className="w-full text-sm px-4 py-2.5 bg-sand border border-border rounded-lg focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30" placeholder="Kanwar" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal-muted mb-1.5">Last Name</label>
              <input type="text" className="w-full text-sm px-4 py-2.5 bg-sand border border-border rounded-lg focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30" placeholder="Parhar" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-charcoal-muted mb-1.5">Email</label>
            <input type="email" className="w-full text-sm px-4 py-2.5 bg-sand border border-border rounded-lg focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30" placeholder="your@email.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-charcoal-muted mb-1.5">Subject</label>
            <select className="w-full text-sm px-4 py-2.5 bg-sand border border-border rounded-lg focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30 text-charcoal-muted">
              <option>General Inquiry</option>
              <option>Manuscript Submission</option>
              <option>Editorial Board Interest</option>
              <option>APC Waiver Request</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-charcoal-muted mb-1.5">Message</label>
            <textarea rows={5} className="w-full text-sm px-4 py-2.5 bg-sand border border-border rounded-lg focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30 resize-none" placeholder="How can we help?" />
          </div>
          <button type="submit" className="btn-primary w-full justify-center">
            Send Message
          </button>
        </form>
      </div>
    </div>
  )
}
