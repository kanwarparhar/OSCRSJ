import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon — shown by browsers and Google Search at 16–32px.
// Design rules at favicon scale:
//   • Use a square/rounded-square, NOT a circle — circles lose shape at 16px
//     and become indistinguishable colored blobs.
//   • One glyph only — "O" is the recognizable anchor of OSCRSJ and is
//     legible at any size. "OS" at fontSize 22 in 64px becomes invisible at 16px.
//   • Oversized glyph (24px in 32px canvas) fills the available space so it
//     doesn't get lost when the browser downscales to 16px.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#3d2a18',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          fontFamily: 'Georgia, serif',
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#FFDBBB',
            lineHeight: 1,
          }}
        >
          O
        </span>
      </div>
    ),
    { ...size }
  )
}
