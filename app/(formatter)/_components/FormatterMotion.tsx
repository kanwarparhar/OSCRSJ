'use client'

import { useEffect } from 'react'

/**
 * Scroll reveals + stat count-ups for the formatter world (brief §4.4), ported
 * from the approved mockup. Mounted once on the page; drives every `.reveal`
 * element and every `[data-count]` inside `.fmt-root`. Fully disabled under
 * prefers-reduced-motion (final values rendered immediately).
 */
export default function FormatterMotion() {
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>('.fmt-root .reveal'),
    )

    const renderCount = (el: HTMLElement, animate: boolean) => {
      const end = Number(el.dataset.count || '0')
      if (!animate) {
        el.textContent = end.toLocaleString()
        return
      }
      let start: number | null = null
      const step = (ts: number) => {
        if (start === null) start = ts
        const p = Math.min(1, (ts - start) / 1200)
        const eased = 1 - Math.pow(1 - p, 3)
        el.textContent = Math.round(end * eased).toLocaleString()
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    if (reduce) {
      reveals.forEach((el) => el.classList.add('in'))
      document
        .querySelectorAll<HTMLElement>('.fmt-root [data-count]')
        .forEach((el) => renderCount(el, false))
      return
    }

    // Every .reveal starts at opacity 0 and is only shown by this observer, so
    // if the observer never delivers a callback the page stays blank below the
    // fold with no error anywhere. IntersectionObserver is tied to the rendering
    // lifecycle, so anything that stops it (a throw before this runs, an engine
    // without IO) is an invisible-content bug rather than a missing animation.
    // The observer always fires at least once for the hero, so "zero callbacks
    // after 2.5s" is a reliable signal that the system is dead. Show everything
    // and stop. Franklin, 2026-07-25.
    let delivered = 0
    const watchdog = window.setTimeout(() => {
      if (delivered > 0) return
      io.disconnect()
      reveals.forEach((el) => el.classList.add('in'))
      document
        .querySelectorAll<HTMLElement>('.fmt-root [data-count]')
        .forEach((el) => renderCount(el, false))
    }, 2500)

    const io = new IntersectionObserver(
      (entries) => {
        delivered += 1
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const parent = el.parentElement
          const sibs = parent
            ? Array.from(parent.querySelectorAll<HTMLElement>(':scope > .reveal'))
            : [el]
          const delay = Math.max(0, sibs.indexOf(el)) * 70
          window.setTimeout(() => el.classList.add('in'), delay)
          el.querySelectorAll<HTMLElement>('[data-count]').forEach((c) =>
            renderCount(c, true),
          )
          io.unobserve(el)
        })
      },
      { threshold: 0.2 },
    )

    reveals.forEach((el) => io.observe(el))
    return () => {
      window.clearTimeout(watchdog)
      io.disconnect()
    }
  }, [])

  return null
}
