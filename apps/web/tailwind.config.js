/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
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
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        surface: {
          base: '#070B12',
          canvas: '#0B0F17',
          card: '#111827',
          'card-hover': '#151F32',
          elevated: '#1A2438',
          border: '#1F293D',
          'border-subtle': '#162033',
          'border-light': '#2B3852',
        },
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        'card-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.65)',
        'glow-brand': '0 0 25px -5px rgba(37, 99, 235, 0.3)',
        'glow-deal': '0 0 25px -5px rgba(16, 185, 129, 0.3)',
      },
    },
  },
  plugins: [],
};
