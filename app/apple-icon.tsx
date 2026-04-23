import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Apple touch icon — shown on iOS home screens when users "Add to Home Screen"
// on oscrsj.com. Mirrors the circular seal backdrop + serif OSCRSJ wordmark
// without the encircling micro-text (which would be unreadable at 180px).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#3d2a18',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          border: '4px solid #FFDBBB',
          boxShadow: 'inset 0 0 0 2px #FFDBBB',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            fontSize: 54,
            fontWeight: 700,
            color: '#FFDBBB',
            letterSpacing: '-3px',
            lineHeight: 1,
          }}
        >
          OSCRSJ
        </div>
        <div
          style={{
            width: 36,
            height: 1,
            background: '#997E67',
            marginTop: 10,
            marginBottom: 8,
          }}
        />
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: '#F0C49A',
            letterSpacing: '3px',
          }}
        >
          MMXXVI
        </div>
      </div>
    ),
    { ...size }
  )
}
