'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import BulkDecisionModal, {
  type BulkSelectable,
} from './BulkDecisionModal'

// Client table + multi-select + sticky footer for bulk decisions.
// The server page does the data fetch and passes the hydrated list
// into this component. Selection state is client-side only — no URL
// reflection, no persistence across reloads.

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-blue-100 text-blue-800 border-blue-200',
  revision_requested: 'bg-orange-100 text-orange-800 border-orange-200',
  revision_received: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  awaiting_payment: 'bg-purple-100 text-purple-800 border-purple-200',
  in_production: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  desk_rejected: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  withdrawn: 'bg-neutral-200 text-neutral-700 border-neutral-300',
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
}

const TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

export interface AdminManuscriptRow extends BulkSelectable {
  manuscriptType: string | null
  subspecialty: string | null
  submissionDate: string | null
}

export default function ManuscriptsListClient({
  rows,
}: {
  rows: AdminManuscriptRow[]
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)

  const allSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const someSelected = selectedIds.size > 0 && !allSelected

  const selectedManuscripts = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds]
  )

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)))
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function filterToEligible(eligibleIds: string[]) {
    setSelectedIds(new Set(eligibleIds))
  }

  return (
    <>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-alt/40 border-b border-border">
              <tr className="text-left">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all in view"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                  Submission ID
                </th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                  Title
                </th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                  Type
                </th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                  Subspecialty
                </th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                  Status
                </th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                  Corresponding
                </th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                  Submitted
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const checked = selectedIds.has(m.id)
                return (
                  <tr
                    key={m.id}
                    className={`border-t border-border hover:bg-cream-alt/30 ${
                      checked ? 'bg-cream-alt/50' : ''
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${m.submissionId}`}
                        checked={checked}
                        onChange={() => toggleRow(m.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">
                      {m.submissionId}
                    </td>
                    <td className="px-4 py-3 text-ink max-w-sm truncate">
                      {m.title || (
                        <span className="text-brown italic">(untitled)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {TYPE_LABELS[m.manuscriptType || ''] ||
                        m.manuscriptType ||
                        '—'}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {m.subspecialty || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[m.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                      >
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {m.correspondingAuthorName || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-brown">
                      {m.submissionDate
                        ? new Date(m.submissionDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/admin/manuscripts/${m.id}`}
                        className="text-sm text-ink underline underline-offset-2 hover:text-brown"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-cream-alt shadow-lg">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-ink">
              <strong>{selectedIds.size}</strong> manuscript
              {selectedIds.size === 1 ? '' : 's'} selected
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="text-sm px-3 py-1.5 rounded-lg border border-border text-brown hover:bg-white"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="text-sm px-4 py-2 rounded-lg border border-brown bg-peach-dark text-ink hover:bg-peach font-medium"
              >
                Bulk decision
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkDecisionModal
        open={bulkOpen}
        selected={selectedManuscripts}
        onClose={() => setBulkOpen(false)}
        onFilterToEligible={filterToEligible}
      />
    </>
  )
}
