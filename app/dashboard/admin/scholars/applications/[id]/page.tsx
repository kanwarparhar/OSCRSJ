import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getCohortApplication,
  TRACK_LABELS,
  TIER_LABELS,
} from '@/lib/scholars/actions'
import StatusActions from './StatusActions'

export const dynamic = 'force-dynamic'

export default async function AdminCohortApplicationDetail({
  params,
}: {
  params: { id: string }
}) {
  const { application, cvSignedUrl, error } = await getCohortApplication(
    params.id
  )
  if (error || !application) {
    notFound()
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link
          href="/dashboard/admin/scholars/applications"
          className="text-sm text-brown hover:text-brown-dark hover:underline inline-flex items-center gap-1"
        >
          ← All applications
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-border rounded-xl p-6">
            <h1 className="font-serif text-3xl text-brown-dark">
              {application.first_name} {application.last_name}
            </h1>
            <p className="text-sm text-brown mt-1">
              {application.email}
              {application.orcid_id &&
                ` · ORCID: ${application.orcid_id}`}
            </p>
            <p className="text-xs text-brown mt-3">
              Submitted {formatDate(application.created_at)}
            </p>
          </div>

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-serif text-lg text-brown-dark mb-3">
              Track &amp; Tier
            </h2>
            <p className="text-sm text-ink">
              <strong>{TRACK_LABELS[application.preferred_track]}</strong>
              <br />
              {TIER_LABELS[application.preferred_tier]}
            </p>
          </div>

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-serif text-lg text-brown-dark mb-3">
              School &amp; Background
            </h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown font-medium">
                  School
                </dt>
                <dd className="text-ink">{application.school}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown font-medium">
                  Year
                </dt>
                <dd className="text-ink">{application.year_in_school}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-brown font-medium">
                  Country
                </dt>
                <dd className="text-ink">{application.country_of_residence}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-serif text-lg text-brown-dark mb-3">
              Why do you want to join this program?
            </h2>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
              {application.personal_statement}
            </p>
          </div>

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-serif text-lg text-brown-dark mb-3">
              Research experience to date
            </h2>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
              {application.research_experience}
            </p>
          </div>

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-serif text-lg text-brown-dark mb-3">
              Why OSCRSJ specifically?
            </h2>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
              {application.why_oscrsj}
            </p>
          </div>

          {application.references_json &&
            application.references_json.length > 0 && (
              <div className="bg-white border border-border rounded-xl p-6">
                <h2 className="font-serif text-lg text-brown-dark mb-3">
                  References ({application.references_json.length})
                </h2>
                <div className="space-y-3">
                  {application.references_json.map((ref, idx) => (
                    <div
                      key={idx}
                      className="border border-border rounded-lg p-3 bg-cream-alt"
                    >
                      <p className="text-sm font-medium text-ink">
                        {ref.name || '— no name —'}
                      </p>
                      <p className="text-xs text-brown mt-0.5">
                        {ref.relationship}
                        {ref.institution && ` · ${ref.institution}`}
                      </p>
                      {ref.email && (
                        <a
                          href={`mailto:${ref.email}`}
                          className="text-xs text-brown hover:underline mt-1 inline-block"
                        >
                          {ref.email}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-serif text-lg text-brown-dark mb-3">
              Acknowledgments
            </h2>
            <ul className="space-y-1.5 text-sm text-ink">
              <li className="flex items-center gap-2">
                <span
                  className={
                    application.ai_disclosure_ack
                      ? 'text-green-700'
                      : 'text-red-700'
                  }
                >
                  {application.ai_disclosure_ack ? '✓' : '✗'}
                </span>
                <span>AI-use policy acknowledged</span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={
                    application.participant_agreement_ack
                      ? 'text-green-700'
                      : 'text-red-700'
                  }
                >
                  {application.participant_agreement_ack ? '✓' : '✗'}
                </span>
                <span>Participant agreement acknowledged</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Side panel — status + actions */}
        <aside className="space-y-6">
          <div className="bg-white border border-border rounded-xl p-6 sticky top-20">
            <h2 className="font-serif text-lg text-brown-dark mb-3">
              Status &amp; Triage
            </h2>
            <StatusActions
              applicationId={application.id}
              currentStatus={application.status}
              currentNotes={application.admin_notes || ''}
            />
          </div>

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-serif text-lg text-brown-dark mb-3">CV</h2>
            {cvSignedUrl ? (
              <a
                href={cvSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline w-full justify-center text-sm"
              >
                Open CV (signed URL, 30 min)
              </a>
            ) : (
              <p className="text-sm text-brown">
                No CV uploaded with this application.
              </p>
            )}
          </div>

          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="font-serif text-lg text-brown-dark mb-3">
              Contact
            </h2>
            <a
              href={`mailto:${application.email}`}
              className="text-sm text-brown hover:text-brown-dark hover:underline break-all"
            >
              {application.email}
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
