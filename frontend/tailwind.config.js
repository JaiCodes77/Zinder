/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: {
            DEFAULT: '#06b6d4',
            light: '#22d3ee',
            glow: 'rgba(6, 182, 212, 0.4)',
          },
          magenta: {
            DEFAULT: '#ec4899',
            light: '#f472b6',
            glow: 'rgba(236, 72, 153, 0.4)',
          },
          purple: {
            DEFAULT: '#8b5cf6',
            light: '#a78bfa',
            glow: 'rgba(139, 92, 246, 0.4)',
          },
        },
      },
      backgroundImage: {
        'night-sky': 'radial-gradient(circle at center, #0f172a 0%, #090d16 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orb-slow': 'float-orb 20s ease-in-out infinite',
      },
      keyframes: {
        'float-orb': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
        }
      }
    },
  },
  plugins: [],
}
