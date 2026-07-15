import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import SocialIcon from '@/components/SocialIcon'
import { SOCIAL_CHANNELS } from '@/lib/social'

export const metadata: Metadata = {
  title: 'Official Channels',
  description:
    'Verified social and video channels for OSCRSJ — the Orthopedic Surgery Case Reports & Series Journal.',
  alternates: { canonical: 'https://www.oscrsj.com/media' },
  openGraph: {
    title: 'Official Channels | OSCRSJ',
    description:
      'Verified social and video channels for OSCRSJ — the Orthopedic Surgery Case Reports & Series Journal.',
    url: 'https://www.oscrsj.com/media',
    type: 'website',
  },
}

export default function MediaPage() {
  return (
    <div>
      <PageHeader
        label="Connect"
        title="Official Channels"
        subtitle="Follow OSCRSJ on our verified social and video channels for the latest published articles, announcements, and orthopedic education."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Official Channels */}
        <section className="mb-16">
          <span className="section-label">Official Channels</span>
          <h2 className="section-heading mb-2">Social &amp; Video</h2>
          <p className="text-ink leading-relaxed mb-6 max-w-3xl">
            These are the verified accounts for OSCRSJ. Use these handles when citing or
            referencing the journal.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {SOCIAL_CHANNELS.map(({ name, url, handle, ariaLabel }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="me noopener noreferrer"
                aria-label={ariaLabel}
                className="bg-white border border-border rounded-xl p-5 hover:border-tan hover:shadow-sm transition-all duration-200 group flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-full bg-tan/20 flex items-center justify-center text-brown mb-3 group-hover:bg-brown-dark group-hover:text-peach transition-colors">
                  <SocialIcon name={name} className="w-6 h-6" />
                </div>
                <p className="font-semibold text-ink text-sm">{name}</p>
                <p className="text-xs text-brown mt-1 font-mono">{handle}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section>
          <div className="bg-cream-alt rounded-2xl p-8 text-center">
            <span className="section-label">Get in Touch</span>
            <h2 className="section-heading mb-4">Questions for the Journal?</h2>
            <p className="text-ink leading-relaxed max-w-2xl mx-auto mb-6">
              For editorial, submission, or media inquiries, reach out to the editorial office.
            </p>
            <Link href="/contact" className="btn-primary-light">
              Contact the Editorial Office
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
