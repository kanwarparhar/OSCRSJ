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
        ink: '#1a1410',
        dark: {
          DEFAULT: '#1c0f05',
          card: '#261609',
          mid: '#2e1a0b',
        },
        cream: {
          DEFAULT: '#FFF5EB',
          alt: '#F5EAE0',
        },
        border: 'rgba(153,126,103,0.18)',
      },
      fontFamily: {
        serif: ['DM Serif Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '1100px',
      },
    },
  },
  plugins: [],
}
export default config
