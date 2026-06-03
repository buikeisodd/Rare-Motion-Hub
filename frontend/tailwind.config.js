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
          background: '#000000',
          label: '#ffffff',
        },
        secondary: {
          label: '#a3a3a3',
        },
        shading: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(255, 255, 255, 0.05)',
        highlight: 'rgba(255, 255, 255, 0.15)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Fallback if local fonts fail, Inter closely matches untitled's premium feel
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
