import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        white: '#FFFFFF',
        peach: '#FFDBBB',
        'peach-dark': '#F0C49A',
        taupe: '#CCBEB1',
        tan: '#997E67',
        brown: {
          DEFAULT: '#664930',
          dark: '#3d2a18',
        },
        ink: '#120D08',
        dark: {
          DEFAULT: '#1c0f05',
          card: '#261609',
          mid: '#2e1a0b',
        },
        cream: {
          DEFAULT: '#FDFBF8',
          alt: '#F8F4ED',
        },
        border: 'rgba(153,126,103,0.18)',
        // "Swiss editorial" palette for the standalone Journal Formatter world
        // (app/(formatter)/*). Additive + prefixed so it never collides with the
        // OSCRSJ "Neutral Elegance" tokens above. Keep in sync with the CSS vars
        // in app/(formatter)/formatter.css. Usage: text-fmt-ink, bg-fmt-paper, etc.
        fmt: {
          paper: '#FFFFFF',
          surface: '#FAFAFC',
          ink: '#0A0A0F',
          'ink-2': '#52525E',
          'ink-3': '#9494A1',
          hairline: '#E8E8EC',
          // OSCRSJ signature brown (Kanwar directive 2026-07-15) — mirrors the
          // site's brown / brown-dark / cream-alt tokens.
          accent: '#664930',
          'accent-deep': '#3D2A18',
          'accent-wash': '#F5EFE8',
          ok: '#147A4D',
          warn: '#A16207',
          bad: '#B3261E',
        },
      },
      fontFamily: {
        serif: ['DM Serif Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Formatter world type (next/font provides the --fmt-font-* vars in the layout)
        'fmt-display': ['var(--fmt-font-display)', 'Inter Tight', 'system-ui', 'sans-serif'],
        'fmt-body': ['var(--fmt-font-body)', 'Inter', 'system-ui', 'sans-serif'],
        'fmt-mono': ['var(--fmt-font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        'fmt-brand': ['var(--fmt-font-brand)', 'DM Serif Display', 'Georgia', 'serif'],
      },
      maxWidth: {
        content: '1100px',
      },
    },
  },
  plugins: [],
}
export default config
