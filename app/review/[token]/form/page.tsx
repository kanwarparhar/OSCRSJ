import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ReviewInvitationRow,
  ReviewRow,
} from '@/lib/types/database'
import ReviewSubmissionForm from './ReviewSubmissionForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Structured review — OSCRSJ',
  robots: { index: false, follow: false },
}

const INVITATION_EXPIRY_DAYS = 60

const TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

function isExpired(invitedDate: string): boolean {
  try {
    const invited = new Date(invitedDate).getTime()
    return Date.now() - invited > INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export default async function ReviewFormPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams?: { submitted?: string }
}) {
  const admin = createAdminClient()
  const { data: invData } = await admin
    .from('review_invitations')
    .select('*')
    .eq('review_token', params.token)
    .maybeSingle()

  const invitation = (invData as ReviewInvitationRow | null) || null

  if (!invitation) {
    return (
      <StaticMessage
        heading="This review link is invalid"
        body="We could not locate the invitation associated with this link. If you received it from the OSCRSJ editorial office and believe this is a mistake, please reply to the original email."
      />
    )
  }

  if (invitation.status === 'cancelled') {
    return (
      <StaticMessage
        heading="This invitation has been cancelled"
        body="The manuscript this invitation referred to is no longer under review. No further action is needed."
      />
    )
  }

  if (invitation.status === 'declined') {
    return (
      <StaticMessage
        heading="You have already declined this invitation"
        body="If you would like to reconsider, please reply to the original invitation email and the editorial office can reopen the invitation."
      />
    )
  }

  if (invitation.status === 'invited') {
    return (
      <StaticMessage
        heading="Please accept the invitation first"
        body="You have not yet accepted the invitation to review this manuscript. Please accept it before opening the structured review form."
        linkHref={`/review/${params.token}`}
        linkLabel="Go to invitation"
      />
    )
  }

  if (invitation.status === 'submitted' || searchParams?.submitted === '1') {
    return (
      <StaticMessage
        heading="Your review has been submitted"
        body="Thank you for your review. The editor will consider your feedback alongside the other reviewers' submissions. You will typically hear back within about two weeks as the decision is finalised. If any of the details need to be corrected, reply to the confirmation email."
      />
    )
  }

  if (isExpired(invitation.invited_date)) {
    return (
      <StaticMessage
        heading="This invitation has expired"
        body="Invitations are active for 60 days. Please contact the editorial office if you still wish to review this manuscript."
      />
    )
  }

  // invitation.status === 'accepted' — render the form.

  const { data: mData } = await admin
    .from('manuscripts')
    .select('title, abstract, manuscript_type, subspecialty')
    .eq('id', invitation.manuscript_id)
    .maybeSingle()
  const manuscript = (mData as Partial<ManuscriptRow> | null) || null

  // Load any existing draft for this invitation.
  const { data: rData } = await admin
    .from('reviews')
    .select('*')
    .eq('review_invitation_id', invitation.id)
    .maybeSingle()
  const existingReview = (rData as ReviewRow | null) || null

  const firstName = invitation.reviewer_first_name || 'Reviewer'
  const reviewerName = [
    invitation.reviewer_first_name,
    invitation.reviewer_last_name,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-border rounded-xl p-8 space-y-4">
          <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
            OSCRSJ Editorial Office
          </p>
          <h1 className="font-serif text-3xl text-brown-dark">
            Structured review
          </h1>
          <p className="text-sm text-ink">
            Thank you, {reviewerName || firstName}. Please complete all six
            ratings, your recommendation, and your comments below. Authors
            will not see your identity; your comments to the editor stay
            confidential.
          </p>

          <div className="border border-border rounded-lg bg-cream/40 p-4 text-sm space-y-2">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-brown">
                Manuscript
              </p>
              <p className="font-serif text-lg text-brown-dark leading-snug">
                {manuscript?.title || '(untitled manuscript)'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-brown">
                  Type
                </p>
                <p className="text-ink">
                  {TYPE_LABELS[manuscript?.manuscript_type || ''] ||
                    manuscript?.manuscript_type ||
                    '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-brown">
                  Subspecialty
                </p>
                <p className="text-ink">{manuscript?.subspecialty || '—'}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-brown">
            Need to re-read the manuscript?{' '}
            <Link
              href={`/review/${params.token}/manuscript`}
              className="underline hover:text-ink"
            >
              Download the blinded manuscript and figures.
            </Link>
          </p>
        </div>

        <ReviewSubmissionForm
          token={params.token}
          existingReview={existingReview}
        />
      </div>
    </div>
  )
}

function StaticMessage({
  heading,
  body,
  linkHref,
  linkLabel,
}: {
  heading: string
  body: string
  linkHref?: string
  linkLabel?: string
}) {
  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-xl mx-auto bg-white border border-border rounded-xl p-8 space-y-4">
        <p className="text-[11px] uppercase tracking-widest text-brown">
          OSCRSJ Editorial Office
        </p>
        <h1 className="font-serif text-2xl text-brown-dark">{heading}</h1>
        <p className="text-sm text-ink leading-relaxed">{body}</p>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="inline-block text-sm text-brown underline hover:text-ink"
          >
            {linkLabel}
          </Link>
        )}
        <p className="text-xs text-brown pt-4 border-t border-border">
          Questions? Reply to the original invitation email.
        </p>
      </div>
    </div>
  )
}
