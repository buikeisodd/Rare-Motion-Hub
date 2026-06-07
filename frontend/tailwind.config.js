/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          background: 'rgb(var(--color-primary-background) / <alpha-value>)',
          label: 'rgb(var(--color-primary-label) / <alpha-value>)',
        },
        secondary: {
          label: 'rgb(var(--color-secondary-label) / <alpha-value>)',
        },
        shading: 'rgb(var(--color-shading) / 0.08)',
        border: 'rgb(var(--color-border) / 0.05)',
        highlight: 'rgb(var(--color-highlight) / 0.15)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Fallback if local fonts fail, Inter closely matches untitled's premium feel
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'welcome-rise': 'welcomeRise 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        'record-float': 'recordFloat 2.6s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        welcomeRise: {
          '0%': { opacity: '0', transform: 'translateY(28px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        recordFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
