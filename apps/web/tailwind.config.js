/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        deal: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        surface: {
          canvas:         '#090D16',
          base:           '#0D1322',
          card:           '#131B2E',
          'card-hover':   '#17223B',
          elevated:       '#1C2846',
          border:         'rgba(255,255,255,0.08)',
          'border-subtle':'rgba(255,255,255,0.04)',
          'border-hover': 'rgba(255,255,255,0.16)',
          'border-light': 'rgba(255,255,255,0.12)',
        },
      },
      boxShadow: {
        // Optical shadows — no neon glow
        subtle:   '0 1px 2px 0 rgba(0,0,0,0.25)',
        card:     '0 4px 20px -2px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.06)',
        elevated: '0 12px 36px -4px rgba(0,0,0,0.65), inset 0 1px 0 0 rgba(255,255,255,0.08)',
        modal:    '0 24px 64px -8px rgba(0,0,0,0.8), inset 0 1px 0 0 rgba(255,255,255,0.07)',
        // Status glows — intentional, not default
        'glow-brand': '0 0 16px -2px rgba(59,130,246,0.35)',
        'glow-deal':  '0 0 16px -2px rgba(16,185,129,0.35)',
        'glow-amber': '0 0 16px -2px rgba(245,158,11,0.35)',
        'glow-rose':  '0 0 16px -2px rgba(244,63,94,0.35)',
      },
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      transitionTimingFunction: {
        'out-expo':    'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-expo': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'spring':      'cubic-bezier(0.175, 0.885, 0.32, 1.15)',
        'drawer':      'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      animation: {
        'fade-in':   'fade-in 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
        'scale-in':  'scale-in 180ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
        'slide-up':  'slide-up 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
      },
    },
  },
  plugins: [],
};
