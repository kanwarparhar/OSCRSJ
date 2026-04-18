'use client'

import { useState, useCallback } from 'react'

const SUBSPECIALTIES = [
  'Spine',
  'Adult Reconstruction',
  'Sports Medicine',
  'Trauma & Fractures',
  'Pediatric Orthopedics',
  'Hand & Upper Extremity',
  'Foot & Ankle',
  'Orthopedic Oncology',
]

interface SuggestedReviewer {
  name: string
  email: string
  expertise: string
}

interface NonPreferredReviewer {
  name: string
  reason: string
}

interface Step3InfoProps {
  title: string
  abstract: string
  keywords: string[]
  subspecialty: string
  suggestedReviewers: SuggestedReviewer[]
  nonPreferredReviewers: NonPreferredReviewer[]
  onChange: (updates: {
    title?: string
    abstract?: string
    keywords?: string[]
    subspecialty?: string
    suggestedReviewers?: SuggestedReviewer[]
    nonPreferredReviewers?: NonPreferredReviewer[]
  }) => void
}

export default function Step3Info({
  title,
  abstract,
  keywords,
  subspecialty,
  suggestedReviewers,
  nonPreferredReviewers,
  onChange,
}: Step3InfoProps) {
  const [keywordInput, setKeywordInput] = useState('')

  // ---- Word count helper ----
  const wordCount = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
  }

  // ---- Keywords ----
  const addKeyword = useCallback(() => {
    const kw = keywordInput.trim()
    if (!kw) return
    if (keywords.length >= 8) return
    if (keywords.some(k => k.toLowerCase() === kw.toLowerCase())) return
    onChange({ keywords: [...keywords, kw] })
    setKeywordInput('')
  }, [keywordInput, keywords, onChange])

  const removeKeyword = (idx: number) => {
    onChange({ keywords: keywords.filter((_, i) => i !== idx) })
  }

  // ---- Suggested reviewers ----
  const updateSuggestedReviewer = (idx: number, field: keyof SuggestedReviewer, value: string) => {
    const updated = [...suggestedReviewers]
    updated[idx] = { ...updated[idx], [field]: value }
    onChange({ suggestedReviewers: updated })
  }

  const addSuggestedReviewer = () => {
    if (suggestedReviewers.length >= 5) return
    onChange({ suggestedReviewers: [...suggestedReviewers, { name: '', email: '', expertise: '' }] })
  }

  const removeSuggestedReviewer = (idx: number) => {
    onChange({ suggestedReviewers: suggestedReviewers.filter((_, i) => i !== idx) })
  }

  // ---- Non-preferred reviewers ----
  const updateNonPreferred = (idx: number, field: keyof NonPreferredReviewer, value: string) => {
    const updated = [...nonPreferredReviewers]
    updated[idx] = { ...updated[idx], [field]: value }
    onChange({ nonPreferredReviewers: updated })
  }

  const addNonPreferred = () => {
    if (nonPreferredReviewers.length >= 3) return
    onChange({ nonPreferredReviewers: [...nonPreferredReviewers, { name: '', reason: '' }] })
  }

  const removeNonPreferred = (idx: number) => {
    onChange({ nonPreferredReviewers: nonPreferredReviewers.filter((_, i) => i !== idx) })
  }

  const abstractWords = wordCount(abstract)
  const abstractValid = abstractWords >= 150 && abstractWords <= 500

  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">Manuscript Information</h2>
      <p className="text-sm text-brown mb-6">
        Provide details about your manuscript. All fields marked with an asterisk are required.
      </p>

      {/* Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-brown-dark mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onChange({ title: e.target.value.slice(0, 200) })}
          placeholder="Enter your manuscript title"
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-brown-dark placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
        />
        <p className="text-xs text-brown mt-1 text-right">{title.length}/200 characters</p>
      </div>

      {/* Abstract */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-brown-dark mb-1">
          Abstract <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-brown mb-2">
          Structured abstract: Background, Case Presentation, Discussion, Conclusion. 150 to 500 words.
        </p>
        <textarea
          value={abstract}
          onChange={(e) => onChange({ abstract: e.target.value })}
          rows={8}
          placeholder="Background: ...&#10;Case Presentation: ...&#10;Discussion: ...&#10;Conclusion: ..."
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-brown-dark placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 resize-y"
        />
        <p className={`text-xs mt-1 text-right ${
          abstractWords === 0 ? 'text-brown' : abstractValid ? 'text-green-600' : 'text-red-500'
        }`}>
          {abstractWords} / 150-500 words
        </p>
      </div>

      {/* Keywords */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-brown-dark mb-1">
          Keywords <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-brown mb-2">
          Add 3 to 8 keywords. Type a keyword and press Enter to add.
        </p>

        {/* Keyword tags */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map((kw, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 bg-cream text-brown-dark text-sm rounded-full"
              >
                {kw}
                <button
                  onClick={() => removeKeyword(idx)}
                  className="text-brown hover:text-red-500 ml-0.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {keywords.length < 8 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addKeyword()
                }
              }}
              placeholder="Type a keyword and press Enter"
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-brown-dark placeholder:text-taupe focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30"
            />
            <button
              onClick={addKeyword}
              disabled={!keywordInput.trim()}
              className="text-xs font-medium text-brown border border-brown/20 px-4 py-2 rounded-lg hover:bg-cream transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}

        <p className="text-xs text-brown mt-1">{keywords.length}/8 keywords</p>
      </div>

      {/* Subspecialty */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-brown-dark mb-1">
          Orthopedic Subspecialty <span className="text-red-500">*</span>
        </label>
        <select
          value={subspecialty}
          onChange={(e) => onChange({ subspecialty: e.target.value })}
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-brown-dark focus:outline-none focus:border-tan focus:ring-1 focus:ring-tan/30 bg-white"
        >
          <option value="">Select a subspecialty</option>
          {SUBSPECIALTIES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Suggested Reviewers */}
      <div className="mb-6 border-t border-border pt-6">
        <h3 className="font-serif text-lg text-brown-dark mb-1">Suggested Reviewers</h3>
        <p className="text-xs text-brown mb-4">
          Optional. Suggest up to 5 reviewers with relevant expertise. These should not be co-authors or collaborators.
        </p>

        {suggestedReviewers.map((reviewer, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 p-3 bg-white rounded-lg relative">
            <input
              type="text"
              value={reviewer.name}
              onChange={(e) => updateSuggestedReviewer(idx, 'name', e.target.value)}
              placeholder="Full name"
              className="px-3 py-2 border border-border rounded-lg text-sm text-brown-dark placeholder:text-taupe focus:outline-none focus:border-tan"
            />
            <input
              type="email"
              value={reviewer.email}
              onChange={(e) => updateSuggestedReviewer(idx, 'email', e.target.value)}
              placeholder="Email address"
              className="px-3 py-2 border border-border rounded-lg text-sm text-brown-dark placeholder:text-taupe focus:outline-none focus:border-tan"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={reviewer.expertise}
                onChange={(e) => updateSuggestedReviewer(idx, 'expertise', e.target.value)}
                placeholder="Area of expertise"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-brown-dark placeholder:text-taupe focus:outline-none focus:border-tan"
              />
              <button
                onClick={() => removeSuggestedReviewer(idx)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {suggestedReviewers.length < 5 && (
          <button
            onClick={addSuggestedReviewer}
            className="text-xs font-medium text-brown hover:underline"
          >
            + Add a suggested reviewer
          </button>
        )}
      </div>

      {/* Non-Preferred Reviewers */}
      <div className="border-t border-border pt-6">
        <h3 className="font-serif text-lg text-brown-dark mb-1">Non-Preferred Reviewers</h3>
        <p className="text-xs text-brown mb-4">
          Optional. List up to 3 reviewers you would prefer not to review this manuscript, with a brief reason.
        </p>

        {nonPreferredReviewers.map((reviewer, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 p-3 bg-white rounded-lg">
            <input
              type="text"
              value={reviewer.name}
              onChange={(e) => updateNonPreferred(idx, 'name', e.target.value)}
              placeholder="Full name"
              className="px-3 py-2 border border-border rounded-lg text-sm text-brown-dark placeholder:text-taupe focus:outline-none focus:border-tan"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={reviewer.reason}
                onChange={(e) => updateNonPreferred(idx, 'reason', e.target.value)}
                placeholder="Reason"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-brown-dark placeholder:text-taupe focus:outline-none focus:border-tan"
              />
              <button
                onClick={() => removeNonPreferred(idx)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {nonPreferredReviewers.length < 3 && (
          <button
            onClick={addNonPreferred}
            className="text-xs font-medium text-brown hover:underline"
          >
            + Add a non-preferred reviewer
          </button>
        )}
      </div>
    </div>
  )
}
