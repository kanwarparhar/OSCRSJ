/**
 * OSCRSJ DOI identity — pure, dependency-free.
 *
 * Deliberately its own module: this is imported by the admin metadata editor
 * (a client component) as well as by the server-side publish pipeline.
 * Keep it free of `server-only`, node builtins, and Supabase imports.
 */

// ---- DOI identity (Crossref prefix 10.67687, member ID 57458) ----
// Locked 2026-08-02 (decision D1): the DOI derives 1:1 from the globally
// unique, never-reset elocation_id. No year segment — year-drift under
// continuous publication and eLoc<->DOI divergence are the failure modes that
// bite. This mapping is PERMANENT once the first DOI is deposited.
export const DOI_PREFIX = '10.67687'
export const DOI_SUFFIX_NS = 'oscrsj'

export function buildDoi(elocationId: string): string {
  return `${DOI_PREFIX}/${DOI_SUFFIX_NS}.${elocationId}`
}

export function isValidOscrsjDoi(doi: string | null | undefined): boolean {
  if (!doi) return false
  return /^10\.67687\/oscrsj\.e\d{4,}$/.test(doi.trim())
}

/**
 * Pure identity gate for the render payload. Returns blocking errors; an
 * empty array means the manuscript may be rendered.
 *
 * There are deliberately NO fallbacks here. Until 2026-08-10 this module
 * defaulted a missing elocation to 'e0001' and a missing DOI to
 * `10.XXXXX/oscrsj.{year}.{eloc}`. Both fired on all six published articles
 * and baked an unresolvable, clickable DOI into every PDF page-1 ID bar, XMP
 * packet and JATS <article-id>. A fabricated permanent identifier is strictly
 * worse than a failed render.
 */
export function validateRenderIdentity(
  elocationId: string | null | undefined,
  doi: string | null | undefined
): string[] {
  const errs: string[] = []
  const eloc = (elocationId || '').trim()
  const d = (doi || '').trim()

  if (!eloc) {
    errs.push(
      'Manuscript has no elocation_id. Identity is allocated at acceptance — re-run the acceptance decision or set it before render.'
    )
  } else if (!/^e\d{4,}$/.test(eloc)) {
    errs.push(`elocation_id "${eloc}" is malformed (expected eNNNN, e.g. e0001).`)
  }

  if (!d) {
    errs.push(
      'Manuscript has no DOI. DOIs are system-minted at acceptance — re-run the acceptance decision before render.'
    )
  } else if (!isValidOscrsjDoi(d)) {
    errs.push(
      `DOI "${d}" is not a valid OSCRSJ DOI (expected ${DOI_PREFIX}/${DOI_SUFFIX_NS}.eNNNN). Placeholder DOIs must never reach a render.`
    )
  } else if (eloc && d !== buildDoi(eloc)) {
    errs.push(`DOI "${d}" does not match elocation_id "${eloc}" (expected ${buildDoi(eloc)}).`)
  }

  return errs
}
