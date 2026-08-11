import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow } from '@/lib/types/database'
import { listDeposits, type DepositRow } from '@/lib/publish/crossref/queue'
import { readCrossrefEnv, isTestEndpoint } from '@/lib/publish/crossref/depositClient'
import CrossrefDepositActions from './CrossrefDepositActions'

// Crossref deposit state — the surface that makes a silent rejection
// impossible.
//
// Crossref deposits are asynchronous: the POST only queues a batch, and the
// accept/reject verdict arrives later in the submission log. Before this
// panel existed there was nowhere to see that a batch had been rejected, so
// the failure mode was reporting a registered DOI that did not exist.

interface Props {
  manuscriptId: string
}

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-cream-alt text-brown border-border',
  submitted: 'bg-peach/10 text-brown-dark border-peach/30',
  success: 'bg-green-50 text-green-800 border-green-200',
  failed: 'bg-red-50 text-red-800 border-red-200',
}

const STATUS_COPY: Record<string, string> = {
  queued: 'Queued — will be sent on the next sweep.',
  submitted:
    'Sent to Crossref and awaiting the submission log. A 200 from Crossref means QUEUED, not registered — this stays "submitted" until the log returns a verdict.',
  success: 'Registered. The DOI resolves to the article landing page.',
  failed: 'Crossref rejected this batch. See the diagnostics below, fix the metadata, then re-deposit.',
}

export default async function CrossrefDepositPanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('id, status, doi, elocation_id, published_date')
    .eq('id', manuscriptId)
    .maybeSingle()

  const manuscript = mData as Pick<
    ManuscriptRow,
    'id' | 'status' | 'doi' | 'elocation_id' | 'published_date'
  > | null

  if (!manuscript) return null
  if (manuscript.status !== 'accepted' && manuscript.status !== 'published') {
    return null
  }

  let deposits: DepositRow[] = []
  try {
    deposits = await listDeposits(manuscriptId)
  } catch {
    // Migration 035 not yet applied — degrade to the "not configured" view
    // rather than blowing up the whole manuscript page.
    deposits = []
  }

  const latest = deposits[0] ?? null
  const env = readCrossrefEnv()
  const configured = Boolean(env)
  const testMode = env ? isTestEndpoint(env) : false

  const cardClass = 'bg-white border border-border rounded-xl p-6 space-y-4'

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-lg text-brown-dark">Crossref deposit</h2>
        {latest ? (
          <span
            className={`text-[11px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${
              STATUS_STYLES[latest.status] || 'bg-cream-alt text-brown border-border'
            }`}
          >
            {latest.status}
          </span>
        ) : (
          <span className="text-[11px] uppercase tracking-widest text-brown bg-cream-alt px-2.5 py-1 rounded-full border border-border">
            not deposited
          </span>
        )}
      </div>

      <dl className="text-sm text-ink space-y-1">
        <div className="flex gap-2">
          <dt className="text-brown w-28 shrink-0">DOI</dt>
          <dd className="font-mono text-xs break-all">
            {manuscript.doi || <span className="italic text-brown">not minted</span>}
          </dd>
        </div>
        {latest?.doi_batch_id && (
          <div className="flex gap-2">
            <dt className="text-brown w-28 shrink-0">Batch ID</dt>
            <dd className="font-mono text-xs break-all">{latest.doi_batch_id}</dd>
          </div>
        )}
        {latest?.deposit_xml_sha256 && (
          <div className="flex gap-2">
            <dt className="text-brown w-28 shrink-0">XML sha256</dt>
            <dd className="font-mono text-[10px] break-all text-brown">
              {latest.deposit_xml_sha256}
            </dd>
          </div>
        )}
        {latest?.submitted_at && (
          <div className="flex gap-2">
            <dt className="text-brown w-28 shrink-0">Submitted</dt>
            <dd className="text-xs">{new Date(latest.submitted_at).toLocaleString()}</dd>
          </div>
        )}
        {latest?.confirmed_at && (
          <div className="flex gap-2">
            <dt className="text-brown w-28 shrink-0">Confirmed</dt>
            <dd className="text-xs">{new Date(latest.confirmed_at).toLocaleString()}</dd>
          </div>
        )}
        {latest && latest.attempts > 0 && (
          <div className="flex gap-2">
            <dt className="text-brown w-28 shrink-0">Attempts</dt>
            <dd className="text-xs">{latest.attempts}</dd>
          </div>
        )}
      </dl>

      {latest && (
        <p className="text-sm text-ink leading-relaxed">{STATUS_COPY[latest.status]}</p>
      )}

      {latest?.status === 'failed' && latest.last_error != null && (
        <pre className="text-[11px] bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(latest.last_error, null, 2)}
        </pre>
      )}

      {!configured && (
        <p className="text-sm text-brown-dark bg-cream-alt border border-border rounded-lg p-3 leading-relaxed">
          <strong>Crossref is not configured.</strong> Set{' '}
          <code className="text-xs">CROSSREF_DEPOSIT_USER</code>,{' '}
          <code className="text-xs">CROSSREF_DEPOSIT_PASSWORD</code>,{' '}
          <code className="text-xs">CROSSREF_DEPOSIT_URL</code>,{' '}
          <code className="text-xs">CROSSREF_QUERY_URL</code> and{' '}
          <code className="text-xs">CROSSREF_DEPOSITOR_EMAIL</code> in the Vercel
          project. Until then every deposit call is a safe no-op.
        </p>
      )}

      {configured && testMode && (
        <p className="text-sm text-brown-dark bg-peach/10 border border-peach/30 rounded-lg p-3 leading-relaxed">
          <strong>Test system.</strong> Deposits are going to{' '}
          <code className="text-xs">test.crossref.org</code> and register nothing
          real. Flip <code className="text-xs">CROSSREF_DEPOSIT_URL</code> and{' '}
          <code className="text-xs">CROSSREF_QUERY_URL</code> to production only
          after a clean test log.
        </p>
      )}

      <CrossrefDepositActions
        manuscriptId={manuscriptId}
        status={manuscript.status}
        doi={manuscript.doi}
        configured={configured}
        hasDeposit={Boolean(latest)}
        depositStatus={latest?.status ?? null}
      />
    </section>
  )
}
