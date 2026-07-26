import type { Metadata } from 'next'
import Link from 'next/link'
import { FORMATTING_RETENTION_DAYS } from '@/lib/formatting/pipeline/retention'
import {
  STUDIO_FREE_RUNS,
  STUDIO_FREE_UNTIL_LABEL,
  STUDIO_MAX_RESETS,
  STUDIO_QUOTA_WINDOW_DAYS,
  STUDIO_QUOTA_WINDOW_LABEL,
} from '@/lib/studio/quotaConstants'
import {
  MARKETING_CHECKBOX_DETAIL,
  MARKETING_CHECKBOX_LABEL,
  MARKETING_CONSENT_VERSION,
  STUDIO_TERMS_EFFECTIVE,
  STUDIO_TERMS_PATH,
  STUDIO_TERMS_TITLE,
  STUDIO_TERMS_VERSION,
} from '@/lib/studio/terms'
import FormatterMotion from '../../_components/FormatterMotion'
import { StudioFooter, StudioNav } from '../../_components/StudioChrome'
import { studioBreadcrumb, studioMetadata } from '../../_seo'

/**
 * Submission Studio Terms and Conditions (Kanwar directive, 2026-07-26).
 *
 * This page is the OTHER HALF of the required tick box defined in
 * lib/studio/terms.ts. The box says "I agree"; this says what to. So:
 *
 *   1. EVERY NUMBER IS IMPORTED. The run allowance, the length of the rolling
 *      window, the reset cap, the free-until date and the file-retention window
 *      are read from the modules that enforce them (lib/studio/quota.ts,
 *      lib/formatting/pipeline/retention.ts). A Terms page that promises three
 *      runs while the gate hands out two is a worse defect than a wrong number
 *      in marketing copy, and the only way to make that unrepresentable is to
 *      never type the number here. The same applies to the words "7" and
 *      "week": STUDIO_QUOTA_WINDOW_DAYS and STUDIO_QUOTA_WINDOW_LABEL, always.
 *   2. THE VERSION AND EFFECTIVE DATE ARE RENDERED FROM lib/studio/terms.ts and
 *      shown at the top and the bottom. The stored acceptance record points at
 *      a version string; that string has to be legible on the page it names.
 *   3. TWO BOXES. Terms acceptance is required; marketing consent is a
 *      separate, optional, unticked box. Section 3 therefore DESCRIBES the
 *      mailing list so a user can decide about the optional box, and says
 *      plainly that declining costs them nothing. See the long note at the top
 *      of lib/studio/terms.ts for why bundling the two is not an option.
 *   4. Section 4 discloses DeepSeek. It is accurate to the pipeline as built
 *      (lib/formatting/pipeline/extract.ts, lib/formatting/references/parse.ts,
 *      lib/finder/assess.ts) and is deliberately NOT loosened into "your
 *      manuscript is never shared with anyone", which is the overclaim the note
 *      at the top of app/(formatter)/_copy.ts exists to police.
 *
 * House rules from _copy.ts apply to every user-facing string below: no
 * em-dashes, no "beta" framing, plain declarative sentences.
 */

export const metadata: Metadata = studioMetadata({
  title: `${STUDIO_TERMS_TITLE} | Submission Studio by OSCRSJ`,
  description: `The terms you agree to when you use Submission Studio: ${STUDIO_FREE_RUNS} free runs per email address per ${STUDIO_QUOTA_WINDOW_LABEL}, what we email you and only if you ask for it, who processes your manuscript, how long files are kept, and what happens to pricing after ${STUDIO_FREE_UNTIL_LABEL}.`,
  path: STUDIO_TERMS_PATH,
  social: `What you agree to when you use Submission Studio: the free-run allowance, the optional mailing list, file retention, and the move to paid after ${STUDIO_FREE_UNTIL_LABEL}.`,
})

/** Reads as English at 1 and stays true if the cap ever moves. */
const RESET_PHRASE = STUDIO_MAX_RESETS === 1 ? 'once' : `${STUDIO_MAX_RESETS} times`

const SHORT_VERSION = [
  `Submission Studio formats your manuscript and suggests journals. Using it is not a submission to OSCRSJ, it is not peer review, and it gives OSCRSJ no claim over your work.`,
  `You get ${STUDIO_FREE_RUNS} completed runs per email address per ${STUDIO_QUOTA_WINDOW_LABEL}, shared across the formatter and the Journal Finder. Each run stops counting ${STUDIO_QUOTA_WINDOW_DAYS} days after it finishes, so the allowance refills as it goes. Runs that fail on our side do not count.`,
  `Out of runs? Wait for your oldest run to age out, or complete a short feedback survey to get all ${STUDIO_FREE_RUNS} back straight away. The survey works ${RESET_PHRASE} per address, ever. Waiting works every time.`,
  `Marketing email is a separate, optional tick box that starts unticked. Leaving it alone does not affect your access, your allowance, or your output. Ticking it puts you on the OSCRSJ mailing list, and every message has one-click unsubscribe.`,
  `Your files and outputs are deleted after ${FORMATTING_RETENTION_DAYS} days. Part of your manuscript text is sent to DeepSeek so a model can read its structure. We do not publish it, sell it, or train on it.`,
  `The Studio is free through ${STUDIO_FREE_UNTIL_LABEL} and paid after that. No card is required today and nothing auto-charges.`,
]

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ padding: '56px 0 0' }}>
      <div className="wrap" style={{ maxWidth: '820px' }}>
        <div className="rule-head">
          <span className="kicker">{kicker}</span>
        </div>
        <h2 className="reveal" style={{ fontSize: 'clamp(24px, 3vw, 30px)' }}>
          {title}
        </h2>
        <div
          className="reveal"
          style={{
            marginTop: '20px',
            display: 'grid',
            gap: '16px',
            fontSize: '16.5px',
            lineHeight: 1.7,
            color: 'var(--fmt-ink)',
          }}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

export default function StudioTermsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            studioBreadcrumb([{ name: 'Terms and Conditions', path: STUDIO_TERMS_PATH }]),
          ),
        }}
      />
      <FormatterMotion />
      <StudioNav />

      {/* ---------- HEAD + THE SHORT VERSION ---------- */}
      <section style={{ paddingBottom: 0 }}>
        <div className="wrap" style={{ maxWidth: '820px' }}>
          <div className="rule-head">
            <span className="kicker">Legal</span>
            <span
              style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--fmt-ink-3)' }}
            >
              Version {STUDIO_TERMS_VERSION} · effective {STUDIO_TERMS_EFFECTIVE}
            </span>
          </div>
          <h1 className="reveal" style={{ fontSize: 'clamp(36px, 5vw, 58px)' }}>
            {STUDIO_TERMS_TITLE}
          </h1>
          <p className="sub reveal" style={{ marginTop: '18px', maxWidth: '70ch' }}>
            These Terms cover Submission Studio: the manuscript formatter and the Journal Finder at
            oscrsj.com/studio. You agree to them by ticking the box on the form before a run. They
            sit alongside the OSCRSJ{' '}
            <Link href="/terms" style={{ color: 'var(--fmt-accent)' }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" style={{ color: 'var(--fmt-accent)' }}>
              Privacy Policy
            </Link>
            , which also apply.
          </p>

          <div className="card reveal" style={{ marginTop: '40px', padding: '26px 28px' }}>
            <h2 style={{ fontSize: '21px', marginBottom: '4px' }}>The short version</h2>
            <p style={{ fontSize: '13px', color: 'var(--fmt-ink-3)', marginBottom: '16px' }}>
              A summary, not the agreement. The numbered sections below are the agreement.
            </p>
            <ul style={{ display: 'grid', gap: '11px', margin: 0, padding: 0, listStyle: 'none' }}>
              {SHORT_VERSION.map((line) => (
                <li
                  key={line}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                    fontSize: '15.5px',
                    lineHeight: 1.6,
                    color: 'var(--fmt-ink-2)',
                  }}
                >
                  <span style={{ color: 'var(--fmt-accent)', flexShrink: 0 }}>&rarr;</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- 1. SCOPE ---------- */}
      <Section kicker="Scope" title="1. What Submission Studio is, and what it is not">
        <p>
          Submission Studio is two free tools published by OSCRSJ. The formatter takes a Word
          manuscript you upload and applies a target journal&apos;s published formatting
          requirements to it. The Journal Finder reads a manuscript and suggests journals it fits.
          That is the whole of the service.
        </p>
        <p>
          Using the Studio is <strong>not a submission to OSCRSJ</strong>. It is not peer review,
          and nothing it produces is an editorial opinion about your work. It creates no
          relationship between you and the journal you format for, and it gives OSCRSJ no claim over
          your manuscript and no visibility into where you send it. Formatting here for a journal
          that competes with ours is expected and permitted. That is what the tool is for.
        </p>
        <p>
          The Studio does not guarantee acceptance anywhere. A journal can reject a perfectly
          formatted manuscript for reasons that have nothing to do with its formatting.
        </p>
      </Section>

      {/* ---------- 2. FREE USE AND RUN LIMITS ---------- */}
      <Section kicker="Free use" title="2. Free use and run limits">
        <p>
          Each email address gets{' '}
          <strong>
            {STUDIO_FREE_RUNS} completed runs per {STUDIO_QUOTA_WINDOW_LABEL}
          </strong>
          . The allowance is shared across the formatter and the Journal Finder assessment.
        </p>
        <p>
          The {STUDIO_QUOTA_WINDOW_LABEL} is a rolling one, not a calendar one. A completed run
          counts against your allowance for {STUDIO_QUOTA_WINDOW_DAYS} days from the moment it
          finishes, and then it stops counting. Runs age out one at a time, so the allowance refills
          continuously rather than all at once on a reset day. There is no reset day.
        </p>
        <p>
          A run counts once our pipeline finishes it. A run that fails on our side does not count
          against your allowance. A job that has neither finished nor failed holds a slot while it
          is genuinely running, and releases it once it is clearly abandoned.
        </p>
        <p>
          When the allowance is spent you have two ways forward and both are fine. You can wait:
          your oldest run ages out {STUDIO_QUOTA_WINDOW_DAYS} days after it finished, and that slot
          comes back on its own. Or you can complete the feedback survey at{' '}
          <Link href="/studio/unlock" style={{ color: 'var(--fmt-accent)' }}>
            /studio/unlock
          </Link>{' '}
          and get a full allowance of {STUDIO_FREE_RUNS} runs back immediately. The survey is a
          shortcut past the wait, not the only way back, and it works {RESET_PHRASE} per address,
          ever. Waiting costs you nothing and works every time.
        </p>
        <p>
          Accounts operated by OSCRSJ are not subject to the allowance. We may change, reduce, or
          withdraw the free allowance at any time.
        </p>
      </Section>

      {/* ---------- 3. EMAIL ---------- */}
      <Section kicker="Your email" title="3. Your email address, and what we send you">
        <p>
          An email address and your agreement to these Terms are required to use the Studio. That is
          the whole of what is required. <strong>Marketing email is a separate, optional choice</strong>{' '}
          and it is not a condition of anything.
        </p>
        <p>
          Your address is used for three things that are not marketing, whether or not you opt in.
          It is how the allowance in section 2 is counted, it is how abuse of a free tool is rate
          limited, and it is how you retrieve a job that is still in progress if you come back to it
          later.
        </p>
        <p>
          There is a second tick box on the form, below the one for these Terms. It starts unticked
          and it reads: &ldquo;{MARKETING_CHECKBOX_LABEL}&rdquo; Ticking it is the only thing that
          adds your address to the OSCRSJ mailing list.
        </p>
        <p>{MARKETING_CHECKBOX_DETAIL}</p>
        <p>
          Leaving that box unticked costs you nothing, and we are not permitted to make it cost you
          anything. It does not reduce your allowance, slow your run, limit which journals you can
          format for, or change your output. You get the same Studio either way.
        </p>
        <p>
          We do not sell or rent your address, and we do not hand it to anyone else for their own
          marketing. Every email we send carries a one-click unsubscribe. Unsubscribing takes you
          off the list and does nothing else: it does not remove your access to the Studio, and it
          does not affect the runs you have left.
        </p>
        <p>
          When you tick the Terms box, we record which version of these Terms you accepted and the
          time you accepted it. If you tick the marketing box, we separately record which version of
          that wording you consented to, currently {MARKETING_CONSENT_VERSION}, and when. Those two
          records are the only thing that can answer, later, exactly what was agreed.
        </p>
      </Section>

      {/* ---------- 4. MANUSCRIPT ---------- */}
      <Section kicker="Your manuscript" title="4. Your manuscript: ownership, confidentiality, and retention">
        <p>
          You keep every right in your manuscript that you had before you uploaded it. OSCRSJ claims
          nothing: no copyright, no licence to publish, no right of first refusal, no authorship
          credit.
        </p>
        <p>
          We do not publish your manuscript, index it, share it with another author or with any
          journal, or sell it. We do not train models on it.
        </p>
        <p>
          Your uploaded files and the outputs generated from them are deleted from our storage{' '}
          {FORMATTING_RETENTION_DAYS} days after the job ends. Download links are signed and expire
          about an hour after a job finishes. The job record itself, meaning the email address,
          target journal, status and timings, is kept as our audit trail; the files are not.
        </p>
        <p>
          Part of the work is done by a third-party language model, and you should know that before
          you upload. Text from your manuscript is sent to DeepSeek&apos;s API so a model can read
          its structure: for the formatter, the front matter and the reference list; for the Journal
          Finder, a truncated read of the manuscript used to build the assessment. The model
          identifies which lines are the title, the authors, the affiliations and the references. It
          does not write, paraphrase, or alter your prose, and the formatting itself is applied by
          deterministic code.
        </p>
        <p>
          The commitments above are OSCRSJ&apos;s own, and we keep them. We are not in a position to
          make promises on DeepSeek&apos;s behalf, so we do not make any. If you are holding work
          that cannot be sent to a third-party API at all, do not upload it here.
        </p>
      </Section>

      {/* ---------- 5. SURVEY ---------- */}
      <Section kicker="Survey" title="5. Survey responses">
        <p>
          The unlock survey asks who you are, which tools you used, how useful the output was, what
          came out wrong, which journal you were looking for, the single thing we should fix next,
          and what you would pay. No question asks anything about the content of your manuscript.
        </p>
        <p>
          Your answers are stored against your email address, together with the survey version, the
          time of submission, and how long the form took. We read and analyse them to decide what to
          fix and what to build.
        </p>
        <p>
          Free-text answers may be quoted inside OSCRSJ, in full and unedited, when we are deciding
          what to work on. Blunt answers are the point of the survey.
        </p>
        <p>
          We will not publish your response attached to your name or your email address. If survey
          feedback is ever quoted publicly, it will be stripped of anything that identifies who sent
          it. We will only email you about your answers if you ticked the follow-up box.
        </p>
      </Section>

      {/* ---------- 6. NO WARRANTY ---------- */}
      <Section kicker="No warranty" title="6. No warranty, and verify the output">
        <p>
          Submission Studio is provided free of charge, as is and as available, without warranties
          of any kind, express or implied. We do not warrant that it will be uninterrupted or error
          free, or that its output will satisfy any particular journal.
        </p>
        <p>
          The output is a starting point, not a submission-ready guarantee. Journal requirements
          change without notice. Our rules are encoded from each journal&apos;s own published Guide
          for Authors and are accurate as of the verification date shown on that journal&apos;s
          card, which is not the same as today.
        </p>
        <p>
          Checking your manuscript against the journal&apos;s current Guide for Authors before you
          submit remains your responsibility. You are the author, and you are the one the editor
          writes back to.
        </p>
        <p>
          To the fullest extent permitted by law, OSCRSJ is not liable for a rejection, a
          desk-reject, a delay, or a formatting error that reaches a publisher, nor for any
          indirect, incidental, or consequential loss arising from your use of the Studio.
        </p>
      </Section>

      {/* ---------- 7. PRICING ---------- */}
      <Section kicker="Pricing" title="7. Pricing after the free period">
        <p>
          Submission Studio is free to use through <strong>{STUDIO_FREE_UNTIL_LABEL}</strong>. After
          that date it becomes a paid product.
        </p>
        <p>
          No payment card is required today. Nothing here auto-charges, and there is no trial that
          converts into a subscription. When paid plans arrive, you will have to choose one
          yourself. We will not move anyone onto a paid plan on their behalf.
        </p>
        <p>
          We are telling you the price is coming before you use the tool rather than after, because
          the alternative is a free tool that quietly turns into a bill.
        </p>
      </Section>

      {/* ---------- 8. CHANGES ---------- */}
      <Section kicker="Changes" title="8. Changes to these Terms">
        <p>
          These Terms are version-stamped. The current version is{' '}
          <strong>{STUDIO_TERMS_VERSION}</strong>, effective{' '}
          <strong>{STUDIO_TERMS_EFFECTIVE}</strong>.
        </p>
        <p>
          The wording of a published version is never edited in place. Any change to what these
          Terms say produces a new version with a new date, and a material change is presented for
          acceptance the next time you use the Studio. Your acceptance is recorded against the
          version you actually saw, so an old acceptance is never silently upgraded to cover new
          wording.
        </p>
      </Section>

      {/* ---------- 9. CONTACT ---------- */}
      <Section kicker="Contact" title="9. Contact">
        <p>
          Questions about these Terms, requests to remove your address, and anything else about the
          Studio go to{' '}
          <a href="mailto:oscrsjournal@gmail.com" style={{ color: 'var(--fmt-accent)' }}>
            oscrsjournal@gmail.com
          </a>
          . That is the journal&apos;s working inbox and a person reads it.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
          <Link className="btn btn-primary" href="/studio">
            Back to Submission Studio
          </Link>
          <Link className="btn btn-secondary" href="/privacy">
            Privacy Policy
          </Link>
        </div>

        <div className="srcs" style={{ marginTop: '40px' }}>
          {STUDIO_TERMS_TITLE} · version {STUDIO_TERMS_VERSION} · effective{' '}
          {STUDIO_TERMS_EFFECTIVE}
        </div>
      </Section>

      <div style={{ height: '96px' }} />
      <StudioFooter />
    </>
  )
}
