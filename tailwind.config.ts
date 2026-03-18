import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
        },
        accent: {
          orange: 'var(--color-accent-orange)',
          green: 'var(--color-accent-green)',
          yellow: 'var(--color-accent-yellow)',
        },
        dark: 'var(--color-dark)',
        gray: {
          50: 'var(--color-gray-50)',
          100: 'var(--color-gray-100)',
          200: 'var(--color-gray-200)',
          400: 'var(--color-gray-400)',
          600: 'var(--color-gray-600)',
          800: 'var(--color-gray-800)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      fontWeight: {
        'display-700': '700',
        'display-800': '800',
        'body-300': '300',
        'body-400': '400',
        'body-500': '500',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        floating: 'var(--shadow-floating)',
        'primary-glow': 'var(--shadow-primary-glow)',
      },
      keyframes: {
        'float-card': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'float-card': 'float-card 5.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
