import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Accessibility Statement',
  description: 'OSCRSJ accessibility commitment and WCAG 2.1 AA compliance information.',
}

export default function AccessibilityPage() {
  return (
    <div>
      <PageHeader
        label="Accessibility"
        title="Accessibility Statement"
        subtitle="Our commitment to making OSCRSJ accessible to all readers and authors."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <section className="mb-12">
          <span className="section-label">Our Commitment</span>
          <h2 className="section-heading mb-4">Accessibility at OSCRSJ</h2>
          <p className="text-brown-dark leading-relaxed mb-4">
            The Orthopedic Surgery Case Reports & Series Journal (OSCRSJ) is committed to ensuring that our website and published content are accessible to all users, including people with disabilities. We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA.
          </p>
          <p className="text-brown-dark leading-relaxed">
            We believe that access to scientific knowledge should not be limited by disability. As an open-access journal, we are dedicated to removing barriers to reading, submitting, and reviewing orthopedic research.
          </p>
        </section>

        <section className="mb-12">
          <span className="section-label">Standards</span>
          <h2 className="section-heading mb-6">What We Do</h2>
          <div className="space-y-3">
            {[
              { title: 'Color contrast', desc: 'We maintain a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text, meeting WCAG AA requirements.' },
              { title: 'Keyboard navigation', desc: 'All interactive elements are accessible via keyboard. Users can navigate the site without a mouse.' },
              { title: 'Semantic HTML', desc: 'We use proper heading hierarchy, landmarks, and ARIA labels to support screen readers and assistive technologies.' },
              { title: 'Responsive design', desc: 'The site adapts to all screen sizes and supports text resizing up to 200% without loss of content or functionality.' },
              { title: 'Alternative text', desc: 'All meaningful images include descriptive alt text. Decorative images are hidden from assistive technologies.' },
              { title: 'Readable typography', desc: 'We use a minimum 16px base font size, 1.5+ line height, and high-legibility typefaces (Inter and DM Serif Display).' },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 bg-cream border border-border rounded-xl p-6">
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

        <section className="mb-12">
          <span className="section-label">Feedback</span>
          <h2 className="section-heading mb-4">Report an Accessibility Issue</h2>
          <p className="text-brown-dark leading-relaxed mb-4">
            We welcome feedback on the accessibility of OSCRSJ. If you encounter any barriers or have suggestions for improvement, please contact us:
          </p>
          <div className="bg-cream-alt border border-border rounded-xl p-6">
            <p className="text-sm text-brown-dark mb-1"><strong>Email:</strong> accessibility@oscrsj.com</p>
            <p className="text-sm text-brown-dark"><strong>Response time:</strong> We aim to respond to accessibility feedback within 5 business days.</p>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/contact" className="btn-primary">Contact Us</Link>
          <Link href="/about" className="btn-outline">About OSCRSJ</Link>
        </div>
      </div>
    </div>
  )
}
