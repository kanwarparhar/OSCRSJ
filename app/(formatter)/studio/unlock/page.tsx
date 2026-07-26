import type { Metadata } from 'next'
import Link from 'next/link'
import {
  STUDIO_FREE_RUNS,
  STUDIO_FREE_UNTIL_LABEL,
  STUDIO_MAX_RESETS,
  STUDIO_QUOTA_WINDOW_DAYS,
  STUDIO_QUOTA_WINDOW_LABEL,
} from '@/lib/studio/quotaConstants'
import { SURVEY_ESTIMATED_MINUTES } from '@/lib/studio/survey'
import { STUDIO_TERMS_PATH } from '@/lib/studio/terms'
import FormatterMotion from '../../_components/FormatterMotion'
import { StudioFooter, StudioNav } from '../../_components/StudioChrome'
import { studioBreadcrumb, studioMetadata } from '../../_seo'
import UnlockClient from './UnlockClient'

/**
 * /studio/unlock -- the feedback survey that buys back a free-run allowance
 * (Kanwar directive, 2026-07-26).
 *
 * The commercial logic worth stating plainly, because it explains the copy:
 * the free period exists to buy feedback, not usage. Runs are the currency we
 * pay with. So this page is not a hoop, it is the checkout, and it is written
 * to make the trade obvious and fair rather than to extract a form fill.
 *
 * Three consequences visible in the markup below:
 *
 *   1. The terms of the trade are stated ABOVE the form, in full, including
 *      the two parts that weaken the sell: it works once, and it is no longer
 *      the only way back. Under the rolling allowance in quotaConstants.ts the
 *      runs return on their own, so what the survey actually sells is speed.
 *      Leaving that out would lift the completion rate and would be a lie the
 *      user finds out about the first time their runs reappear unprompted.
 *   2. It says what happens to the answers. People give better feedback when
 *      they believe it is read, and vaguer feedback when they suspect it is
 *      going into a dashboard nobody opens.
 *   3. It is still written as a transaction rather than as a favour asked of
 *      the user, because that is what it is. What it must not do is imply the
 *      user is stuck without it.
 *
 * Imported numbers only, same rule as the Terms page: a promise of three runs
 * on a page whose gate hands out two is a defect, and the way to make that
 * unrepresentable is to never type the number here.
 */

export const metadata: Metadata = studioMetadata({
  title: 'Unlock more free runs | Submission Studio by OSCRSJ',
  description: `Out of Submission Studio runs for this ${STUDIO_QUOTA_WINDOW_LABEL}? They come back on their own as they age out, or answer a ${SURVEY_ESTIMATED_MINUTES} minute feedback survey to get all ${STUDIO_FREE_RUNS} back now, once per email address.`,
  path: '/studio/unlock',
  social: `Tell us how Submission Studio did and get all ${STUDIO_FREE_RUNS} of your free runs back now instead of waiting for them.`,
})

const RESET_PHRASE = STUDIO_MAX_RESETS === 1 ? 'once' : `${STUDIO_MAX_RESETS} times`

const TRADE = [
  `You answer ${SURVEY_ESTIMATED_MINUTES} minutes of questions about what the Studio did and did not do for you.`,
  `Your allowance goes back to ${STUDIO_FREE_RUNS} completed runs immediately, shared across the formatter and the Journal Finder.`,
  `You do not have to do this. Runs age out ${STUDIO_QUOTA_WINDOW_DAYS} days after you use them, so the allowance comes back on its own whether you fill this in or not. What the survey saves you is the wait.`,
  `It works ${RESET_PHRASE} per email address. There is no second reset, so if you would rather keep it for a ${STUDIO_QUOTA_WINDOW_LABEL} when waiting is not an option, keep it.`,
]

export default function UnlockPage() {
  return (
    <>
      {/* Side-effect only: drives every .reveal on the page. Self-closing,
          same as every other Studio route. It is not a wrapper. */}
      <FormatterMotion />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            studioBreadcrumb([{ name: 'Unlock more runs', path: '/studio/unlock' }]),
          ),
        }}
      />
      <StudioNav />

      <section style={{ paddingTop: '58px' }}>
        <div className="wrap">
          <div className="rule-head reveal">
            <span className="kicker">Feedback</span>
          </div>
          <h1 className="reveal" style={{ fontSize: 'clamp(34px, 4.6vw, 54px)' }}>
            Unlock {STUDIO_FREE_RUNS} more free runs
          </h1>
          <p className="sub reveal" style={{ marginTop: '18px', maxWidth: '68ch' }}>
            Submission Studio is free, and the thing we need in return is not money. It is a
            straight answer about whether it actually worked. Your runs come back on their own{' '}
            {STUDIO_QUOTA_WINDOW_DAYS} days after you use them. Answer the questions and they come
            back now.
          </p>

          <div className="card reveal" style={{ marginTop: '36px', padding: '24px 26px' }}>
            <h2 style={{ fontSize: '19px', marginBottom: '14px' }}>The trade</h2>
            <ul style={{ display: 'grid', gap: '10px', margin: 0, padding: 0, listStyle: 'none' }}>
              {TRADE.map((line) => (
                <li
                  key={line}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                    fontSize: '15px',
                    lineHeight: 1.6,
                    color: 'var(--fmt-ink-2)',
                  }}
                >
                  <span style={{ color: 'var(--fmt-accent)', flexShrink: 0 }}>&rarr;</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p
              style={{
                marginTop: '16px',
                fontSize: '13.5px',
                lineHeight: 1.6,
                color: 'var(--fmt-ink-3)',
              }}
            >
              What happens to the answers: every one is read. The problems people report become the
              fix queue, and the journals people name get added. Nothing is published with your name
              or address attached. See the{' '}
              <Link href={STUDIO_TERMS_PATH} style={{ color: 'var(--fmt-accent)' }}>
                Studio Terms
              </Link>{' '}
              for how survey responses are handled.
            </p>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: '34px', paddingBottom: '20px' }}>
        <div className="wrap reveal">
          <UnlockClient />
        </div>
      </section>

      <section style={{ paddingBottom: '60px' }}>
        <div className="wrap reveal">
          <p className="srcs" style={{ maxWidth: '70ch' }}>
            The Studio is free through {STUDIO_FREE_UNTIL_LABEL}. After that it becomes paid. No card
            is required today and nothing auto-charges.
          </p>
        </div>
      </section>

      <StudioFooter />
    </>
  )
}
