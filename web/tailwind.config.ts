import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VirtualPBX Dark Professional Palette
        'navy-dark': {
          DEFAULT: '#0f1419',
          panel: '#1a2332',
          elevated: '#233044',
          border: '#2d3f56',
        },
        'slate-blue': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
        },
        // Status Colors (matching VirtualPBX)
        status: {
          'in-call': '#ef4444',
          available: '#10b981',
          waiting: '#f59e0b',
          resolved: '#06b6d4',
          offline: '#6b7280',
        },
        // Chart Colors (Teal Gradient Stack)
        chart: {
          teal: {
            dark: '#0d9488',
            DEFAULT: '#14b8a6',
            light: '#2dd4bf',
          },
          cyan: {
            dark: '#0891b2',
            DEFAULT: '#06b6d4',
            light: '#22d3ee',
          },
        },
        // Accent Colors
        accent: {
          primary: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        'metric-large': [
          '3.5rem',
          { lineHeight: '1', fontWeight: '700' },
        ],
        'metric-medium': [
          '2rem',
          { lineHeight: '1.2', fontWeight: '600' },
        ],
      },
      borderRadius: {
        panel: '0.75rem',
      },
      boxShadow: {
        panel: '0 2px 8px 0 rgba(0, 0, 0, 0.4)',
        'panel-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.5)',
        'inset-panel': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-area':
          'linear-gradient(180deg, rgba(20, 184, 166, 0.4) 0%, rgba(6, 182, 212, 0.2) 100%)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};

export default config;
