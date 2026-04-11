import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Terms of Use — OSCRSJ' }

export default function TermsPage() {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Terms of Use</h1>
        <p className="text-tan mt-2 text-lg">
          Last updated: April 2026
        </p>
      </div>

      <div className="space-y-8 text-sm text-tan leading-relaxed">

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Acceptance of Terms</h2>
          <p>
            By accessing and using the OSCRSJ website (oscrsj.com), you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use our website or services. OSCRSJ reserves the right to modify these terms at any time. Continued use of the site constitutes acceptance of any changes.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">About OSCRSJ</h2>
          <p>
            The Orthopedic Surgery Case Reports & Series Journal (OSCRSJ) is an independent, peer-reviewed, open-access medical journal based in the United States. We publish case reports and case series in orthopedic surgery. The journal is not affiliated with any commercial publisher, hospital, or university.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Copyright & Licensing</h2>
          <p className="mb-3">
            All articles published in OSCRSJ are licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0). This means:
          </p>
          <ul className="space-y-2 pl-4 mb-3">
            {[
              'Authors retain copyright of their published work',
              'Anyone may read, download, share, and adapt published articles',
              'Proper attribution to the original authors must be given',
              'Commercial use is permitted under CC BY 4.0',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p>
            The OSCRSJ name, logo, and website design are the property of OSCRSJ and may not be reproduced without permission.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Submissions & Peer Review</h2>
          <p className="mb-3">
            By submitting a manuscript to OSCRSJ, authors agree to the following:
          </p>
          <ul className="space-y-2 pl-4">
            {[
              'The manuscript is original and has not been published elsewhere',
              'The manuscript is not under consideration by another journal',
              'All authors have read and approved the final manuscript',
              'Appropriate patient consent and ethical approvals have been obtained',
              'Upon acceptance, the article will be published under CC BY 4.0',
              'Article processing charges (APCs) will be paid according to the current fee schedule',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Medical Disclaimer</h2>
          <p>
            Content published in OSCRSJ is intended for educational and informational purposes only. It does not constitute medical advice, diagnosis, or treatment recommendations. Clinical decisions should be based on individual patient assessment by qualified healthcare professionals. OSCRSJ, its editors, authors, and reviewers accept no liability for clinical outcomes resulting from the use of information published in this journal.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Website Use</h2>
          <p className="mb-3">When using the OSCRSJ website, you agree not to:</p>
          <ul className="space-y-2 pl-4">
            {[
              'Use the site for any unlawful purpose',
              'Attempt to gain unauthorized access to any part of the site or its systems',
              'Interfere with the proper functioning of the website',
              'Scrape, harvest, or collect information from the site without permission',
              'Misrepresent your identity or affiliation',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-taupe mt-1 flex-shrink-0">&#10005;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Limitation of Liability</h2>
          <p>
            OSCRSJ provides this website and its content on an "as is" basis. We make no warranties, express or implied, regarding the accuracy, completeness, or reliability of any content. To the fullest extent permitted by law, OSCRSJ shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the website or reliance on its content.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Governing Law</h2>
          <p>
            These Terms of Use are governed by and construed in accordance with the laws of the United States. Any disputes arising from these terms or your use of the OSCRSJ website shall be resolved in the appropriate courts of the United States.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Contact</h2>
          <p>
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
  )
}
