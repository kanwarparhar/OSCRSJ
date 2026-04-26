import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Terms of Use — OSCRSJ' }

export default function TermsPage() {
  return (
    <div>
      <PageHeader
        label="Legal"
        title="Terms of Service"
        subtitle="Last updated: April 2026"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="space-y-12 text-sm leading-relaxed">

          <section>
            <span className="section-label">Agreement</span>
            <h2 className="section-heading mb-3">Acceptance of Terms</h2>
            <p className="text-ink">
              By accessing and using the OSCRSJ website (oscrsj.com), you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use our website or services. OSCRSJ reserves the right to modify these terms at any time. Continued use of the site constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <span className="section-label">Identity</span>
            <h2 className="section-heading mb-3">About OSCRSJ</h2>
            <p className="text-ink">
              The Orthopedic Surgery Case Reports & Series Journal (OSCRSJ) is an independent, peer-reviewed, open-access medical journal based in the United States. We publish case reports and case series in orthopedic surgery. The journal is not affiliated with any commercial publisher, hospital, or university.
            </p>
          </section>

          <section>
            <span className="section-label">Intellectual Property</span>
            <h2 className="section-heading mb-3">Copyright & Licensing</h2>
            <p className="text-ink mb-3">
              All articles published in OSCRSJ are licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License (CC BY-NC-ND 4.0). This means:
            </p>
            <ul className="space-y-2 pl-4 mb-3">
              {[
                'Authors retain copyright of their published work',
                'Anyone may read, download, and share published articles for non-commercial purposes',
                'Proper attribution to the original authors must be given',
                'Commercial use of the article is not permitted without the authors’ written permission',
                'The article may not be remixed, transformed, or built upon (no derivative works)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-ink">
              The OSCRSJ name, logo, and website design are the property of OSCRSJ and may not be reproduced without permission.
            </p>
          </section>

          <section>
            <span className="section-label">Author Obligations</span>
            <h2 className="section-heading mb-3">Submissions & Peer Review</h2>
            <p className="text-ink mb-3">
              By submitting a manuscript to OSCRSJ, authors agree to the following:
            </p>
            <ul className="space-y-2 pl-4">
              {[
                'The manuscript is original and has not been published elsewhere',
                'The manuscript is not under consideration by another journal',
                'All authors have read and approved the final manuscript',
                'Appropriate patient consent and ethical approvals have been obtained',
                'Upon acceptance, the article will be published under CC BY-NC-ND 4.0',
                'Article processing charges (APCs) will be paid according to the current fee schedule',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <span className="section-label">Clinical Disclaimer</span>
            <h2 className="section-heading mb-3">Medical Disclaimer</h2>
            <p className="text-ink">
              Content published in OSCRSJ is intended for educational and informational purposes only. It does not constitute medical advice, diagnosis, or treatment recommendations. Clinical decisions should be based on individual patient assessment by qualified healthcare professionals. OSCRSJ, its editors, authors, and reviewers accept no liability for clinical outcomes resulting from the use of information published in this journal.
            </p>
          </section>

          <section>
            <span className="section-label">Acceptable Use</span>
            <h2 className="section-heading mb-3">Website Use</h2>
            <p className="text-ink mb-3">When using the OSCRSJ website, you agree not to:</p>
            <ul className="space-y-2 pl-4">
              {[
                'Use the site for any unlawful purpose',
                'Attempt to gain unauthorized access to any part of the site or its systems',
                'Interfere with the proper functioning of the website',
                'Scrape, harvest, or collect information from the site without permission',
                'Misrepresent your identity or affiliation',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brown mt-1 flex-shrink-0">&#10005;</span>
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <span className="section-label">Legal Limits</span>
            <h2 className="section-heading mb-3">Limitation of Liability</h2>
            <p className="text-ink">
              OSCRSJ provides this website and its content on an "as is" basis. We make no warranties, express or implied, regarding the accuracy, completeness, or reliability of any content. To the fullest extent permitted by law, OSCRSJ shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the website or reliance on its content.
            </p>
          </section>

          <section>
            <span className="section-label">Jurisdiction</span>
            <h2 className="section-heading mb-3">Governing Law</h2>
            <p className="text-ink">
              These Terms of Use are governed by and construed in accordance with the laws of the United States. Any disputes arising from these terms or your use of the OSCRSJ website shall be resolved in the appropriate courts of the United States.
            </p>
          </section>

          <section>
            <span className="section-label">Questions</span>
            <h2 className="section-heading mb-3">Contact</h2>
            <p className="text-ink">
              Questions about these Terms of Use may be directed to{' '}
              <a href="mailto:legal@oscrsj.com" className="text-brown hover:text-brown transition-colors font-medium">legal@oscrsj.com</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link href="/privacy" className="btn-outline">Privacy Policy</Link>
          <Link href="/contact" className="btn-outline">Contact Us</Link>
        </div>
      </div>
    </div>
  )
}
