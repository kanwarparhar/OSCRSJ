'use client'

// Read-only "Step 0" shown only in revising mode. Displays the
// editor's decision letter + all submitted reviews under
// anonymised Reviewer A / B / C labels so authors never learn
// reviewer identities (double-blind preserved on the author
// surface). Do NOT reuse the admin read-only review detail view
// at /dashboard/admin/manuscripts/[id]/reviews/[reviewId] — that
// component surfaces reviewer identities per §4.3 of the
// Submission Portal Architecture Plan and is editor-only.

import type { AnonymisedReview } from '@/lib/submission/actions'

interface Props {
  revisionNumber: number
  decisionLetter: string | null
  decisionType: string | null
  decisionDate: string | null
  revisionDeadline: string | null
  reviews: AnonymisedReview[]
}

const DECISION_LABELS: Record<string, string> = {
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  accept: 'Accepted',
  reject: 'Rejected',
  desk_reject: 'Desk Rejected',
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  accept: 'Accept',
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  reject: 'Reject',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

// Session 35 (2026-04-26): the 6-row Likert score grid (Quality / Novelty /
// Rigor / Data / Clarity / Scope fit) was removed per Kanwar's directive.
// Scores are no longer collected on the reviewer form; the recommendation
// pill + freeform comments-to-author now carry the entire review.

export default function RevisionStep0({
  revisionNumber,
  decisionLetter,
  decisionType,
  decisionDate,
  revisionDeadline,
  reviews,
}: Props) {
  const days = daysUntil(revisionDeadline)
  const deadlineClass =
    days !== null && days < 10
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-amber-100 text-amber-800 border-amber-200'

  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">
        Decision &amp; Reviewer Comments
      </h2>
      <p className="text-sm text-brown mb-6">
        Review the editor&rsquo;s decision and each reviewer&rsquo;s feedback
        before preparing your revision. These are read-only. Reviewer
        identities are not disclosed.
      </p>

      <div className="bg-cream-alt/50 border border-border rounded-lg p-4 mb-5 space-y-2">
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-white text-ink">
            Revision v{revisionNumber}
          </span>
          {decisionType && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-white text-ink">
              Decision: {DECISION_LABELS[decisionType] || decisionType}
            </span>
          )}
          <span className="text-brown">
            Decided {formatDate(decisionDate)}
          </span>
          {revisionDeadline && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${deadlineClass}`}
            >
              Deadline: {formatDate(revisionDeadline)}
              {days !== null && days >= 0 ? ` · ${days}d left` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Editor's letter */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-ink mb-2">
          Editor&rsquo;s letter
        </h3>
        {decisionLetter ? (
          <pre className="p-4 bg-white border border-border rounded-lg font-mono text-xs text-ink whitespace-pre-wrap break-words">
            {decisionLetter}
          </pre>
        ) : (
          <p className="text-sm text-brown italic">
            The editor did not include a letter with this decision.
          </p>
        )}
      </section>

      {/* Anonymised reviews */}
      <section>
        <h3 className="text-sm font-semibold text-ink mb-2">
          Reviewer comments ({reviews.length})
        </h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-brown italic">
            No submitted reviews are attached to this decision.
          </p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((review, idx) => (
              <li
                key={idx}
                className="border border-border rounded-lg p-4 bg-white"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-brown-dark">
                    {review.label}
                  </h4>
                  {review.recommendation && (
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-brown bg-cream-alt px-2 py-0.5 rounded-full border border-border">
                      Recommendation:{' '}
                      {RECOMMENDATION_LABELS[review.recommendation] ||
                        review.recommendation}
                    </span>
                  )}
                </div>

                {review.comments_to_author ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
                      Comments to author
                    </p>
                    <pre className="p-3 bg-cream-alt/40 border border-border rounded font-mono text-xs text-ink whitespace-pre-wrap break-words">
                      {review.comments_to_author}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-brown italic">
                    This reviewer did not leave comments to the author.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-brown mt-6">
        Next: confirm manuscript type on Step 1, upload the revised files on
        Step 2, then walk through the remaining steps.
      </p>
    </div>
  )
}
