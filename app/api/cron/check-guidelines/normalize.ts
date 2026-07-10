// ============================================================
// Guidelines fetch → normalize → SHA-256 recipe (TypeScript)
// ============================================================
// Byte-identical reimplementation of the canonical recipe documented in
// lib/formatting/journals/README.md ("source_hash — reproducible fetch +
// normalize + hash"). The rule files store `identity.source_hash` = the
// SHA-256 (hex) of the NORMALIZED guide text produced by that recipe. The
// monthly freshness cron (./route.ts) re-runs this and diffs the hash.
//
// Recipe (must stay in lock-step with the Python reference one-liner):
//   1. (fetch is the caller's job)
//   2. Remove <script>…</script> and <style>…</style> (case-insensitive,
//      dotall).
//   3. Strip all remaining tags (<[^>]+> → single space).
//   4. HTML-unescape entities.
//   5. Collapse whitespace runs → single space, trim, lowercase.
//   6. sha256 hex of the UTF-8 bytes.
//
// These two functions are exported standalone so a future headless
// (browser-rendered) fetch path can reuse the identical normalize+hash
// without duplicating the recipe.
// ============================================================

import { createHash } from 'node:crypto'

// ------------------------------------------------------------
// HTML entity decoding
// ------------------------------------------------------------
// Python's `html.unescape` resolves the full HTML5 named-entity table plus
// numeric refs (with the Windows-1252 remap for 0x80–0x9F and control-char
// stripping). Guide-for-authors body text — after tags are stripped — only
// ever carries the HTML4 named set plus decimal/hex numeric refs, so we
// reproduce exactly that surface. The complete HTML4 name→codepoint table:
const HTML4_ENTITY_CODEPOINTS: Record<string, number> = {
  quot: 34, amp: 38, apos: 39, lt: 60, gt: 62,
  nbsp: 160, iexcl: 161, cent: 162, pound: 163, curren: 164, yen: 165,
  brvbar: 166, sect: 167, uml: 168, copy: 169, ordf: 170, laquo: 171,
  not: 172, shy: 173, reg: 174, macr: 175, deg: 176, plusmn: 177,
  sup2: 178, sup3: 179, acute: 180, micro: 181, para: 182, middot: 183,
  cedil: 184, sup1: 185, ordm: 186, raquo: 187, frac14: 188, frac12: 189,
  frac34: 190, iquest: 191, Agrave: 192, Aacute: 193, Acirc: 194,
  Atilde: 195, Auml: 196, Aring: 197, AElig: 198, Ccedil: 199, Egrave: 200,
  Eacute: 201, Ecirc: 202, Euml: 203, Igrave: 204, Iacute: 205, Icirc: 206,
  Iuml: 207, ETH: 208, Ntilde: 209, Ograve: 210, Oacute: 211, Ocirc: 212,
  Otilde: 213, Ouml: 214, times: 215, Oslash: 216, Ugrave: 217, Uacute: 218,
  Ucirc: 219, Uuml: 220, Yacute: 221, THORN: 222, szlig: 223, agrave: 224,
  aacute: 225, acirc: 226, atilde: 227, auml: 228, aring: 229, aelig: 230,
  ccedil: 231, egrave: 232, eacute: 233, ecirc: 234, euml: 235, igrave: 236,
  iacute: 237, icirc: 238, iuml: 239, eth: 240, ntilde: 241, ograve: 242,
  oacute: 243, ocirc: 244, otilde: 245, ouml: 246, divide: 247, oslash: 248,
  ugrave: 249, uacute: 250, ucirc: 251, uuml: 252, yacute: 253, thorn: 254,
  yuml: 255,
  // Latin Extended / punctuation / symbols
  fnof: 402, circ: 710, tilde: 732,
  Alpha: 913, Beta: 914, Gamma: 915, Delta: 916, Epsilon: 917, Zeta: 918,
  Eta: 919, Theta: 920, Iota: 921, Kappa: 922, Lambda: 923, Mu: 924,
  Nu: 925, Xi: 926, Omicron: 927, Pi: 928, Rho: 929, Sigma: 931, Tau: 932,
  Upsilon: 933, Phi: 934, Chi: 935, Psi: 936, Omega: 937,
  alpha: 945, beta: 946, gamma: 947, delta: 948, epsilon: 949, zeta: 950,
  eta: 951, theta: 952, iota: 953, kappa: 954, lambda: 955, mu: 956,
  nu: 957, xi: 958, omicron: 959, pi: 960, rho: 961, sigmaf: 962,
  sigma: 963, tau: 964, upsilon: 965, phi: 966, chi: 967, psi: 968,
  omega: 969, thetasym: 977, upsih: 978, piv: 982,
  OElig: 338, oelig: 339, Scaron: 352, scaron: 353, Yuml: 376,
  ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204, zwj: 8205, lrm: 8206,
  rlm: 8207, ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218,
  ldquo: 8220, rdquo: 8221, bdquo: 8222, dagger: 8224, Dagger: 8225,
  bull: 8226, hellip: 8230, permil: 8240, prime: 8242, Prime: 8243,
  lsaquo: 8249, rsaquo: 8250, oline: 8254, frasl: 8260, euro: 8364,
  weierp: 8472, image: 8465, real: 8476, trade: 8482, alefsym: 8501,
  larr: 8592, uarr: 8593, rarr: 8594, darr: 8595, harr: 8596, crarr: 8629,
  lArr: 8656, uArr: 8657, rArr: 8658, dArr: 8659, hArr: 8660, forall: 8704,
  part: 8706, exist: 8707, empty: 8709, nabla: 8711, isin: 8712, notin: 8713,
  ni: 8715, prod: 8719, sum: 8721, minus: 8722, lowast: 8727, radic: 8730,
  prop: 8733, infin: 8734, ang: 8736, and: 8743, or: 8744, cap: 8745,
  cup: 8746, int: 8747, there4: 8756, sim: 8764, cong: 8773, asymp: 8776,
  ne: 8800, equiv: 8801, le: 8804, ge: 8805, sub: 8834, sup: 8835,
  nsub: 8836, sube: 8838, supe: 8839, oplus: 8853, otimes: 8855, perp: 8869,
  sdot: 8901, lceil: 8968, rceil: 8969, lfloor: 8970, rfloor: 8971,
  lang: 9001, rang: 9002, loz: 9674, spades: 9824, clubs: 9827,
  hearts: 9829, diams: 9830,
}

const NAMED_ENTITIES: Record<string, string> = Object.fromEntries(
  Object.entries(HTML4_ENTITY_CODEPOINTS).map(([name, cp]) => [
    name,
    String.fromCodePoint(cp),
  ]),
)

// Windows-1252 remap for numeric refs in 0x80–0x9F, mirroring CPython's
// `html._invalid_charrefs`. Plus the two special-cased points 0x00 and 0x0D.
const INVALID_CHARREFS: Record<number, string> = {
  0x00: '�', 0x0d: '\r',
  0x80: '€', 0x81: '', 0x82: '‚', 0x83: 'ƒ',
  0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹',
  0x8c: 'Œ', 0x8d: '', 0x8e: 'Ž', 0x8f: '',
  0x90: '', 0x91: '‘', 0x92: '’', 0x93: '“',
  0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9d: '', 0x9e: 'ž', 0x9f: 'Ÿ',
}

// Control-char codepoints CPython's `html._invalid_codepoints` drops to ''.
const INVALID_CODEPOINTS = new Set<number>([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0b,
  0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
  0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x7f,
])

function decodeNumericRef(body: string): string {
  // `body` is everything after "&#": either "NNN" / "NNN;" (decimal) or
  // "xHH" / "xHH;" (hex). Matches CPython `html._replace_charref`.
  let num: number
  if (body[0] === 'x' || body[0] === 'X') {
    num = parseInt(body.slice(1).replace(/;$/, ''), 16)
  } else {
    num = parseInt(body.replace(/;$/, ''), 10)
  }
  if (Number.isNaN(num)) return `&#${body}`
  if (Object.prototype.hasOwnProperty.call(INVALID_CHARREFS, num)) {
    return INVALID_CHARREFS[num]
  }
  if ((num >= 0xd800 && num <= 0xdfff) || num > 0x10ffff) return '�'
  if (INVALID_CODEPOINTS.has(num)) return ''
  return String.fromCodePoint(num)
}

// Matches a numeric ref (&#…) or a named ref (&name;?). Named refs are the
// letters/digits after the ampersand, optionally semicolon-terminated.
const ENTITY_RE = /&(#[xX]?[0-9a-fA-F]+;?|[a-zA-Z][a-zA-Z0-9]*;?)/g

/** Decode HTML entities the way Python's `html.unescape` does (for the
 *  HTML4 named set + numeric refs — the surface real guide text uses). */
function htmlUnescape(input: string): string {
  return input.replace(ENTITY_RE, (match, ref: string) => {
    if (ref[0] === '#') return decodeNumericRef(ref.slice(1))
    const name = ref.replace(/;$/, '')
    const decoded = NAMED_ENTITIES[name]
    // Unknown named ref → leave the original text untouched (Python behaviour).
    return decoded !== undefined ? decoded : match
  })
}

/**
 * Normalize fetched guide HTML to the canonical comparison text.
 * Byte-identical to the README recipe (steps 2–5).
 */
export function normalizeGuideText(html: string): string {
  let t = html
  // 2. strip <script> / <style> blocks (case-insensitive, dotall). We use
  //    [\s\S] rather than the `s` (dotall) flag so the recipe compiles under
  //    the repo's pre-es2018 tsconfig target while staying byte-identical.
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // 3. strip all remaining tags → single space
  t = t.replace(/<[^>]+>/g, ' ')
  // 4. HTML-unescape
  t = htmlUnescape(t)
  // 5. collapse whitespace → single space, trim, lowercase
  t = t.replace(/\s+/g, ' ').trim().toLowerCase()
  return t
}

/** SHA-256 (hex) of the normalized guide text — this is `identity.source_hash`. */
export function hashGuideText(html: string): string {
  return createHash('sha256')
    .update(Buffer.from(normalizeGuideText(html), 'utf8'))
    .digest('hex')
}

/**
 * A journal whose stored hash is of a bot-blocked / Cloudflare / CAPTCHA
 * shell or an Internet Archive snapshot (not the live page). A plain fetch
 * of these will almost always come back `changed` or `unreachable`, so the
 * cron routes them to a "needs headless re-check" bucket instead of the
 * genuine-change bucket. Detected from the free-text `identity.source_note`.
 */
const BLOCKED_NOTE_RE = /blocked|cloudflare|captcha|archive|shell|headless/i

export function isBlockedSourceNote(sourceNote: string | null | undefined): boolean {
  return sourceNote ? BLOCKED_NOTE_RE.test(sourceNote) : false
}
