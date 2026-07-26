'use client'

// Finder v2 — the three self-assessment questions.
//
// The intro says out loud what these answers can and cannot do: nudge by one
// band at most, never override the text. That bound is enforced in
// deriveAuthorShift (clamped to +/-0.10), so the copy is a description of the
// code rather than a promise about it.

import { FINDER_V2 } from '../_copy'
import type { AuthorPriority, SelfAssessment } from '@/lib/finder/profileTypes'

interface Props {
  value: SelfAssessment
  onChange: (next: SelfAssessment) => void
}

function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onSelect,
}: {
  legend: string
  name: string
  options: readonly { value: string; label: string }[]
  value: T | null
  onSelect: (v: T) => void
}) {
  return (
    <fieldset className="border-t border-fmt-hairline pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-2 text-sm font-medium text-fmt-ink">{legend}</legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onSelect(o.value as T)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-fmt-accent"
            />
            <span className="text-sm leading-snug text-fmt-ink-2">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function FinderSelfAssessmentForm({ value, onChange }: Props) {
  // Max two priorities, and the ORDER the author picks them is meaningful: it is
  // the order the ladder applies as tie-breaks. So a third pick drops the oldest
  // rather than being silently ignored.
  function togglePriority(p: AuthorPriority) {
    const has = value.priorities.includes(p)
    const next = has ? value.priorities.filter((x) => x !== p) : [...value.priorities, p].slice(-2)
    onChange({ ...value, priorities: next })
  }

  return (
    <div className="rounded-xl border border-fmt-hairline bg-white p-6">
      <p className="mb-5 text-sm leading-relaxed text-fmt-ink-2">{FINDER_V2.questionsIntro}</p>

      <div className="space-y-5">
        <RadioGroup
          legend={FINDER_V2.q1}
          name="finder-novelty"
          options={FINDER_V2.q1Options}
          value={value.novelty}
          onSelect={(v) => onChange({ ...value, novelty: v as SelfAssessment['novelty'] })}
        />
        <RadioGroup
          legend={FINDER_V2.q2}
          name="finder-strength"
          options={FINDER_V2.q2Options}
          value={value.strength}
          onSelect={(v) => onChange({ ...value, strength: v as SelfAssessment['strength'] })}
        />

        <fieldset className="border-t border-fmt-hairline pt-4">
          <legend className="mb-2 text-sm font-medium text-fmt-ink">{FINDER_V2.q3}</legend>
          <div className="flex flex-wrap gap-2">
            {FINDER_V2.q3Options.map((o) => {
              const active = value.priorities.includes(o.value as AuthorPriority)
              const rank = value.priorities.indexOf(o.value as AuthorPriority)
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePriority(o.value as AuthorPriority)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-fmt-accent bg-fmt-accent/10 text-fmt-accent-deep'
                      : 'border-fmt-hairline bg-white text-fmt-ink-2 hover:border-fmt-ink-3'
                  }`}
                >
                  {active ? `${rank + 1}. ` : ''}
                  {o.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
