import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRevisionRow,
  ManuscriptFileRow,
  EditorialDecisionRow,
} from '@/lib/types/database'

// Revisions panel for the admin manuscript detail page.
//
// Schema note (Session 14): manuscript_revisions stores only
// response_to_reviewers + note_to_editor + submitted_date. Pre-revision
// snapshots of title / abstract / keywords / author_list are NOT stored
// (see migrations 001, 002 — no snapshot columns added through 011).
// A field-level diff across revisions is therefore not possible from
// the current schema. The Session 14 brief's item 16 + risk #5 both
// anticipated this fallback.
//
// What this panel CAN show reliably:
//   - Each revision's submitted_date
//   - The author's response-to-reviewers letter for that revision
//     (the author's own summary of what changed)
//   - The editor's note_to_editor for that revision
//   - Which files were uploaded in that revision version
//     (manuscript_files.version is the authoritative grouping;
//     storage_path also carries a `v{n}/` prefix for v2+)
//   - The triggering editorial_decisions row for each revision
//     (the decision that requested it) with its deadline
//
// What this panel does NOT show:
//   - A computed title / abstract / keywords / author diff. Will
//     require adding snapshot columns to manuscript_revisions; flagged
//     for a future session alongside Phase 4 publishing-pipeline work.

interface Props {
  manuscriptId: string
}

const FILE_TYPE_LABELS: Record<string, string> = {
  manuscript: 'Manuscript',
  blinded_manuscript: 'Blinded manuscript',
  cover_letter: 'Cover letter',
  figure: 'Figure',
  supplement: 'Supplement',
  ethics_approval: 'Ethics approval',
  consent_form: 'Consent form',
  tracked_changes: 'Tracked changes',
  response_to_reviewers: 'Response to reviewers',
}

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function RevisionsPanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const [revisionsRes, filesRes, decisionsRes] = await Promise.all([
    admin
      .from('manuscript_revisions')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('revision_number', { ascending: true }),
    admin
      .from('manuscript_files')
      .select('*')
      .eq('manuscript_id', manuscriptId),
    admin
      .from('editorial_decisions')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .is('rescinded_at', null)
      .in('decision', ['minor_revisions', 'major_revisions'])
      .order('decision_date', { ascending: true }),
  ])

  const revisions = (revisionsRes.data as ManuscriptRevisionRow[] | null) || []
  if (revisions.length === 0) return null

  const files = (filesRes.data as ManuscriptFileRow[] | null) || []
  const revisionDecisions =
    (decisionsRes.data as EditorialDecisionRow[] | null) || []

  // Files grouped by version — version 1 is the original submission,
  // version 2+ is each submitted revision.
  const filesByVersion = new Map<number, ManuscriptFileRow[]>()
  for (const f of files) {
    const arr = filesByVersion.get(f.version) || []
    arr.push(f)
    filesByVersion.set(f.version, arr)
  }

  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-5">
      <div>
        <h2 className="font-serif text-lg text-brown-dark">
          Revisions ({revisions.length})
        </h2>
        <p className="text-xs text-brown mt-1 max-w-2xl">
          Each revision round the author submitted, with their
          response-to-reviewers letter and the files uploaded. The letter is
          the author&rsquo;s own summary of what changed.
        </p>
      </div>

      <ul className="space-y-5">
        {revisions.map((rev, idx) => {
          // v1 = original submission, so revision N corresponds to
          // manuscript_files.version = N + 1.
          const fileVersion = rev.revision_number + 1
          const revFiles = filesByVersion.get(fileVersion) || []
          // The decision that triggered this revision round is the
          // N-th minor/major_revisions decision in chronological order.
          const triggeringDecision = revisionDecisions[idx] || null
          const deadlineLabel = formatDeadline(
            triggeringDecision?.revision_deadline ?? null
          )

          return (
            <li
              key={rev.id}
              className="border border-border rounded-lg p-4 bg-cream/20 space-y-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-serif text-brown-dark text-base">
                    Revision v{rev.revision_number}
                  </p>
                  <p className="text-[11px] text-brown uppercase tracking-widest mt-0.5">
                    Submitted {formatDate(rev.submitted_date)}
                  </p>
                </div>
                {deadlineLabel && (
                  <span className="text-[11px] text-brown bg-white border border-border px-2 py-1 rounded">
                    Requested by editor on{' '}
                    {formatDate(triggeringDecision!.decision_date)}
                    {triggeringDecision?.revision_deadline &&
                      ` · deadline ${deadlineLabel}`}
                  </span>
                )}
              </div>

              {rev.response_to_reviewers && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
                    Response to reviewers (author summary of changes)
                  </p>
                  <pre className="text-xs text-ink bg-white border border-border rounded px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">
                    {rev.response_to_reviewers}
                  </pre>
                </div>
              )}

              {rev.note_to_editor && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
                    Note to editor
                  </p>
                  <pre className="text-xs text-ink bg-white border border-border rounded px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed">
                    {rev.note_to_editor}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
                  Files uploaded in this revision ({revFiles.length})
                </p>
                {revFiles.length === 0 ? (
                  <p className="text-xs text-brown italic">
                    No files tagged to v{fileVersion}. The revision was
                    submitted without re-uploading files under the v
                    {fileVersion} path, or the files use the legacy flat
                    storage layout from before the revision flow shipped.
                  </p>
                ) : (
                  <ul className="text-xs space-y-1">
                    {revFiles.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 text-ink"
                      >
                        <span className="truncate flex-1">
                          {f.original_filename}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-brown whitespace-nowrap">
                          {FILE_TYPE_LABELS[f.file_type] ||
                            f.file_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-brown whitespace-nowrap">
                          {formatBytes(f.file_size_bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="text-[11px] text-brown italic border-t border-border pt-3">
        Field-level diff of title, abstract, keywords, and author list across
        revisions is not available &mdash; the current schema does not
        snapshot pre-revision manuscript state. The current values of those
        fields reflect the most recent revision. The
        response-to-reviewers letter above is the author&rsquo;s own account
        of what changed.
      </p>
    </section>
  )
}
