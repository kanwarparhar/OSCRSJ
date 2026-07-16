'use client'

import { useEffect, useState } from 'react'

const SEEN_KEY = 'fmt-intro-seen'

/**
 * OSCRSJ → Formatter entry animation (brief §7 / D5). Plays once per browser
 * session (sessionStorage), skips entirely under prefers-reduced-motion (also
 * enforced in CSS), and is a position:fixed overlay so it costs zero layout
 * shift — the page content is server-rendered beneath it and stays crawlable.
 */
export default function IntroTransition() {
  // 'pending' = pre-decision (SSR + first client paint: plain white cover);
  // 'play' = run the animation; 'done' = unmounted.
  const [state, setState] = useState<'pending' | 'play' | 'done'>('pending')

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let seen = false
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === '1'
    } catch {
      seen = false
    }
    if (reduce || seen) {
      setState('done')
      return
    }
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* private mode — play once, don't persist */
    }
    setState('play')
    const t = window.setTimeout(() => setState('done'), 1900)
    return () => window.clearTimeout(t)
  }, [])

  if (state === 'done') return null

  return (
    <div className={`fmt-intro${state === 'play' ? ' play' : ''}`} aria-hidden="true">
      <div className="stage">
        <div className="oscrsj">OSCRSJ</div>
        <div className="rule" />
        <div className="presents">presents</div>
      </div>
      <div className="jf">
        <div className="name">Submission Studio</div>
        <div className="by">by OSCRSJ</div>
      </div>
    </div>
  )
}
