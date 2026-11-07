// Offline contracts: keep the exact deployed Studio typography while avoiding
// the Google Fonts extensionless-URL build failure (Next.js issue #99114).
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const manifest = JSON.parse(read('public/fonts/studio/sources.json'))
const css = read('app/(formatter)/fonts.css')
const layout = read('app/(formatter)/layout.tsx')

test('Studio font faces preserve production weights, subsets and fallback metrics', () => {
  const faces = css.match(/@font-face\{[^}]+\}/g) || []
  assert.equal(faces.length, manifest.fontFaceCount)
  assert.equal(sha(faces.join('\n').replaceAll('/fonts/studio/', '/_next/static/media/')), manifest.fontFacesSha256)
  assert.ok(css.includes(manifest.variableDeclarations))
  assert.ok(css.includes('.fmt-fonts {'))
  assert.ok(layout.includes('fmt-root fmt-fonts flex-1'))
})

test('Studio font assets are the exact production WOFF2 bytes', () => {
  assert.equal(manifest.fonts.length, 22)
  for (const entry of manifest.fonts) {
    const bytes = readFileSync(resolve(root, 'public/fonts/studio', entry.file))
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', entry.file)
    assert.equal(bytes.length, entry.bytes, entry.file)
    assert.equal(sha(bytes), entry.sha256, entry.file)
    assert.ok(css.includes('/fonts/studio/' + entry.file), entry.file)
  }
})

test('Studio fonts keep all four Latin preloads and never fetch Google during build', () => {
  const preloads = manifest.fonts.filter((entry: { preload: boolean }) => entry.preload)
  assert.equal(preloads.length, 4)
  assert.equal((layout.match(/rel="preload"/g) || []).length, 4)
  for (const entry of preloads) assert.ok(layout.includes('href="/fonts/studio/' + entry.file + '"'))
  assert.ok(!layout.includes('next/font/google'))
  assert.ok(!css.includes('fonts.googleapis.com'))
  assert.ok(!css.includes('fonts.gstatic.com'))
})

test('Bundled fonts preserve their upstream OFL licenses', () => {
  assert.equal(manifest.licenses.length, 4)
  for (const entry of manifest.licenses) {
    const text = read('public/fonts/studio/' + entry.file)
    assert.ok(text.includes('SIL OPEN FONT LICENSE'))
    assert.equal(sha(text), entry.sha256)
  }
})
