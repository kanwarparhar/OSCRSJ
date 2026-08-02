import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  APC_DISPLAY_WITH_CURRENCY,
  APC_EFFECTIVE_DATE_LABEL,
  APC_GRANDFATHER_NOTE,
  APC_PAYMENT_TERMS_DAYS,
  APC_AGREEMENT_VERSION,
} from '@/lib/apc/config'

export const metadata: Metadata = {
  title: 'Author Publication Agreement',
  description:
    `The terms every corresponding author accepts when submitting to OSCRSJ — the ${APC_DISPLAY_WITH_CURRENCY} article processing charge payable on acceptance, CC BY 4.0 licensing, author warranties, consent and ethics obligations, withdrawal and refund policy.`,
  alternates: { canonical: 'https://www.oscrsj.com/publication-agreement' },
  openGraph: {
    title: 'Author Publication Agreement | OSCRSJ',
    description:
      `The terms every corresponding author accepts when submitting to OSCRSJ, including the ${APC_DISPLAY_WITH_CURRENCY} article processing charge payable on acceptance.`,
    url: 'https://www.oscrsj.com/publication-agreement',
    type: 'website',
  },
}

interface Clause {
  n: string
  heading: string
  body: string[]
  bullets?: string[]
}

const CLAUSES: Clause[] = [
  {
    n: '1',
    heading: 'What this agreement covers',
    body: [
      'This Author Publication Agreement governs the relationship between the Orthopedic Surgery Case Reports & Series Journal (OSCRSJ, "the Journal") and the authors of any manuscript submitted to it. The corresponding author accepts these terms on behalf of all co-authors at the point of submission, and confirms they are authorized to do so.',
      'These terms sit alongside our Editorial Policies, Open Access Policy, and Terms of Service. Where a conflict arises on a question of fees, licensing, or author obligations, this agreement governs.',
    ],
  },
  {
    n: '2',
    heading: 'Article processing charge',
    body: [
      `OSCRSJ charges a single article processing charge (APC) of ${APC_DISPLAY_WITH_CURRENCY} per accepted manuscript. The charge became effective ${APC_EFFECTIVE_DATE_LABEL}.`,
      'The APC is the Journal’s only author-facing charge. There is no submission fee, no page charge, no colour figure charge, no supplementary material charge, and no surcharge for length, revisions, or number of authors.',
    ],
    bullets: [
      'The charge applies once per accepted manuscript, whatever the number of authors.',
      'Nothing is payable at submission. The charge is invoiced only after a formal decision of acceptance.',
      'Rejected manuscripts incur no charge. Manuscripts withdrawn before an acceptance decision incur no charge.',
      'Revisions are not charged separately. A manuscript that goes through two rounds of revision pays the same single charge as one accepted on first review.',
      'Liability for the charge rests with the corresponding author, who may direct the invoice to an institution, department, or grant.',
    ],
  },
  {
    n: '3',
    heading: 'What the charge pays for',
    body: [
      'OSCRSJ receives no subscription revenue and charges readers nothing. The APC funds the work that turns an accepted manuscript into a permanent, discoverable piece of literature:',
    ],
    bullets: [
      'Editorial handling, plagiarism screening, and coordination of double-blind peer review',
      'Copy-editing, typesetting, and production of the final article in HTML, PDF, and JATS XML',
      'DOI registration and metadata deposit with Crossref',
      'Submission to and maintenance of indexing and discovery services',
      'Hosting, and long-term digital preservation of the published record',
    ],
  },
  {
    n: '4',
    heading: 'Payment terms',
    body: [
      `Following acceptance, the corresponding author receives an invoice by email. Payment is due within ${APC_PAYMENT_TERMS_DAYS} days of the invoice date. Payment is accepted by credit or debit card through Stripe; an itemized invoice suitable for institutional or grant reimbursement is provided in every case.`,
      'The charge is stated and payable in US dollars. Any bank, card-issuer, or currency-conversion fees are the payer’s responsibility. Where sales tax, VAT, or equivalent applies, it is calculated at the prevailing rate and shown separately on the invoice.',
      'Production of the final article begins on receipt of payment. An article is not published while its invoice is outstanding. If an invoice remains unpaid without contact after repeated reminders, the Journal may rescind the acceptance and release the manuscript, leaving the authors free to submit it elsewhere.',
    ],
  },
  {
    n: '5',
    heading: 'Editorial decisions are independent of payment',
    body: [
      'Peer reviewers and handling editors are not told whether an author has paid or been invoiced. Acceptance is decided on scientific merit alone. No member of the editorial team receives any share of APC revenue, and no decision — acceptance, revision, or rejection — is influenced by an author’s ability or willingness to pay.',
      'Fee administration is handled separately from editorial decision-making, and only begins after a decision has been issued.',
    ],
  },
  {
    n: '6',
    heading: 'No waivers or discounts',
    body: [
      'OSCRSJ does not operate a waiver or discount scheme. There are no institutional agreements, no membership rates, and no case-by-case reductions. Every accepted manuscript pays the same charge.',
      'The charge is set deliberately low, well below the typical open-access rate in orthopedic publishing, so that a single predictable figure works for authors without requiring a negotiation. Applying one rate uniformly also removes any possibility that a fee decision could reach, or appear to reach, the editorial process.',
    ],
  },
  {
    n: '7',
    heading: 'Withdrawal and refunds',
    body: [
      'Authors may withdraw a manuscript at any point before acceptance at no cost. Withdrawal after acceptance but before publication does not cancel the charge, since the editorial and review work has already been performed; the Journal may waive it at its discretion where the reason is compelling.',
      'Once an article is published, the APC is non-refundable. The exceptions are narrow: a duplicate or erroneous charge is refunded in full, and where an article is retracted because of an error attributable to the Journal rather than to the authors, the APC is refunded in full.',
      'Retraction for author misconduct — including fabrication, plagiarism, undisclosed duplicate publication, or falsified consent — does not entitle the authors to a refund.',
    ],
  },
  {
    n: '8',
    heading: 'Licensing and copyright',
    body: [
      'Authors retain copyright in their work. OSCRSJ does not require a transfer of copyright.',
      'On acceptance, authors grant OSCRSJ a non-exclusive, irrevocable, worldwide license to publish, reproduce, distribute, and archive the article, and to deposit it with indexing services and preservation archives.',
      'All articles are published under a Creative Commons Attribution 4.0 International (CC BY 4.0) license. Anyone may read, download, copy, distribute, adapt, and build upon the article — including commercially — provided the original authors and source are credited and any changes are indicated. This license is irrevocable once the article is published.',
    ],
  },
  {
    n: '9',
    heading: 'Author warranties',
    body: [
      'By submitting, the corresponding author warrants on behalf of all authors that:',
    ],
    bullets: [
      'The manuscript is the authors’ original work and has not been published previously, in whole or in substantial part.',
      'The manuscript is not under consideration by, and will not be submitted to, another journal while under review at OSCRSJ.',
      'The work contains nothing defamatory, unlawful, or infringing of any copyright, trademark, privacy right, or other right of a third party.',
      'Written permission has been obtained for any figure, table, or extended quotation reproduced from a copyrighted source, and that permission is available on request.',
      'All data, images, and findings presented are genuine; no image has been manipulated in a way that misrepresents the underlying observation.',
      'Any use of AI writing or image tools has been disclosed at submission, and the authors accept full responsibility for the accuracy and integrity of all content regardless of how it was drafted.',
    ],
  },
  {
    n: '10',
    heading: 'Authorship',
    body: [
      'Every listed author must meet all four ICMJE authorship criteria, and every person who meets them must be listed. The corresponding author confirms that all co-authors have seen and approved the submitted version, agree to its submission to OSCRSJ, and accept these terms.',
      'Requests to add, remove, or reorder authors after submission require written agreement from every author, including the one being added or removed, together with a written explanation to the editorial office. Authorship changes are not accepted after publication except by formal correction notice.',
    ],
  },
  {
    n: '11',
    heading: 'Patient consent, ethics, and privacy',
    body: [
      'Written informed consent for publication is required for every case-based submission, obtained from the patient, or from a legal guardian or next of kin where the patient is a minor, deceased, or lacks capacity. Where a formal Institutional Review Board waiver of consent applies, the granting institution and protocol number must be stated in the manuscript.',
      'Authors must remove all direct identifiers from text, images, and radiographs. Do not upload signed consent forms unless the editor asks for them; the Journal does not wish to hold identifiable patient documents.',
      'The Journal may decline to publish, or may retract after publication, any article where consent or ethical approval cannot be evidenced on request.',
    ],
  },
  {
    n: '12',
    heading: 'Corrections and retractions after publication',
    body: [
      'The published version of record is permanent. Errors are addressed through a linked correction, expression of concern, or retraction notice, following COPE guidance. The original article is never silently altered or removed.',
      'Authors are expected to cooperate promptly with any post-publication inquiry into the integrity of their work.',
    ],
  },
  {
    n: '13',
    heading: 'Changes to these terms',
    body: [
      `The fee that applies to a manuscript is the fee published on the date it was first submitted. A later increase never applies retroactively to a manuscript already under review. ${APC_GRANDFATHER_NOTE}`,
      'OSCRSJ may revise this agreement for future submissions. Each version carries a version stamp, and the version an author accepted is recorded with their submission.',
    ],
  },
  {
    n: '14',
    heading: 'Liability',
    body: [
      'Views expressed in published articles are the authors’ own. OSCRSJ does not warrant the clinical accuracy of published content, which is offered for educational purposes and does not constitute medical advice. To the fullest extent permitted by law, the Journal’s aggregate liability to the authors under this agreement is limited to the amount of the article processing charge actually paid.',
    ],
  },
  {
    n: '15',
    heading: 'Governing law',
    body: [
      'This agreement is governed by the laws of the United States. Disputes arising under it are subject to the jurisdiction of the appropriate courts of the United States. Before initiating any formal proceeding, both parties agree to attempt resolution in good faith through direct correspondence with the editorial office.',
    ],
  },
]

export default function PublicationAgreementPage() {
  return (
    <div>
      <PageHeader
        label="For Authors"
        title="Author Publication Agreement"
        subtitle={`The terms every corresponding author accepts at submission, including the ${APC_DISPLAY_WITH_CURRENCY} article processing charge payable only if the manuscript is accepted.`}
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* At-a-glance summary */}
        <div className="bg-brown-dark text-cream rounded-xl p-6 sm:p-8 mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-peach mb-3">
            The short version
          </p>
          <ul className="space-y-2.5 text-sm text-cream/90 leading-relaxed">
            {[
              `Submitting is free. If your manuscript is accepted, the corresponding author pays a one-time ${APC_DISPLAY_WITH_CURRENCY} article processing charge.`,
              'Rejected or withdrawn before acceptance means you pay nothing at all.',
              'You keep copyright. Your article is published open access under CC BY 4.0.',
              'Reviewers and editors never see payment status. Acceptance is decided on merit.',
              'One flat rate for everyone — no waivers, discounts, or institutional schemes.',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="text-peach mt-0.5 flex-shrink-0">&rarr;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-brown mb-10">
          Version {APC_AGREEMENT_VERSION} &middot; In effect from {APC_EFFECTIVE_DATE_LABEL}
        </p>

        <div className="space-y-11 text-sm leading-relaxed">
          {CLAUSES.map((c) => (
            <section key={c.n} id={`clause-${c.n}`} className="scroll-mt-24">
              <span className="section-label">Clause {c.n}</span>
              <h2 className="section-heading mb-3">{c.heading}</h2>
              {c.body.map((p, i) => (
                <p key={i} className="text-ink mb-3 last:mb-0">
                  {p}
                </p>
              ))}
              {c.bullets && (
                <ul className="space-y-2 pl-4 mt-3">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                      <span className="text-ink">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section>
            <span className="section-label">Questions</span>
            <h2 className="section-heading mb-3">Contact</h2>
            <p className="text-ink">
              Questions about the article processing charge or an invoice go to{' '}
              <a href="mailto:info@oscrsj.com" className="text-brown hover:text-brown transition-colors font-medium">info@oscrsj.com</a>.
              Questions about the agreement itself go to{' '}
              <a href="mailto:legal@oscrsj.com" className="text-brown hover:text-brown transition-colors font-medium">legal@oscrsj.com</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link href="/apc" className="btn-outline">APC &amp; Fees</Link>
          <Link href="/editorial-policies" className="btn-outline">Editorial Policies</Link>
          <Link href="/open-access" className="btn-outline">Open Access Policy</Link>
          <Link href="/terms" className="btn-outline">Terms of Service</Link>
        </div>
      </div>
    </div>
  )
}
