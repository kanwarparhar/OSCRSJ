'use client'

import { useState, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bars3Icon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { resolveOrcid } from '@/lib/admin/actions'

// CRediT 14-role NISO vocab — Janine §6 hard-required.
export const CREDIT_ROLES = [
  'Conceptualization',
  'Data curation',
  'Formal analysis',
  'Funding acquisition',
  'Investigation',
  'Methodology',
  'Project administration',
  'Resources',
  'Software',
  'Supervision',
  'Validation',
  'Visualization',
  'Writing — original draft',
  'Writing — review & editing',
] as const

export interface AuthorState {
  id: string
  full_name: string
  degrees: string | null
  email: string
  affiliation: string | null
  orcid_id: string | null
  contribution: string | null
  is_corresponding: boolean
  is_equal_contribution: boolean
}

interface Props {
  author: AuthorState
  index: number
  totalAuthors: number
  onChange: (patch: Partial<AuthorState>) => void
  onRemove: () => void
  onSetCorresponding: () => void
}

export default function AuthorCard({
  author,
  index,
  totalAuthors,
  onChange,
  onRemove,
  onSetCorresponding,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: author.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [showOrcidDiff, setShowOrcidDiff] = useState(false)
  const [orcidDiff, setOrcidDiff] = useState<{
    given_name?: string
    family_name?: string
    current_affiliation?: string | null
  } | null>(null)
  const [orcidError, setOrcidError] = useState<string | null>(null)
  const [orcidPending, startOrcid] = useTransition()

  function selectedRoles(): string[] {
    const raw = (author.contribution || '').trim()
    if (!raw) return []
    return raw
      .split(/[;,]/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
  }

  function toggleRole(role: string) {
    const current = selectedRoles()
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role]
    onChange({ contribution: next.join('; ') })
  }

  function handleResolveOrcid() {
    setOrcidError(null)
    setOrcidDiff(null)
    if (!author.orcid_id) {
      setOrcidError('Enter an ORCID iD first.')
      return
    }
    startOrcid(async () => {
      const result = await resolveOrcid(author.orcid_id || '')
      if (result.error || !result.ok) {
        setOrcidError(result.error || 'Resolve failed.')
        return
      }
      setOrcidDiff({
        given_name: result.given_name,
        family_name: result.family_name,
        current_affiliation: result.current_affiliation,
      })
      setShowOrcidDiff(true)
    })
  }

  function applyOrcidDiff(fields: { name?: boolean; affiliation?: boolean }) {
    if (!orcidDiff) return
    const patch: Partial<AuthorState> = {}
    if (fields.name && (orcidDiff.given_name || orcidDiff.family_name)) {
      const given = orcidDiff.given_name || ''
      const family = orcidDiff.family_name || ''
      patch.full_name = `${given} ${family}`.trim()
    }
    if (fields.affiliation && orcidDiff.current_affiliation) {
      patch.affiliation = orcidDiff.current_affiliation
    }
    onChange(patch)
    setShowOrcidDiff(false)
    setOrcidDiff(null)
  }

  const roles = selectedRoles()

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-author-card ${
        isDragging ? 'draggable-author-card-dragging' : ''
      }`}
      data-author-card={author.id}
    >
      <button
        type="button"
        className="absolute left-3 top-4 text-tan hover:text-brown-dark cursor-grab touch-none"
        {...attributes}
        {...listeners}
        aria-label={`Reorder author ${index + 1} (currently ${index + 1} of ${totalAuthors})`}
        title="Drag to reorder"
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="corresponding"
              checked={author.is_corresponding}
              onChange={onSetCorresponding}
              className="accent-peach-dark"
            />
            <span className={author.is_corresponding ? 'text-brown-dark font-medium' : 'text-brown'}>
              Corresponding
            </span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={author.is_equal_contribution}
              onChange={(e) => onChange({ is_equal_contribution: e.target.checked })}
              className="accent-peach-dark"
            />
            <span className={author.is_equal_contribution ? 'text-brown-dark font-medium' : 'text-brown'}>
              Equal contribution
            </span>
          </label>
          <span className="text-brown">
            #{index + 1} of {totalAuthors}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                `Remove author "${author.full_name || `#${index + 1}`}"? This will reorder remaining authors.`
              )
            ) {
              onRemove()
            }
          }}
          className="text-xs text-red-700 hover:bg-red-50 rounded px-2 py-1"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="editor-field-label">Full name</label>
          <input
            type="text"
            value={author.full_name}
            onChange={(e) => onChange({ full_name: e.target.value })}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            data-target={`author-${index}-name`}
          />
        </div>
        <div>
          <label className="editor-field-label">Degrees</label>
          <input
            type="text"
            value={author.degrees || ''}
            onChange={(e) => onChange({ degrees: e.target.value })}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            placeholder="MD, PhD"
          />
        </div>
        <div>
          <label className="editor-field-label">Email</label>
          <input
            type="email"
            value={author.email}
            onChange={(e) => onChange({ email: e.target.value })}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark"
            data-target={`author-${index}-email`}
          />
        </div>
        <div>
          <label className="editor-field-label">
            ORCID iD
            <button
              type="button"
              onClick={handleResolveOrcid}
              disabled={orcidPending || !author.orcid_id}
              className="ml-2 text-xs text-brown-dark hover:text-peach-dark underline disabled:opacity-40"
            >
              {orcidPending ? 'Resolving…' : 'Resolve from ORCID ↗'}
            </button>
          </label>
          <input
            type="text"
            value={author.orcid_id || ''}
            onChange={(e) => onChange({ orcid_id: e.target.value })}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark font-mono"
            placeholder="0000-0000-0000-0000"
          />
          {orcidError && (
            <p className="text-xs text-red-700 mt-1">{orcidError}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="editor-field-label">Affiliation</label>
          <textarea
            value={author.affiliation || ''}
            onChange={(e) => onChange({ affiliation: e.target.value })}
            rows={2}
            className="bg-white border border-border rounded-lg px-3 py-2 text-sm text-ink w-full focus:ring-2 focus:ring-peach-dark resize-vertical"
            data-target={`author-${index}-affiliation`}
            placeholder="Department of Orthopaedic Surgery, University of Pittsburgh, Pittsburgh, PA, USA"
          />
        </div>
        <div className="md:col-span-2" data-target={`author-${index}-credit`}>
          <label className="editor-field-label">
            CRediT contribution (14-role NISO vocab — multi-select)
          </label>
          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {roles.map((r) => (
                <span key={r} className="credit-chip-selected">
                  {r}
                  <button
                    type="button"
                    onClick={() => toggleRole(r)}
                    className="text-brown hover:text-red-700 ml-1 cursor-pointer"
                    aria-label={`Remove ${r}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="credit-chip-grid">
            {CREDIT_ROLES.map((r) => (
              <label
                key={r}
                className="inline-flex items-center gap-1.5 text-xs text-brown-dark cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={roles.includes(r)}
                  onChange={() => toggleRole(r)}
                  className="accent-peach-dark"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {showOrcidDiff && orcidDiff && (
        <div className="mt-3 rounded-lg border border-peach-dark/40 bg-cream-alt/60 p-3 space-y-2">
          <p className="text-xs uppercase tracking-widest text-brown font-medium">
            ORCID resolved values · accept per-field
          </p>
          {(orcidDiff.given_name || orcidDiff.family_name) && (
            <div className="flex items-start justify-between gap-3 text-xs">
              <div className="flex-1">
                <p className="text-brown">Current name:</p>
                <p className="text-ink">{author.full_name || '(empty)'}</p>
                <p className="text-brown mt-1">ORCID name:</p>
                <p className="text-ink font-medium">
                  {`${orcidDiff.given_name || ''} ${orcidDiff.family_name || ''}`.trim()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => applyOrcidDiff({ name: true })}
                className="text-xs bg-peach-dark text-brown-dark font-medium rounded px-2 py-1 self-center"
              >
                Apply →
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setShowOrcidDiff(false)
              setOrcidDiff(null)
            }}
            className="text-xs text-brown underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
