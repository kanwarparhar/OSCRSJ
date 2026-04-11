import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FAF9F7',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
        }}
      >
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 24,
            fontWeight: 700,
            color: '#D97757',
            lineHeight: 1,
            letterSpacing: '-1px',
          }}
        >
          O
        </span>
      </div>
    ),
    { ...size }
  )
}
