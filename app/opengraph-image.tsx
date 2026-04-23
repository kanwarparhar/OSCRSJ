import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Default Open Graph card — rebuilt 2026-04-19 to mirror the new "Masthead"
// brand lockup (PEER REVIEWED · QUARTERLY eyebrow → OSCRSJ wordmark →
// diamond rule → italic subtitle). Renders identically across LinkedIn,
// Twitter/X, iMessage, Slack, WhatsApp.
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#3d2a18', // brown-dark, matches masthead-dark.svg
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
        {/* Top peach accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: '#FFDBBB',
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            fontSize: 22,
            color: '#F0C49A',
            letterSpacing: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          Peer Reviewed · Quarterly
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 196,
            fontWeight: 700,
            letterSpacing: '-6px',
            lineHeight: 1,
            color: '#FFDBBB',
            marginBottom: 20,
          }}
        >
          OSCRSJ
        </div>

        {/* Diamond rule */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div style={{ width: 180, height: 1.2, background: '#997E67' }} />
          <div
            style={{
              width: 12,
              height: 12,
              background: '#997E67',
              transform: 'rotate(45deg)',
            }}
          />
          <div style={{ width: 180, height: 1.2, background: '#997E67' }} />
        </div>

        {/* Italic subtitle */}
        <div
          style={{
            fontStyle: 'italic',
            fontSize: 34,
            color: '#FFDBBB',
            letterSpacing: '0.5px',
            textAlign: 'center',
            maxWidth: 960,
            lineHeight: 1.35,
            marginBottom: 40,
          }}
        >
          Orthopedic Surgery Case Reports &amp; Series Journal
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 12 }}>
          {['Peer-Reviewed', 'Open Access', 'DOI Registered'].map((badge) => (
            <div
              key={badge}
              style={{
                background: 'rgba(255,219,187,0.08)',
                border: '1px solid rgba(255,219,187,0.28)',
                borderRadius: 24,
                padding: '8px 22px',
                fontSize: 18,
                color: '#F0C49A',
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
            color: '#FFDBBB',
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
