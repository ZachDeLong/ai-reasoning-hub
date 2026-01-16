import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Playfair Display', 'Georgia', 'serif'],
        'sans': ['Source Sans 3', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        cream: '#FAF7F2',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
