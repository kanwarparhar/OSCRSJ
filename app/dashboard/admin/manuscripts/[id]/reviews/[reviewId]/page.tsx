import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ReviewRow,
  ReviewInvitationRow,
  UserRow,
  ReviewRecommendation,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

const RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  accept: 'Accept',
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  reject: 'Reject',
}

const RECOMMENDATION_STYLES: Record<ReviewRecommendation, string> = {
  accept: 'bg-green-100 text-green-800 border-green-200',
  minor_revisions: 'bg-blue-100 text-blue-800 border-blue-200',
  major_revisions: 'bg-orange-100 text-orange-800 border-orange-200',
  reject: 'bg-red-100 text-red-800 border-red-200',
}

// Session 35 (2026-04-26): the 6-row Likert score grid (Quality / Novelty /
// Rigor / Data / Clarity / Scope fit) was removed from this editor view per
// Kanwar's directive — scores are no longer collected on the reviewer form.
// Historical reviews still carry their scores in the DB columns
// (quality_score / novelty_score / rigor_score / data_score / clarity_score /
// scope_score on `reviews`), but they are intentionally not surfaced here.
// The recommendation pill + freeform feedback now carry the entire review.

export default async function EditorReviewDetailPage({
  params,
}: {
  params: { id: string; reviewId: string }
}) {
  const admin = createAdminClient()

  const { data: rData } = await admin
    .from('reviews')
    .select('*')
    .eq('id', params.reviewId)
    .maybeSingle()
  const review = (rData as ReviewRow | null) || null
  if (!review) notFound()
  if (review.manuscript_id !== params.id) notFound()
  // Drafts are not visible to editors — only submitted reviews surface.
  if (review.is_draft) notFound()

  const [mRes, invRes] = await Promise.all([
    admin.from('manuscripts').select('*').eq('id', params.id).maybeSingle(),
    admin
      .from('review_invitations')
      .select('*')
      .eq('id', review.review_invitation_id)
      .maybeSingle(),
  ])
  const manuscript = (mRes.data as ManuscriptRow | null) || null
  if (!manuscript) notFound()
  const invitation = (invRes.data as ReviewInvitationRow | null) || null

  // Reviewer identity — invitation snapshot is authoritative for
  // external reviewers. Fall back to a users join when a reviewer_id
  // is populated (invitee later registered an account).
  let reviewerProfile: UserRow | null = null
  if (review.reviewer_id) {
    const { data: uData } = await admin
      .from('users')
      .select('*')
      .eq('id', review.reviewer_id)
      .maybeSingle()
    reviewerProfile = (uData as UserRow | null) || null
  }

  const reviewerName =
    reviewerProfile?.full_name ||
    [invitation?.reviewer_first_name, invitation?.reviewer_last_name]
      .filter(Boolean)
      .join(' ') ||
    '(unknown reviewer)'
  const reviewerEmail =
    reviewerProfile?.email ||
    invitation?.reviewer_email ||
    review.review_invitation_id_snapshot_email ||
    '—'
  const reviewerAffiliation = reviewerProfile?.affiliation || null
  const reviewerOrcid = reviewerProfile?.orcid_id || null

  const rec = review.recommendation

  return (
    <div className="space-y-6">
      <div className="text-xs text-brown space-x-2">
        <Link
          href="/dashboard/admin/manuscripts"
          className="hover:text-ink underline underline-offset-2"
        >
          Manuscripts
        </Link>
        <span>›</span>
        <Link
          href={`/dashboard/admin/manuscripts/${manuscript.id}`}
          className="hover:text-ink underline underline-offset-2 font-mono"
        >
          {manuscript.submission_id}
        </Link>
        <span>›</span>
        <span className="text-ink">Review by {reviewerName}</span>
      </div>

      {/* Manuscript context header */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-2">
        <p className="font-mono text-xs text-brown">
          {manuscript.submission_id}
        </p>
        <h1 className="font-serif text-2xl text-brown-dark leading-snug">
          {manuscript.title || '(untitled manuscript)'}
        </h1>
        <p className="text-xs text-brown">
          {TYPE_LABELS[manuscript.manuscript_type || ''] ||
            manuscript.manuscript_type ||
            '—'}{' '}
          · {manuscript.subspecialty || '—'}
        </p>
      </div>

      {/* Reviewer identity */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-lg text-brown-dark">
            Reviewer identity
          </h2>
          <span className="text-[10px] uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded">
            Visible to editors only · never shown to authors
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-brown">
              Name
            </dt>
            <dd className="text-ink">{reviewerName}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-brown">
              Email
            </dt>
            <dd className="text-ink break-all">{reviewerEmail}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-brown">
              Affiliation
            </dt>
            <dd className="text-ink">{reviewerAffiliation || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-brown">
              ORCID
            </dt>
            <dd className="text-ink font-mono text-xs">
              {reviewerOrcid || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-brown">
              Account status
            </dt>
            <dd className="text-ink">
              {reviewerProfile
                ? 'Registered user'
                : 'External reviewer (token-only)'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-brown">
              Submitted
            </dt>
            <dd className="text-ink">
              {review.submitted_date
                ? new Date(review.submitted_date).toLocaleString()
                : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Recommendation */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <h2 className="font-serif text-lg text-brown-dark">Recommendation</h2>
        {rec ? (
          <span
            className={`inline-block text-sm font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border ${RECOMMENDATION_STYLES[rec]}`}
          >
            {RECOMMENDATION_LABELS[rec]}
          </span>
        ) : (
          <p className="text-sm text-brown">No recommendation recorded.</p>
        )}
      </div>

      {/* Feedback and review */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-lg text-brown-dark">
            Feedback and review
          </h2>
          <span className="text-[10px] uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded">
            Confidential to editorial office
          </span>
        </div>
        <div className="bg-cream/50 border border-border rounded-lg p-4 text-sm text-ink whitespace-pre-wrap leading-relaxed font-mono">
          {review.comments_to_author ||
            review.comments_to_editor ||
            '—'}
        </div>
      </div>

      {/* Conflict of interest */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <h2 className="font-serif text-lg text-brown-dark">
          Conflict of interest
        </h2>
        <p className="text-sm text-ink whitespace-pre-wrap">
          {review.conflict_of_interest || 'None declared'}
        </p>
      </div>

      {/* Invitation history */}
      {invitation && (
        <div className="bg-white border border-border rounded-xl p-6 space-y-3">
          <h2 className="font-serif text-lg text-brown-dark">
            Invitation history
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Invited
              </dt>
              <dd className="text-ink">
                {new Date(invitation.invited_date).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Accepted
              </dt>
              <dd className="text-ink">
                {invitation.response_date &&
                (invitation.status === 'accepted' ||
                  invitation.status === 'submitted')
                  ? new Date(invitation.response_date).toLocaleString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Deadline
              </dt>
              <dd className="text-ink">
                {invitation.deadline
                  ? new Date(invitation.deadline).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <p className="text-xs text-brown italic">
        Read-only view. The editorial decision workflow (accept / minor / major
        / reject + decision letter composer) ships in Phase 3.
      </p>
    </div>
  )
}
