import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

// Favicon — echoes the new circular seal. At 64×64 there's no room for the
// encircling "ORTHOPEDIC SURGERY / CASE REPORTS · AND · SERIES" text, so we
// keep the ring structure + OSCRSJ wordmark (brand recognition is carried by
// the serif wordmark; the ring carries scholarly authority).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#3d2a18', // brown-dark — matches seal-dark backdrop
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          border: '2px solid #FFDBBB',
          boxShadow: 'inset 0 0 0 1px #FFDBBB',
          fontFamily: 'Georgia, serif',
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#FFDBBB',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}
        >
          OS
        </span>
      </div>
    ),
    { ...size }
  )
}
