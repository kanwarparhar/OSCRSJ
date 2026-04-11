import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy Policy — OSCRSJ' }

export default function PrivacyPage() {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Privacy Policy</h1>
        <p className="text-tan mt-2 text-lg">
          Last updated: April 2026
        </p>
      </div>

      <div className="space-y-8 text-sm text-tan leading-relaxed">

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Overview</h2>
          <p>
            The Orthopedic Surgery Case Reports & Series Journal ("OSCRSJ", "we", "us", or "our") is committed to protecting the privacy of our authors, reviewers, readers, and website visitors. This Privacy Policy explains how we collect, use, and safeguard your personal information when you interact with our website at oscrsj.com and our associated services.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Information We Collect</h2>
          <p className="mb-3">We may collect the following types of information:</p>
          <div className="space-y-3">
            {[
              { title: 'Contact Information', desc: 'Name, email address, institutional affiliation, and professional role — provided when you submit a manuscript, register for an account, subscribe to our mailing list, or contact us.' },
              { title: 'Submission Data', desc: 'Manuscript files, cover letters, reviewer comments, and correspondence related to the peer review process.' },
              { title: 'Usage Data', desc: 'Anonymous analytics including pages visited, time on site, referral source, and device type. We use this data to improve the website experience.' },
              { title: 'Cookies', desc: 'We use essential cookies for site functionality. We do not use advertising cookies or third-party tracking cookies.' },
            ].map((item) => (
              <div key={item.title} className="bg-cream border border-border rounded-xl p-5">
                <p className="font-semibold text-brown-dark text-sm">{item.title}</p>
                <p className="text-sm text-tan mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">How We Use Your Information</h2>
          <ul className="space-y-2 pl-4">
            {[
              'To process and manage manuscript submissions and peer review',
              'To communicate with authors, reviewers, and editorial board members',
              'To send journal updates and newsletters to subscribers (opt-in only)',
              'To improve website functionality and user experience',
              'To comply with legal obligations and protect against misuse',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Data Sharing</h2>
          <p>
            We do not sell, rent, or trade your personal information to third parties. We may share limited data with trusted service providers who assist in operating our website, processing submissions, or sending email communications — but only to the extent necessary for those services. All service providers are required to maintain confidentiality.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Data Retention</h2>
          <p>
            We retain personal information for as long as necessary to fulfill the purposes described in this policy. Submission records and published article metadata are retained indefinitely as part of the permanent scholarly record. You may request deletion of your account and associated personal data by contacting us at the email below.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Your Rights</h2>
          <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="space-y-2 pl-4">
            {[
              'Access the personal data we hold about you',
              'Request correction of inaccurate data',
              'Request deletion of your personal data (subject to legal retention requirements)',
              'Opt out of marketing communications at any time',
              'Lodge a complaint with a data protection authority',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Security</h2>
          <p>
            We implement reasonable technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date. We encourage you to review this policy periodically.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your personal data, please contact us at{' '}
            <a href="mailto:privacy@oscrsj.com" className="text-brown hover:text-brown transition-colors font-medium">privacy@oscrsj.com</a>.
          </p>
        </section>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-3">
        <Link href="/terms" className="btn-outline">Terms of Use</Link>
        <Link href="/contact" className="btn-outline">Contact Us</Link>
      </div>
    </div>
  )
}
