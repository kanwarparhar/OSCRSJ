import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ReviewInvitationRow,
  InvitationStatus,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Reviewer dashboard — OSCRSJ',
}

const TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

const STATUS_BADGE: Record<InvitationStatus, string> = {
  invited: 'bg-peach-dark/30 text-ink',
  accepted: 'bg-green-100 text-green-900',
  submitted: 'bg-blue-100 text-blue-900',
  declined: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-700',
}

const STATUS_LABEL: Record<InvitationStatus, string> = {
  invited: 'Invited',
  accepted: 'In progress',
  submitted: 'Submitted',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

type InvitationWithManuscript = ReviewInvitationRow & {
  manuscriptTitle: string
  manuscriptType: string | null
  manuscriptSubspecialty: string | null
}

async function loadInvitationsForUser(
  userId: string,
  userEmail: string | null
): Promise<InvitationWithManuscript[]> {
  const admin = createAdminClient()
  const orClauses: string[] = [`reviewer_id.eq.${userId}`]
  if (userEmail) {
    const safeEmail = userEmail.replace(/,/g, '')
    orClauses.push(`reviewer_email.eq.${safeEmail}`)
  }

  const { data: invData } = await admin
    .from('review_invitations')
    .select('*')
    .or(orClauses.join(','))
    .order('invited_date', { ascending: false })

  const invitations = (invData as ReviewInvitationRow[] | null) || []
  if (invitations.length === 0) return []

  const manuscriptIds = Array.from(
    new Set(invitations.map((i) => i.manuscript_id))
  )
  const { data: mData } = await admin
    .from('manuscripts')
    .select('id, title, manuscript_type, subspecialty')
    .in('id', manuscriptIds)

  const manuscripts = (mData as Partial<ManuscriptRow>[] | null) || []
  const byId = new Map<string, Partial<ManuscriptRow>>(
    manuscripts.map((m) => [m.id as string, m])
  )

  return invitations.map((inv) => {
    const m = byId.get(inv.manuscript_id)
    return {
      ...inv,
      manuscriptTitle: m?.title || '(untitled manuscript)',
      manuscriptType: m?.manuscript_type || null,
      manuscriptSubspecialty: m?.subspecialty || null,
    }
  })
}

export default async function ReviewerDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // DashboardLayout redirects unauthenticated users; this is defensive.
  if (!user) {
    return (
      <div className="bg-white border border-border rounded-xl p-8">
        <p className="text-sm text-ink">Please sign in to see your reviews.</p>
      </div>
    )
  }

  const invitations = await loadInvitationsForUser(
    user.id,
    user.email || null
  )

  const active = invitations.filter(
    (i) => i.status === 'invited' || i.status === 'accepted'
  )
  const submitted = invitations.filter((i) => i.status === 'submitted')
  const past = invitations.filter(
    (i) => i.status === 'declined' || i.status === 'cancelled'
  )

  return (
    <div className="space-y-6">
      <div className="bg-white border border-border rounded-xl p-8">
        <h1 className="font-serif text-3xl text-brown-dark">
          Reviewer dashboard
        </h1>
        <p className="text-sm text-ink mt-2">
          Manage your review invitations here. For a single review, the link
          in your invitation email also works without signing in.
        </p>
        <p className="text-xs text-brown mt-3">
          Don't have an OSCRSJ account yet?{' '}
          <Link href="/register" className="underline hover:text-ink">
            You can still access a specific review via the private link in
            your invitation email.
          </Link>
        </p>
      </div>

      <Section
        title="Active reviews"
        emptyLabel="No active invitations right now."
        items={active}
      >
        {(inv) => (
          <Link
            href={
              inv.status === 'accepted'
                ? `/review/${inv.review_token}/form`
                : `/review/${inv.review_token}`
            }
            className="btn-primary-light whitespace-nowrap"
          >
            {inv.status === 'accepted' ? 'Continue review' : 'Respond to invitation'}
          </Link>
        )}
      </Section>

      <Section
        title="Submitted reviews"
        emptyLabel="You have not submitted any reviews yet."
        items={submitted}
      >
        {(inv) => (
          <Link
            href={`/review/${inv.review_token}`}
            className="text-sm text-brown underline hover:text-ink whitespace-nowrap"
          >
            View invitation
          </Link>
        )}
      </Section>

      <Section
        title="Past invitations"
        emptyLabel="No past declined or cancelled invitations."
        items={past}
        collapsedByDefault
      >
        {(inv) => (
          <span className="text-xs text-brown">
            {STATUS_LABEL[inv.status]}
          </span>
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  emptyLabel,
  items,
  children,
  collapsedByDefault = false,
}: {
  title: string
  emptyLabel: string
  items: InvitationWithManuscript[]
  children: (item: InvitationWithManuscript) => React.ReactNode
  collapsedByDefault?: boolean
}) {
  if (collapsedByDefault && items.length === 0) return null

  return (
    <section className="bg-white border border-border rounded-xl p-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-xl text-brown-dark">{title}</h2>
        <span className="text-xs text-brown">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-brown">{emptyLabel}</p>
      ) : collapsedByDefault ? (
        <details>
          <summary className="text-sm text-brown cursor-pointer hover:text-ink">
            Show {items.length} item{items.length === 1 ? '' : 's'}
          </summary>
          <ul className="divide-y divide-border mt-3">
            {items.map((inv) => (
              <InvitationRow key={inv.id} invitation={inv}>
                {children(inv)}
              </InvitationRow>
            ))}
          </ul>
        </details>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((inv) => (
            <InvitationRow key={inv.id} invitation={inv}>
              {children(inv)}
            </InvitationRow>
          ))}
        </ul>
      )}
    </section>
  )
}

function InvitationRow({
  invitation,
  children,
}: {
  invitation: InvitationWithManuscript
  children: React.ReactNode
}) {
  return (
    <li className="py-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-serif text-lg text-brown-dark leading-snug">
          {invitation.manuscriptTitle}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-brown">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] ${STATUS_BADGE[invitation.status]}`}
          >
            {STATUS_LABEL[invitation.status]}
          </span>
          {invitation.manuscriptType && (
            <span>
              {TYPE_LABELS[invitation.manuscriptType] ||
                invitation.manuscriptType}
            </span>
          )}
          {invitation.manuscriptSubspecialty && (
            <span>· {invitation.manuscriptSubspecialty}</span>
          )}
          <span>
            ·{' '}
            {invitation.status === 'submitted'
              ? `Submitted ${formatDate(invitation.response_date)}`
              : `Invited ${formatDate(invitation.invited_date)}`}
          </span>
          {invitation.status === 'accepted' && invitation.deadline && (
            <span className="text-ink">
              · Due {formatDate(invitation.deadline)}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </li>
  )
}
