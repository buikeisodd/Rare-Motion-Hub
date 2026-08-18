/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
        colors: {
          rmh: {
            bg: 'var(--rmh-bg)',
            'bg-elevated': 'var(--rmh-bg-elevated)',
            panel: 'var(--rmh-panel)',
            'panel-soft': 'var(--rmh-panel-soft)',
            'panel-hover': 'var(--rmh-panel-hover)',
            ink: 'var(--rmh-ink)',
            'ink-strong': 'var(--rmh-ink-strong)',
            muted: 'var(--rmh-muted)',
            subtle: 'var(--rmh-subtle)',
            accent: 'var(--rmh-accent)',
            'accent-soft': 'var(--rmh-accent-soft)',
            'accent-hover': 'var(--rmh-accent-hover)',
            danger: 'var(--rmh-danger)',
            info: 'var(--rmh-info)',
            border: 'var(--rmh-border)',
            'border-strong': 'var(--rmh-border-strong)',
          },
          primary: {
            background: 'var(--rmh-bg)',
            label: 'var(--rmh-ink)',
          },
          secondary: {
            label: 'var(--rmh-muted)',
          },
          accent: {
            DEFAULT: '#D7FF65',
            hover: '#E3FF91',
            soft: 'rgba(215,255,101,.12)',
          },
          shading: 'var(--rmh-panel)',
          border: 'rgba(255,255,255,.09)',
          highlight: 'var(--rmh-panel-hover)',
        },
      fontFamily: {
        sans: ['Outfit', 'DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'Syne', 'sans-serif'],
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
