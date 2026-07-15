import { createAdminClient } from '@/lib/supabase/server'
import type {
  EditorialDecisionRow,
  ManuscriptRevisionRow,
  EditorialDecisionType,
  UserRow,
} from '@/lib/types/database'

interface Props {
  manuscriptId: string
}

const DECISION_LABELS: Record<EditorialDecisionType, string> = {
  accept: 'Accepted',
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  post_review_reject: 'Rejected',
  reject: 'Rejected',
  desk_reject: 'Desk Rejected',
}

const DECISION_PILLS: Record<EditorialDecisionType, string> = {
  accept: 'bg-green-100 text-green-800 border-green-200',
  minor_revisions: 'bg-amber-100 text-amber-800 border-amber-200',
  major_revisions: 'bg-orange-100 text-orange-800 border-orange-200',
  post_review_reject: 'bg-red-100 text-red-800 border-red-200',
  reject: 'bg-red-100 text-red-800 border-red-200',
  desk_reject: 'bg-red-100 text-red-800 border-red-200',
}

interface TimelineDecision {
  kind: 'decision'
  id: string
  date: string
  row: EditorialDecisionRow
  editorName: string | null
}

interface TimelineRevision {
  kind: 'revision'
  id: string
  date: string
  row: ManuscriptRevisionRow
}

type TimelineEntry = TimelineDecision | TimelineRevision

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null
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

export default async function DecisionHistoryPanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const [decisionsRes, revisionsRes] = await Promise.all([
    admin
      .from('editorial_decisions')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('decision_date', { ascending: false }),
    admin
      .from('manuscript_revisions')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('submitted_date', { ascending: false }),
  ])

  const decisions = (decisionsRes.data as EditorialDecisionRow[] | null) || []
  const revisions = (revisionsRes.data as ManuscriptRevisionRow[] | null) || []

  // Resolve editor names in one query.
  const editorIds = Array.from(new Set(decisions.map((d) => d.editor_id)))
  let editorNameById = new Map<string, string>()
  if (editorIds.length > 0) {
    const { data: editors } = await admin
      .from('users')
      .select('id, full_name')
      .in('id', editorIds)
    for (const row of (editors as Pick<UserRow, 'id' | 'full_name'>[] | null) ||
      []) {
      editorNameById.set(row.id, row.full_name)
    }
  }

  const entries: TimelineEntry[] = [
    ...decisions.map<TimelineDecision>((row) => ({
      kind: 'decision',
      id: `d-${row.id}`,
      date: row.decision_date,
      row,
      editorName: editorNameById.get(row.editor_id) || null,
    })),
    ...revisions.map<TimelineRevision>((row) => ({
      kind: 'revision',
      id: `r-${row.id}`,
      date: row.submitted_date,
      row,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-4">
      <div>
        <h2 className="font-serif text-lg text-brown-dark">Decision history</h2>
        <p className="text-xs text-brown mt-1">
          All editorial decisions and author revisions, most recent first.
          Decisions are immutable.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-brown italic">
          No decisions or revisions yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) =>
            entry.kind === 'decision' ? (
              <DecisionRow key={entry.id} entry={entry} />
            ) : (
              <RevisionRow key={entry.id} entry={entry} />
            )
          )}
        </ol>
      )}
    </section>
  )
}

function rescindMinutesAfter(decisionDate: string, rescindedAt: string): number {
  try {
    const d = new Date(decisionDate).getTime()
    const r = new Date(rescindedAt).getTime()
    return Math.max(0, Math.round((r - d) / 60000))
  } catch {
    return 0
  }
}

function DecisionRow({ entry }: { entry: TimelineDecision }) {
  const deadlineLabel = formatDeadline(entry.row.revision_deadline)
  const pillClass = DECISION_PILLS[entry.row.decision] || ''
  const letter = entry.row.decision_letter || ''
  const isRescinded = Boolean(entry.row.rescinded_at)
  return (
    <li
      className={`border border-border rounded-lg p-4 ${
        isRescinded ? 'bg-neutral-50' : 'bg-cream/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${pillClass} ${
              isRescinded ? 'line-through opacity-60' : ''
            }`}
          >
            {DECISION_LABELS[entry.row.decision]}
          </span>
          <span
            className={`text-xs text-brown ${isRescinded ? 'line-through opacity-60' : ''}`}
          >
            {formatDate(entry.row.decision_date)}
          </span>
        </div>
        <span className="text-xs text-brown">
          {entry.editorName ? `by ${entry.editorName}` : ''}
        </span>
      </div>
      {isRescinded && entry.row.rescinded_at && (
        <p className="mt-2 text-[11px] uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-200 inline-block px-2 py-0.5 rounded-full">
          Rescinded {rescindMinutesAfter(entry.row.decision_date, entry.row.rescinded_at)} min after issue
        </p>
      )}
      {isRescinded && entry.row.rescinded_reason && (
        <p className="text-xs text-brown mt-2 italic">
          Reason: {entry.row.rescinded_reason.slice(0, 200)}
          {entry.row.rescinded_reason.length > 200 ? '…' : ''}
        </p>
      )}
      {deadlineLabel && (
        <p
          className={`text-xs text-brown mt-2 ${isRescinded ? 'opacity-60' : ''}`}
        >
          Revision deadline: <span className="text-ink">{deadlineLabel}</span>
        </p>
      )}
      {letter && (
        <details className="mt-3 group">
          <summary className="text-xs text-brown cursor-pointer hover:text-ink list-none">
            <span className="underline underline-offset-2 group-open:hidden">
              View full letter
            </span>
            <span className="underline underline-offset-2 hidden group-open:inline">
              Hide letter
            </span>
          </summary>
          <pre
            className={`mt-2 p-3 bg-white border border-border rounded font-mono text-xs whitespace-pre-wrap break-words ${
              isRescinded ? 'text-brown opacity-70' : 'text-ink'
            }`}
          >
            {letter}
          </pre>
        </details>
      )}
    </li>
  )
}

function RevisionRow({ entry }: { entry: TimelineRevision }) {
  return (
    <li className="border border-border rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-800 border-blue-200">
            Revision v{entry.row.revision_number}
          </span>
          <span className="text-xs text-brown">
            {formatDate(entry.row.submitted_date)}
          </span>
        </div>
      </div>
      {entry.row.response_to_reviewers && (
        <details className="mt-3 group">
          <summary className="text-xs text-brown cursor-pointer hover:text-ink list-none">
            <span className="underline underline-offset-2 group-open:hidden">
              View response summary
            </span>
            <span className="underline underline-offset-2 hidden group-open:inline">
              Hide response
            </span>
          </summary>
          <pre className="mt-2 p-3 bg-cream/40 border border-border rounded font-mono text-xs text-ink whitespace-pre-wrap break-words">
            {entry.row.response_to_reviewers}
          </pre>
        </details>
      )}
      {entry.row.note_to_editor && (
        <p className="mt-2 text-xs text-brown">
          Note to editor:{' '}
          <span className="text-ink italic">{entry.row.note_to_editor}</span>
        </p>
      )}
    </li>
  )
}
