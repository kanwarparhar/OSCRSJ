'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DemoSpec } from '@/lib/formatting/demoSpecs'

/**
 * Interactive Word mock for /studio/format (Session 97, Kanwar directive).
 *
 * Replaces the 4-scene autoplay loop on this page with something the visitor can
 * drive: a Word-like document that visibly re-formats when you pick a journal.
 *
 * THE POINT: every value rendered here comes from `getDemoSpecs()`, which reads
 * the SAME encoded rule files the pipeline uses. The demo is a window onto the
 * registry, not a mockup of one. If JBJS changes its guide and we re-encode it,
 * this demo changes with it, for free.
 *
 * NULL DISCIPLINE (load-bearing): where a journal's guide is silent, we render
 * "not specified · your choice kept" rather than a plausible default. AJSM
 * genuinely publishes no font requirement, so its cell says so. That is the
 * "Never invents a requirement" guarantee demonstrated instead of asserted, and
 * it is the most valuable thing on this component. Do not fill these in.
 *
 * Autoplay cycles the journals until first interaction, then hands control over
 * and never steals it back. Pauses off-screen; static under reduced-motion.
 */

const SPACING_LABEL: Record<string, string> = {
  single: 'Single',
  '1.5': '1.5 lines',
  double: 'Double',
}

const NOT_SPECIFIED = 'not specified · your choice kept'

/** Renders the in-text citation exactly as that journal wants it. */
function Citation({ spec }: { spec: DemoSpec }) {
  const { inText, inTextPunctuation } = spec.references
  const punctFirst = inTextPunctuation === 'before'
  // "before" = punctuation before the marker → "described [1]." reads as
  // "…described" + " [1]" + "." ; "after"/null → "…described." + marker.
  const marker =
    inText === 'superscript' ? (
      <sup className="cite">1</sup>
    ) : inText === 'bracket' ? (
      <span className="cite"> [1]</span>
    ) : (
      <span className="cite"> (1)</span>
    )
  return punctFirst ? (
    <>
      {marker}
      <span>.</span>
    </>
  ) : (
    <>
      <span>.</span>
      {marker}
    </>
  )
}

export default function WordDemo({ specs }: { specs: DemoSpec[] }) {
  const [idx, setIdx] = useState(0)
  const [applying, setApplying] = useState(false)
  const [touched, setTouched] = useState(false)
  const [reduced, setReduced] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const applyTimer = useRef<number | null>(null)

  const spec = specs[idx]

  const select = useCallback(
    (next: number, viaUser: boolean) => {
      if (viaUser) setTouched(true)
      if (next === idx) return
      setApplying(true)
      if (applyTimer.current !== null) window.clearTimeout(applyTimer.current)
      // Brief "applying…" beat so the change reads as an action, not a jump cut.
      applyTimer.current = window.setTimeout(() => {
        setIdx(next)
        setApplying(false)
      }, 420)
    },
    [idx],
  )

  // Autoplay until the visitor takes over.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true)
      return
    }
    if (touched) return
    const node = rootRef.current
    if (!node) return

    let timer: number | null = null
    let visible = false

    const tick = () => {
      timer = window.setTimeout(() => {
        setIdx((i) => {
          const next = (i + 1) % specs.length
          setApplying(true)
          window.setTimeout(() => setApplying(false), 420)
          return next
        })
        if (visible) tick()
      }, 3400)
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting
        if (visible && timer === null) tick()
        if (!visible && timer !== null) {
          window.clearTimeout(timer)
          timer = null
        }
      },
      { threshold: 0.25 },
    )
    io.observe(node)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      io.disconnect()
    }
  }, [touched, specs.length])

  useEffect(
    () => () => {
      if (applyTimer.current !== null) window.clearTimeout(applyTimer.current)
    },
    [],
  )

  if (!spec) return null

  const { layout, references } = spec
  const showLineNos = layout.lineNumbers !== 'none'
  const fontLabel = layout.fontFamily ?? 'Calibri'
  const sizeLabel = layout.fontSizePt ?? 11
  const fontUnspecified = layout.fontFamily === null

  // The document body inherits the journal's font only when the journal states
  // one; otherwise it keeps the author's (represented here as Calibri 11).
  const docStyle: React.CSSProperties = {
    fontFamily: layout.fontFamily
      ? `"${layout.fontFamily}", "Times New Roman", serif`
      : 'Calibri, "Segoe UI", system-ui, sans-serif',
    fontSize: `${(layout.fontSizePt ?? 11) * 1.02}px`,
    lineHeight: layout.lineSpacing === 'double' ? 2 : layout.lineSpacing === '1.5' ? 1.5 : 1.35,
  }

  return (
    <div className="wd" ref={rootRef} id="demo" style={{ scrollMarginTop: '80px' }}>
      {/* ---------- WORD CHROME ---------- */}
      <div className="wd-win">
        <div className="wd-title">
          <span className="wd-traffic">
            <i className="r" />
            <i className="y" />
            <i className="g" />
          </span>
          <span className="wd-fname">
            manuscript_{spec.abbrev.replace(/\s+/g, '')}.docx
            <span className="wd-saved">{applying ? 'Applying…' : 'Saved'}</span>
          </span>
        </div>

        <div className="wd-tabs">
          {['File', 'Home', 'Insert', 'Layout', 'References', 'Review', 'View'].map((t) => (
            <span key={t} className={t === 'Home' ? 'on' : undefined}>
              {t}
            </span>
          ))}
        </div>

        {/* Ribbon: the font + paragraph boxes are the live spec readout. */}
        <div className="wd-ribbon">
          <div className="wd-grp">
            <div className="wd-row">
              <span className={`wd-box wd-font${fontUnspecified ? ' muted' : ''}`}>{fontLabel}</span>
              <span className={`wd-box wd-size${fontUnspecified ? ' muted' : ''}`}>{sizeLabel}</span>
            </div>
            <div className="wd-lbl">Font{fontUnspecified ? ' (yours)' : ''}</div>
          </div>
          <div className="wd-grp">
            <div className="wd-row">
              <span className="wd-btn b">B</span>
              <span className="wd-btn i">I</span>
              <span className="wd-btn u">U</span>
              <span className={`wd-box wd-space${layout.lineSpacing ? '' : ' muted'}`}>
                {layout.lineSpacing ? SPACING_LABEL[layout.lineSpacing] : 'Not specified'}
              </span>
            </div>
            <div className="wd-lbl">Paragraph{layout.lineSpacing ? '' : ' (yours)'}</div>
          </div>
          <div className="wd-grp">
            <div className="wd-row">
              <span className={`wd-box${showLineNos ? ' on' : ''}`}>
                {showLineNos ? 'Line numbers: on' : 'Line numbers: off'}
              </span>
            </div>
            <div className="wd-lbl">Layout</div>
          </div>
          <div className="wd-grp">
            <div className="wd-row">
              <span className="wd-box on">{references.style.toUpperCase()}</span>
            </div>
            <div className="wd-lbl">Citations &amp; Bibliography</div>
          </div>
        </div>

        <div className="wd-ruler" aria-hidden="true">
          {Array.from({ length: 17 }).map((_, i) => (
            <i key={i} className={i % 4 === 0 ? 'maj' : undefined} />
          ))}
        </div>

        {/* ---------- PAGE ---------- */}
        <div className="wd-canvas">
          <div className={`wd-page${applying ? ' applying' : ''}`}>
            <div
              className="wd-body"
              style={{ ...docStyle, padding: layout.marginMm ? '30px 34px' : '26px 30px' }}
            >
              {showLineNos && (
                <div className="wd-lineno" aria-hidden="true">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
              )}
              <p className="wd-h1">
                Bilateral exertional compartment syndrome of the forearms: a case report
              </p>
              {/* Byline is fixed. et_al_threshold governs the REFERENCE LIST, not
                  the author byline — an earlier draft of this component shortened
                  the byline with it, which misrepresented our own rule. It is
                  surfaced in the status bar instead, where it belongs. */}
              <p className="wd-auth">K. Parhar, MD; M. Kaur, MD; S. Lal, MS</p>
              <p className="wd-p">
                A 24-year-old competitive sport climber presented with bilateral forearm pain and
                paresthesia after sustained gripping, with symptoms resolving at rest and recurring
                reproducibly on exertion.
              </p>
              <p className="wd-p">
                Intracompartmental pressure testing confirmed the diagnosis, as previously described
                <Citation spec={spec} />
              </p>
              <p className="wd-p wd-dim">
                Fasciotomy of the volar and dorsal compartments was performed bilaterally, with full
                return to climbing at twelve weeks.
              </p>
            </div>
            {layout.marginMm && <span className="wd-margin-tag">{layout.marginMm} mm margins</span>}
          </div>
        </div>

        {/* ---------- STATUS BAR ---------- */}
        <div className="wd-status">
          <span>Page 1 of 7</span>
          <span>1,842 words</span>
          <span className="wd-spec">
            {spec.abbrev} ·{' '}
            {layout.lineSpacing ? SPACING_LABEL[layout.lineSpacing].toLowerCase() : 'spacing per your draft'} ·{' '}
            {references.style.toUpperCase()}
            {references.etAlThreshold ? ` · et al. past ${references.etAlThreshold}` : ''}
            {references.maxCount ? ` · max ${references.maxCount} refs` : ''}
          </span>
        </div>
      </div>

      {/* ---------- JOURNAL SWITCHER ---------- */}
      <div className="wd-switch">
        <span className="wd-switch-lbl">Format for:</span>
        <div className="wd-chips" role="group" aria-label="Preview formatting for a journal">
          {specs.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              className={`wd-chip${i === idx ? ' on' : ''}`}
              aria-pressed={i === idx}
              onClick={() => select(i, true)}
            >
              {s.abbrev}
            </button>
          ))}
        </div>
      </div>

      {/* Honest caption: what changed, and where the rules came from. */}
      <p className="wd-note">
        {fontUnspecified ? (
          <>
            <strong>{spec.name}</strong> publishes no font requirement, so the Studio keeps yours and says so in
            the report. It never invents a rule to fill the gap.
          </>
        ) : (
          <>
            Live preview of <strong>{spec.name}</strong>&apos;s actual encoded requirements.
          </>
        )}{' '}
        Read from its{' '}
        <a href={spec.guidelinesUrl} target="_blank" rel="noopener noreferrer">
          Guide for Authors ↗
        </a>
        , verified {spec.verifiedDate}.{' '}
        {!touched && !reduced && <span className="wd-hint">Pick a journal above to compare.</span>}
      </p>
    </div>
  )
}
