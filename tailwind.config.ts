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
        'bain-blue': '#003D82',
        'bain-green': '#00A86B',
        'bain-yellow': '#FFC72C',
        'bain-red': '#E63946',
      },
    },
  },
  plugins: [],
}
export default config

