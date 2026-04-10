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
        cream: '#FAF9F7',
        sand: '#F0EBE3',
        border: '#E5DDD5',
        coral: {
          DEFAULT: '#D97757',
          dark: '#C46442',
          light: '#F0C4B0',
        },
        charcoal: {
          DEFAULT: '#1A1A1A',
          muted: '#6B6560',
          light: '#9C9490',
        },
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
