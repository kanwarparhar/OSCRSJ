import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FAF9F7',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top coral accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: '#D97757',
          }}
        />


        {/* Main wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            fontSize: 128,
            fontWeight: 700,
            letterSpacing: '-4px',
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          <span style={{ color: '#D97757' }}>O</span>
          <span style={{ color: '#1A1A1A' }}>SCRSJ</span>
        </div>

        {/* Thin rule */}
        <div
          style={{
            width: 560,
            height: 2,
            background: '#E5DDD5',
            marginBottom: 28,
          }}
        />

        {/* Full journal name */}
        <div
          style={{
            fontSize: 28,
            color: '#6B6560',
            letterSpacing: '0.01em',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
            marginBottom: 40,
          }}
        >
          Orthopedic Surgery Case Reports &amp; Series Journal
        </div>

        {/* Badges */}
        <div
          style={{
            display: 'flex',
            gap: 12,
          }}
        >
          {['Peer-Reviewed', 'Open Access', 'DOI Registered'].map((badge) => (
            <div
              key={badge}
              style={{
                background: '#F0EBE3',
                border: '1px solid #E5DDD5',
                borderRadius: 24,
                padding: '8px 20px',
                fontSize: 18,
                color: '#6B6560',
                fontFamily: 'Georgia, serif',
              }}
            >
              {badge}
            </div>
          ))}
        </div>

        {/* Domain label */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 60,
            fontSize: 20,
            color: '#D97757',
            fontFamily: 'Georgia, serif',
            fontWeight: 600,
          }}
        >
          oscrsj.com
        </div>
      </div>
    ),
    { ...size }
  )
}
