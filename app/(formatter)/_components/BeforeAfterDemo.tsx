'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Code-driven before/after demo (brief §6.3 / D4). A ~14s, 4-scene CSS loop
 * staged inside a fixed "desk" card. Scenes are data-driven so Session 3 can
 * replay them at 1080×1920 for an MP4 social export. IntersectionObserver
 * pauses the loop off-screen; prefers-reduced-motion renders the final
 * (formatted) state statically with no loop.
 */
type Scene = { cls: string; cap: string; note: string; dur: number }

const SCENES: Scene[] = [
  { cls: 'before s1', cap: 'manuscript_draft.docx', note: 'Scene 1 of 4: the "before" manuscript', dur: 3500 },
  { cls: 'before s2', cap: 'Target: The Journal of Bone & Joint Surgery', note: 'Scene 2 of 4: pick the journal', dur: 2500 },
  { cls: 'before s3', cap: 'Formatting…', note: 'Scene 3 of 4: parse · verify · apply', dur: 3500 },
  { cls: 's4', cap: 'manuscript_JBJS.docx ✓', note: 'Scene 4 of 4: submission-ready', dur: 4500 },
]

export default function BeforeAfterDemo() {
  const [sceneIdx, setSceneIdx] = useState(0)
  const [staticMode, setStaticMode] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setStaticMode(true)
      setSceneIdx(3)
      return
    }

    const node = rootRef.current
    if (!node) return
    let i = 0
    let timer: number | null = null
    let running = true

    const show = (k: number) => {
      setSceneIdx(k)
      timer = window.setTimeout(() => {
        i = (i + 1) % SCENES.length
        if (running) show(i)
      }, SCENES[k].dur)
    }

    const io = new IntersectionObserver(
      (entries) => {
        running = entries[0].isIntersecting
        if (running && timer === null) show(i)
        if (!running && timer !== null) {
          window.clearTimeout(timer)
          timer = null
        }
      },
      { threshold: 0.2 },
    )
    io.observe(node)

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      io.disconnect()
    }
  }, [])

  const scene = SCENES[sceneIdx]
  const isAfter = scene.cls.startsWith('s4')
  const caption = staticMode ? 'manuscript_JBJS.docx · formatted preview' : scene.cap

  return (
    <div id="demo" ref={rootRef} className={`demo ${scene.cls}`} aria-hidden="true" style={{ scrollMarginTop: '80px' }}>
      <div className="cap">
        <span className="dot" />
        <span>{caption}</span>
      </div>
      <div className="page">
        <div className="lineno">
          {['1', '4', '8', '12', '16', '20', '24', '28', '32', '36', '40', '44'].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <div className="doc-title">
          Bilateral exertional compartment syndrome of the forearms: a case report
        </div>
        <div className="doc-meta">Running title · Authors · Affiliations · Word count</div>
        <div className="doc-line w95" />
        <div className="doc-line w88" />
        <div className="doc-line w92" />
        <div className="doc-line w95" />
        <div className="doc-line w88" />
        <div className="doc-line w60" />
        <div className="doc-ref">
          …as previously described{' '}
          {isAfter ? <span className="okchip">[1]</span> : <span className="badchip">(Smith 2019)</span>}
        </div>
        <div className="worklog">
          <div>
            Parsing references… <span className="tick">24 found</span>
          </div>
          <div>
            Verifying · Crossref · PubMed… <span className="tick">24 ✓</span>
          </div>
          <div>Applying JBJS layout…</div>
        </div>
        <div className="report">
          <div style={{ color: 'var(--fmt-ok)' }}>✓ TNR 12pt · double-spaced</div>
          <div style={{ color: 'var(--fmt-ok)' }}>✓ Continuous line numbers</div>
          <div style={{ color: 'var(--fmt-ok)' }}>✓ References renumbered (NLM)</div>
          <div>Compliance report · 0 blocking issues</div>
        </div>
      </div>
      <div className="journals-row">
        <span className="chip">AJSM</span>
        <span className="chip on">JBJS</span>
        <span className="chip">Spine</span>
        <span className="chip">CORR</span>
        <span className="chip">Injury</span>
      </div>
      {!staticMode && <div className="scene-note">{scene.note}</div>}
    </div>
  )
}
