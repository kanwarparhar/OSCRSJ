'use client'

import Link from 'next/link'
import {
  APC_DISPLAY,
  APC_DISPLAY_WITH_CURRENCY,
  APC_CURRENCY,
  APC_PAYMENT_TERMS_DAYS,
  APC_AGREEMENT_CLAUSE_LIST,
  APC_AGREEMENT_VERSION,
} from '@/lib/apc/config'

interface Step6AgreementProps {
  apcFeeAcknowledged: boolean
  apcLicenseAcknowledged: boolean
  apcWarrantiesAcknowledged: boolean
  onChange: (updates: Record<string, unknown>) => void
  /**
   * Revisions do not re-contract. The agreement accepted on the
   * original submission carries over, and no second charge arises
   * from a revision, so this step becomes read-only confirmation.
   */
  isRevising?: boolean
}

const CHECKBOX_KEYS = {
  fee: 'apcFeeAcknowledged',
  license: 'apcLicenseAcknowledged',
  warranties: 'apcWarrantiesAcknowledged',
} as const

export default function Step6Agreement({
  apcFeeAcknowledged,
  apcLicenseAcknowledged,
  apcWarrantiesAcknowledged,
  onChange,
  isRevising,
}: Step6AgreementProps) {
  const checkedFor = {
    fee: apcFeeAcknowledged,
    license: apcLicenseAcknowledged,
    warranties: apcWarrantiesAcknowledged,
  }

  if (isRevising) {
    return (
      <div>
        <h2 className="font-serif text-xl text-brown-dark mb-1">Publication Agreement</h2>
        <p className="text-sm text-brown mb-6">
          Nothing to accept here for a revision.
        </p>
        <div className="bg-cream-alt border border-border rounded-lg p-5">
          <p className="text-sm text-ink leading-relaxed">
            The Author Publication Agreement you accepted on the original
            submission carries over to this revision. Revisions are never
            charged separately &mdash; the article processing charge applies
            once per accepted manuscript, however many rounds of review it
            goes through.
          </p>
          <p className="text-sm text-ink leading-relaxed mt-3">
            You can re-read the terms at any time on the{' '}
            <Link href="/publication-agreement" target="_blank" className="text-brown underline hover:text-brown">
              Author Publication Agreement
            </Link>{' '}
            page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">Publication Agreement</h2>
      <p className="text-sm text-brown mb-6">
        Please read and accept the terms below. All three are required before
        you can submit.
      </p>

      {/* Fee summary panel */}
      <div className="bg-brown-dark text-cream rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="font-semibold text-cream text-base mb-2">
              Article Processing Charge
            </p>
            <ul className="space-y-1.5 text-sm text-cream/85 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-peach mt-0.5 flex-shrink-0">&rarr;</span>
                <span>Submitting is free. Nothing is charged now.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-peach mt-0.5 flex-shrink-0">&rarr;</span>
                <span>If your manuscript is rejected, or you withdraw it before a decision, you pay nothing.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-peach mt-0.5 flex-shrink-0">&rarr;</span>
                <span>
                  If it is accepted, the corresponding author is invoiced{' '}
                  {APC_DISPLAY_WITH_CURRENCY}, due within {APC_PAYMENT_TERMS_DAYS} days.
                  You may direct the invoice to an institution or grant.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-peach mt-0.5 flex-shrink-0">&rarr;</span>
                <span>One charge per accepted manuscript &mdash; not per author, not per revision round.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-peach mt-0.5 flex-shrink-0">&rarr;</span>
                <span>Your reviewers and handling editor are never told your payment status.</span>
              </li>
            </ul>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="font-serif text-4xl font-bold text-cream leading-none">{APC_DISPLAY}</p>
            <p className="text-xs text-cream/70 mt-1.5">{APC_CURRENCY} on acceptance</p>
          </div>
        </div>
      </div>

      {/* Single-rate disclosure */}
      <div className="bg-cream-alt border border-border rounded-lg p-4 mb-6">
        <p className="text-sm text-ink leading-relaxed">
          This is a single flat rate. OSCRSJ does not operate waivers,
          discounts, institutional agreements, or membership schemes &mdash;
          every accepted manuscript pays the same charge. Full terms are on the{' '}
          <Link href="/apc" target="_blank" className="text-brown underline hover:text-brown">
            APC &amp; Fees
          </Link>{' '}
          page.
        </p>
      </div>

      {/* The three required acknowledgements */}
      <div className="space-y-3 mb-6">
        {APC_AGREEMENT_CLAUSE_LIST.map((clause) => (
          <label
            key={clause.key}
            className={`flex items-start gap-3 cursor-pointer p-4 border rounded-lg transition-colors ${
              checkedFor[clause.key]
                ? 'border-brown/40 bg-cream-alt/60'
                : 'border-border hover:bg-cream-alt/40'
            }`}
          >
            <input
              type="checkbox"
              checked={checkedFor[clause.key]}
              onChange={(e) =>
                onChange({ [CHECKBOX_KEYS[clause.key]]: e.target.checked })
              }
              className="mt-0.5 accent-brown w-4 h-4 shrink-0"
            />
            <span className="text-sm text-ink leading-relaxed">
              <span className="block font-semibold text-ink mb-1">
                {clause.label} <span className="text-red-500">*</span>
              </span>
              {clause.text}
            </span>
          </label>
        ))}
      </div>

      <p className="text-xs text-brown leading-relaxed">
        These three statements summarise the binding terms. The full text,
        including withdrawal and refund policy, corrections and retractions,
        and the guarantee that a later price change never applies to a
        manuscript already under review, is in the{' '}
        <Link href="/publication-agreement" target="_blank" className="text-brown underline hover:text-brown">
          Author Publication Agreement
        </Link>{' '}
        (version {APC_AGREEMENT_VERSION}). Your acceptance is recorded against
        this submission with a timestamp, the agreement version, and the fee
        quoted above.
      </p>
    </div>
  )
}
