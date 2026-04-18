import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ReviewInvitationRow,
} from '@/lib/types/database'
import ReviewResponseForm from './ReviewResponseForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reviewer invitation — OSCRSJ',
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

export default async function ReviewInvitationPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams?: { action?: string; status?: string }
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
        heading="This invitation link is invalid"
        body="We could not locate the invitation associated with this link. If you received it from the OSCRSJ editorial office and believe this is a mistake, please reply to the original email."
      />
    )
  }

  const justResponded = searchParams?.status
  if (justResponded === 'accepted') {
    return (
      <StaticMessage
        heading="Thank you for accepting"
        body="Your acceptance has been recorded. A member of the editorial office will follow up shortly with the full manuscript, the reviewer guidelines, and the structured review form."
      />
    )
  }
  if (justResponded === 'declined') {
    return (
      <StaticMessage
        heading="Your response has been recorded"
        body="Thank you for letting us know. The editorial office has been notified and will invite another reviewer."
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

  if (
    invitation.status === 'accepted' ||
    invitation.status === 'declined' ||
    invitation.status === 'submitted'
  ) {
    return (
      <StaticMessage
        heading="This invitation has already been answered"
        body={`Your prior response ("${invitation.status}") was recorded on ${
          invitation.response_date
            ? new Date(invitation.response_date).toLocaleDateString()
            : 'file'
        }. If you need to change it, reply to the original invitation email and the editorial office will adjust the record.`}
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

  // Fetch manuscript teaser (title, type, subspecialty, abstract only — no authors per double-blind)
  const { data: mData } = await admin
    .from('manuscripts')
    .select('title, abstract, manuscript_type, subspecialty')
    .eq('id', invitation.manuscript_id)
    .maybeSingle()
  const manuscript = (mData as Partial<ManuscriptRow> | null) || null

  const firstName = invitation.reviewer_first_name || 'Reviewer'
  const reviewerName = [
    invitation.reviewer_first_name,
    invitation.reviewer_last_name,
  ]
    .filter(Boolean)
    .join(' ')
  const prefilledAction = searchParams?.action
  const prefilled =
    prefilledAction === 'accept' || prefilledAction === 'decline'
      ? prefilledAction
      : null

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white border border-border rounded-xl p-8 space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
            OSCRSJ Editorial Office
          </p>
          <h1 className="font-serif text-3xl text-brown-dark">
            Invitation to review
          </h1>
        </div>

        <p className="text-sm text-brown-dark">
          Hello {reviewerName || firstName}, you have been invited to peer
          review the manuscript below. Your identity will be kept confidential
          from the authors; the manuscript’s authors and affiliations are
          hidden until you accept.
        </p>

        <dl className="border border-border rounded-lg bg-cream/40 p-4 text-sm space-y-2">
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-brown">
              Manuscript
            </dt>
            <dd className="font-serif text-lg text-brown-dark leading-snug">
              {manuscript?.title || '(untitled manuscript)'}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Type
              </dt>
              <dd className="text-brown-dark">
                {TYPE_LABELS[manuscript?.manuscript_type || ''] ||
                  manuscript?.manuscript_type ||
                  '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Subspecialty
              </dt>
              <dd className="text-brown-dark">
                {manuscript?.subspecialty || '—'}
              </dd>
            </div>
          </div>
          {invitation.deadline && (
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Response deadline
              </dt>
              <dd className="text-brown-dark">
                {new Date(invitation.deadline).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </dd>
            </div>
          )}
        </dl>

        {manuscript?.abstract && (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
              Abstract
            </p>
            <p className="text-sm text-brown-dark whitespace-pre-wrap leading-relaxed">
              {manuscript.abstract}
            </p>
          </div>
        )}

        <ReviewResponseForm
          token={params.token}
          prefilled={prefilled}
          reviewerName={reviewerName || firstName}
        />

        <p className="text-xs text-brown pt-4 border-t border-border">
          You do not need an OSCRSJ account to respond. If you have questions
          before answering, reply to the original invitation email and a
          member of the editorial office will follow up.
        </p>
      </div>
    </div>
  )
}

function StaticMessage({
  heading,
  body,
}: {
  heading: string
  body: string
}) {
  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-xl mx-auto bg-white border border-border rounded-xl p-8 space-y-4">
        <p className="text-[11px] uppercase tracking-widest text-brown">
          OSCRSJ Editorial Office
        </p>
        <h1 className="font-serif text-2xl text-brown-dark">{heading}</h1>
        <p className="text-sm text-brown-dark leading-relaxed">{body}</p>
        <p className="text-xs text-brown pt-4 border-t border-border">
          Questions? Reply to the original invitation email.
        </p>
      </div>
    </div>
  )
}
