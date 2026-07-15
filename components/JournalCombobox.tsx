'use client'

// Searchable journal picker for the Journal Formatter. A plain <select> is
// unusable at 100 journals, so this is a self-contained typeahead combobox
// (no dependencies) that filters by journal name, abbreviation, or publisher
// and is fully keyboard-navigable (ARIA combobox + listbox pattern). Styled
// with the formatter's "Swiss editorial" fmt-* tokens (used only inside
// app/(formatter), so this restyle is safe).

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { JournalSummary } from '@/lib/formatting/registry-meta'

interface JournalComboboxProps {
  journals: JournalSummary[]
  value: string // selected slug ('' = none)
  onChange: (slug: string) => void
  disabled?: boolean
  placeholder?: string
}

function matches(j: JournalSummary, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    j.name.toLowerCase().includes(needle) ||
    j.abbrev.toLowerCase().includes(needle) ||
    (j.publisher?.toLowerCase().includes(needle) ?? false)
  )
}

export default function JournalCombobox({
  journals,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search journals by name or abbreviation…',
}: JournalComboboxProps) {
  const selected = useMemo(
    () => journals.find((j) => j.slug === value) ?? null,
    [journals, value],
  )

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listboxId = useId()

  // When open, the input shows the live query; when closed, it shows the
  // selected journal's name (so the field reads as a normal picker at rest).
  const inputValue = open ? query : selected?.name ?? ''

  const filtered = useMemo(() => {
    // While the field displays the selected name (not actively searching),
    // show the full list so the dropdown is a browsable menu, not one item.
    const q = open ? query : ''
    return journals.filter((j) => matches(j, q))
  }, [journals, open, query])

  // Keep the highlight in range as the filtered list changes.
  useEffect(() => {
    setHighlight((h) => (filtered.length === 0 ? 0 : Math.min(h, filtered.length - 1)))
  }, [filtered.length])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  // Scroll the highlighted option into view.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const openMenu = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    // Highlight the currently-selected journal if there is one.
    const idx = selected ? journals.findIndex((j) => j.slug === selected.slug) : 0
    setHighlight(idx >= 0 ? idx : 0)
  }, [disabled, journals, selected])

  const choose = useCallback(
    (j: JournalSummary) => {
      onChange(j.slug)
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    },
    [onChange],
  )

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault()
      openMenu()
      return
    }
    if (!open) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlight((h) => (filtered.length ? (h + 1) % filtered.length : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlight((h) => (filtered.length ? (h - 1 + filtered.length) % filtered.length : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlight]) choose(filtered[highlight])
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setQuery('')
        break
      case 'Tab':
        setOpen(false)
        setQuery('')
        break
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[highlight] ? `${listboxId}-opt-${highlight}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={inputValue}
        placeholder={disabled ? 'Choose a journal first' : placeholder}
        onFocus={openMenu}
        onChange={(e) => {
          if (!open) setOpen(true)
          setQuery(e.target.value)
          setHighlight(0)
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-fmt-hairline bg-fmt-paper px-4 py-2.5 pr-9 text-sm text-fmt-ink placeholder:text-fmt-ink-3 transition-colors focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40 disabled:cursor-not-allowed disabled:bg-fmt-surface disabled:text-fmt-ink-3"
      />
      {/* caret / clear affordance */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fmt-ink-3"
      >
        ▾
      </span>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-fmt-hairline bg-fmt-paper py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-fmt-ink-2">No journals match “{query}”.</li>
          ) : (
            filtered.map((j, i) => {
              const isSel = j.slug === value
              const isHi = i === highlight
              return (
                <li
                  key={j.slug}
                  id={`${listboxId}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    // mousedown (not click) so the input's blur doesn't close
                    // the list before the selection registers.
                    e.preventDefault()
                    choose(j)
                  }}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-sm ${
                    isHi ? 'bg-fmt-accent-wash' : 'bg-fmt-paper'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-fmt-ink">
                    {j.name}
                    {isSel && <span className="ml-2 text-xs text-fmt-accent-deep">✓</span>}
                  </span>
                  <span className="flex-shrink-0 text-xs text-fmt-ink-3">{j.abbrev}</span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
