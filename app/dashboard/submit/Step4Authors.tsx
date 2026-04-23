'use client'

import { useState, useCallback } from 'react'

export interface AuthorEntry {
  full_name: string
  email: string
  affiliation: string
  orcid_id: string
  degrees: string
  contribution: string
  is_corresponding: boolean
  author_order: number
}

interface Step4AuthorsProps {
  authors: AuthorEntry[]
  authorConsentCertified: boolean
  onChange: (updates: {
    authors?: AuthorEntry[]
    authorConsentCertified?: boolean
  }) => void
}

export default function Step4Authors({
  authors,
  authorConsentCertified,
  onChange,
}: Step4AuthorsProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formAffiliation, setFormAffiliation] = useState('')
  const [formOrcid, setFormOrcid] = useState('')
  const [formDegrees, setFormDegrees] = useState('')

  const resetForm = useCallback(() => {
    setFormName('')
    setFormEmail('')
    setFormAffiliation('')
    setFormOrcid('')
    setFormDegrees('')
    setShowAddForm(false)
    setEditingIndex(null)
  }, [])

  const handleAddAuthor = useCallback(() => {
    if (!formName.trim() || !formEmail.trim()) return
    const newAuthor: AuthorEntry = {
      full_name: formName.trim(),
      email: formEmail.trim(),
      affiliation: formAffiliation.trim(),
      orcid_id: formOrcid.trim(),
      degrees: formDegrees.trim(),
      contribution: '',
      is_corresponding: false,
      author_order: authors.length + 1,
    }
    onChange({ authors: [...authors, newAuthor] })
    resetForm()
  }, [formName, formEmail, formAffiliation, formOrcid, formDegrees, authors, onChange, resetForm])

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null || !formName.trim() || !formEmail.trim()) return
    const updated = [...authors]
    updated[editingIndex] = {
      ...updated[editingIndex],
      full_name: formName.trim(),
      email: formEmail.trim(),
      affiliation: formAffiliation.trim(),
      orcid_id: formOrcid.trim(),
      degrees: formDegrees.trim(),
    }
    onChange({ authors: updated })
    resetForm()
  }, [editingIndex, formName, formEmail, formAffiliation, formOrcid, formDegrees, authors, onChange, resetForm])

  const startEdit = (idx: number) => {
    const a = authors[idx]
    setFormName(a.full_name)
    setFormEmail(a.email)
    setFormAffiliation(a.affiliation)
    setFormOrcid(a.orcid_id)
    setFormDegrees(a.degrees)
    setEditingIndex(idx)
    setShowAddForm(false)
  }

  const removeAuthor = (idx: number) => {
    if (authors[idx].is_corresponding) return
    const updated = authors.filter((_, i) => i !== idx).map((a, i) => ({
      ...a,
      author_order: i + 1,
    }))
    onChange({ authors: updated })
  }

  const moveAuthor = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === authors.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const updated = [...authors]
    const temp = updated[idx]
    updated[idx] = updated[swapIdx]
    updated[swapIdx] = temp
    // Reassign order
    const reordered = updated.map((a, i) => ({ ...a, author_order: i + 1 }))
    onChange({ authors: reordered })
  }

  const updateContribution = (idx: number, contribution: string) => {
    const updated = [...authors]
    updated[idx] = { ...updated[idx], contribution }
    onChange({ authors: updated })
  }

  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">Authors & Contributors</h2>
      <p className="text-sm text-brown mb-6">
        List all authors in the order they should appear on the publication. The corresponding author is pre-filled from your profile.
      </p>

      {/* Author list */}
      <div className="space-y-3 mb-6">
        {authors.map((author, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border ${
              author.is_corresponding ? 'border-brown/30 bg-white' : 'border-border bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Reorder buttons + info */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                  <button
                    onClick={() => moveAuthor(idx, 'up')}
                    disabled={idx === 0}
                    className="text-brown hover:text-ink disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className="text-xs font-semibold text-brown w-5 text-center">{idx + 1}</span>
                  <button
                    onClick={() => moveAuthor(idx, 'down')}
                    disabled={idx === authors.length - 1}
                    className="text-brown hover:text-ink disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{author.full_name}</span>
                    {author.is_corresponding && (
                      <span className="text-[10px] font-medium bg-brown/10 text-brown px-2 py-0.5 rounded-full">
                        Corresponding Author
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-brown mt-0.5">{author.email}</p>
                  {author.affiliation && (
                    <p className="text-xs text-brown">{author.affiliation}</p>
                  )}
                  {author.degrees && (
                    <p className="text-xs text-brown">{author.degrees}</p>
                  )}
                  {author.orcid_id && (
                    <p className="text-xs text-brown">ORCID: {author.orcid_id}</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(idx)}
                  className="text-xs text-brown hover:underline"
                >
                  Edit
                </button>
                {!author.is_corresponding && (
                  <button
                    onClick={() => removeAuthor(idx)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Contribution text area */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-ink mb-1">
                Author Contribution (ICMJE)
              </label>
              <textarea
                value={author.contribution}
                onChange={(e) => updateContribution(idx, e.target.value)}
                rows={2}
                placeholder="e.g., Conception and design, data collection, manuscript writing"
                className="w-full px-3 py-2 border border-border rounded-lg text-xs text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 resize-y"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Edit form (inline) */}
      {editingIndex !== null && (
        <div className="border border-brown/30 rounded-lg p-4 mb-6 bg-white">
          <h3 className="text-sm font-semibold text-ink mb-3">
            Edit Author: {authors[editingIndex]?.full_name}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Affiliation</label>
              <input
                type="text"
                value={formAffiliation}
                onChange={(e) => setFormAffiliation(e.target.value)}
                placeholder="Institution or department"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">ORCID iD</label>
              <input
                type="text"
                value={formOrcid}
                onChange={(e) => setFormOrcid(e.target.value)}
                placeholder="0000-0000-0000-0000"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink mb-1">Degree(s)</label>
              <input
                type="text"
                value={formDegrees}
                onChange={(e) => setFormDegrees(e.target.value)}
                placeholder="e.g., MD, PhD, DO"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveEdit}
              disabled={!formName.trim() || !formEmail.trim()}
              className="btn-primary-light text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Changes
            </button>
            <button
              onClick={resetForm}
              className="text-sm text-brown hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add co-author form (inline) */}
      {showAddForm && editingIndex === null && (
        <div className="border border-border rounded-lg p-4 mb-6 bg-white">
          <h3 className="text-sm font-semibold text-ink mb-3">Add Co-Author</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Co-author's full name"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="Co-author's email"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Affiliation</label>
              <input
                type="text"
                value={formAffiliation}
                onChange={(e) => setFormAffiliation(e.target.value)}
                placeholder="Institution or department"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">ORCID iD</label>
              <input
                type="text"
                value={formOrcid}
                onChange={(e) => setFormOrcid(e.target.value)}
                placeholder="0000-0000-0000-0000"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink mb-1">Degree(s)</label>
              <input
                type="text"
                value={formDegrees}
                onChange={(e) => setFormDegrees(e.target.value)}
                placeholder="e.g., MD, PhD, DO"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddAuthor}
              disabled={!formName.trim() || !formEmail.trim()}
              className="btn-primary-light text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Author
            </button>
            <button
              onClick={resetForm}
              className="text-sm text-brown hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add co-author button */}
      {!showAddForm && editingIndex === null && (
        <button
          onClick={() => { resetForm(); setShowAddForm(true) }}
          className="text-sm font-medium text-brown hover:underline mb-6 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Co-Author
        </button>
      )}

      {/* ICMJE certification checkbox */}
      <div className="border-t border-border pt-6 mt-6">
        <h3 className="font-serif text-lg text-brown-dark mb-1">Author Certification</h3>
        <p className="text-xs text-brown mb-4">
          This certification is required before submission.
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={authorConsentCertified}
            onChange={(e) => onChange({ authorConsentCertified: e.target.checked })}
            className="mt-0.5 accent-brown w-4 h-4"
          />
          <span className="text-sm text-ink">
            I, as corresponding author, certify that all listed authors have reviewed and approved this manuscript for submission, agree to its content, and meet the ICMJE criteria for authorship.
          </span>
        </label>
      </div>
    </div>
  )
}
