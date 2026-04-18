'use client'

import type { ManuscriptType } from '@/lib/types/database'

const MANUSCRIPT_TYPES: { value: ManuscriptType; label: string; description: string }[] = [
  {
    value: 'case_report',
    label: 'Case Report',
    description: 'A detailed report of 1 to 3 patients. Up to 2,000 words. CARE checklist required.',
  },
  {
    value: 'case_series',
    label: 'Case Series',
    description: 'A series of 4 or more patients with similar presentation. Up to 3,000 words. JBI checklist required.',
  },
  {
    value: 'surgical_technique',
    label: 'Surgical Technique',
    description: 'A novel or modified surgical procedure. Up to 1,500 words. Minimum 4 figures, video encouraged.',
  },
  {
    value: 'images_in_orthopedics',
    label: 'Images in Orthopedics',
    description: 'Striking clinical or radiographic images. Up to 500 words with 1 to 4 images. Expedited 7 to 10 day review.',
  },
  {
    value: 'letter_to_editor',
    label: 'Letter to the Editor',
    description: 'Commentary on a previously published article. Up to 600 words.',
  },
  {
    value: 'review_article',
    label: 'Review Article (Invited Only)',
    description: 'Comprehensive review of a clinical topic. Up to 3,500 words. Invited by the editorial board in Year 1.',
  },
]

interface Step1TypeProps {
  manuscriptType: ManuscriptType | null
  notUnderReview: boolean
  notPreviouslyPublished: boolean
  allAuthorsAgreed: boolean
  onChange: (updates: {
    manuscriptType?: ManuscriptType | null
    notUnderReview?: boolean
    notPreviouslyPublished?: boolean
    allAuthorsAgreed?: boolean
  }) => void
}

export default function Step1Type({
  manuscriptType,
  notUnderReview,
  notPreviouslyPublished,
  allAuthorsAgreed,
  onChange,
}: Step1TypeProps) {
  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">Select Manuscript Type</h2>
      <p className="text-sm text-brown mb-6">
        Choose the type that best describes your manuscript. Each type has specific formatting requirements.
      </p>

      {/* Manuscript type radio group */}
      <div className="space-y-3 mb-8">
        {MANUSCRIPT_TYPES.map((type) => (
          <label
            key={type.value}
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
              manuscriptType === type.value
                ? 'border-brown/40 bg-cream shadow-sm'
                : 'border-border hover:border-tan hover:shadow-sm'
            }`}
          >
            <input
              type="radio"
              name="manuscriptType"
              value={type.value}
              checked={manuscriptType === type.value}
              onChange={() => onChange({ manuscriptType: type.value })}
              className="mt-1 accent-brown"
            />
            <div>
              <span className="text-sm font-semibold text-brown-dark">{type.label}</span>
              <p className="text-xs text-brown mt-0.5">{type.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Confirmations */}
      <div className="border-t border-border pt-6">
        <h3 className="font-serif text-lg text-brown-dark mb-1">Required Confirmations</h3>
        <p className="text-sm text-brown mb-4">
          Please confirm the following before proceeding.
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notUnderReview}
              onChange={(e) => onChange({ notUnderReview: e.target.checked })}
              className="mt-0.5 accent-brown w-4 h-4"
            />
            <span className="text-sm text-brown-dark">
              This manuscript is not currently under review elsewhere
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notPreviouslyPublished}
              onChange={(e) => onChange({ notPreviouslyPublished: e.target.checked })}
              className="mt-0.5 accent-brown w-4 h-4"
            />
            <span className="text-sm text-brown-dark">
              This work has not been previously published
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allAuthorsAgreed}
              onChange={(e) => onChange({ allAuthorsAgreed: e.target.checked })}
              className="mt-0.5 accent-brown w-4 h-4"
            />
            <span className="text-sm text-brown-dark">
              All authors have agreed to this submission
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
