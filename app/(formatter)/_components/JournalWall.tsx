'use client'

import { useMemo, useState } from 'react'

type WallJournal = {
  slug: string
  name: string
  publisher: string
  guidelinesUrl: string
  verified: string
  typeCount: number
}

/**
 * Supported-journals wall (brief §5) with a client-side text filter. Cards are
 * rendered visible (not `.reveal`-gated) because filtering mutates the grid
 * after the FormatterMotion observers have already run.
 */
export default function JournalWall({ journals }: { journals: WallJournal[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return journals
    return journals.filter(
      (j) => j.name.toLowerCase().includes(q) || j.publisher.toLowerCase().includes(q),
    )
  }, [journals, query])

  return (
    <div style={{ marginTop: '32px' }}>
      <label htmlFor="wall-filter" className="sr-only">
        Find your journal
      </label>
      <input
        id="wall-filter"
        type="text"
        className="wall-filter"
        placeholder="Find your journal…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      {filtered.length === 0 ? (
        <p className="wall-empty">No journal matches “{query}”. Try the publisher name, or a shorter term.</p>
      ) : (
        <div className="wall">
          {filtered.map((j) => (
            <a
              key={j.slug}
              className="card jcard"
              href={j.guidelinesUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="jn">{j.name}</div>
              <div className="jp">{j.publisher}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span className="chip">Verified {j.verified}</span>
                <span style={{ fontSize: '12px', color: 'var(--fmt-ink-3)' }}>
                  {j.typeCount} article {j.typeCount === 1 ? 'type' : 'types'}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
