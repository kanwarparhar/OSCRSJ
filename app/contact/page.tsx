import type { Metadata } from 'next'
import PageHeader from '@/components/PageHeader'

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
    <div>
      <PageHeader
        label="Get in Touch"
        title="Contact Us"
        subtitle="We aim to respond to all inquiries within 2 business days."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Contact cards */}
        <section className="mb-12">
          <span className="section-label">Departments</span>
          <h2 className="section-heading mb-4">Reach the Right Team</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {contacts.map((c) => (
              <a
                key={c.label}
                href={`mailto:${c.email}`}
                className="bg-cream border border-border rounded-xl p-6 hover:border-peach/50 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-tan/20 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5">
                    <svg className="w-4.5 h-4.5 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-brown-dark text-sm group-hover:text-brown transition-colors">{c.label}</p>
                    <p className="text-xs text-brown mt-0.5">{c.email}</p>
                    <p className="text-xs text-tan mt-1.5">{c.desc}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Contact form */}
        <div className="bg-cream border border-border rounded-2xl p-8">
          <span className="section-label">Message</span>
          <h2 className="section-heading mb-6">Send a Message</h2>
          <form className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-tan mb-1.5">First Name</label>
                <input type="text" className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40" placeholder="Kanwar" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-tan mb-1.5">Last Name</label>
                <input type="text" className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40" placeholder="Parhar" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-tan mb-1.5">Email</label>
              <input type="email" className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40" placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-tan mb-1.5">Subject</label>
              <select className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 text-tan">
                <option>General Inquiry</option>
                <option>Manuscript Submission</option>
                <option>Editorial Board Interest</option>
                <option>APC Waiver Request</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-tan mb-1.5">Message</label>
              <textarea rows={5} className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 resize-none" placeholder="How can we help?" />
            </div>
            <button type="submit" className="btn-primary-light w-full justify-center">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
