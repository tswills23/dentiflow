/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #1E40AF)',
          50: 'var(--color-primary-50, #EFF6FF)',
          100: 'var(--color-primary-100, #DBEAFE)',
          200: 'var(--color-primary-200, #BFDBFE)',
          300: 'var(--color-primary-300, #93C5FD)',
          400: 'var(--color-primary-400, #60A5FA)',
          500: 'var(--color-primary-500, #3B82F6)',
          600: 'var(--color-primary-600, #2563EB)',
          700: 'var(--color-primary-700, #1D4ED8)',
          800: 'var(--color-primary-800, #1E40AF)',
          900: 'var(--color-primary-900, #1E3A8A)',
        },
        accent: {
          DEFAULT: 'var(--color-accent, #059669)',
          50: 'var(--color-accent-50, #ECFDF5)',
          100: 'var(--color-accent-100, #D1FAE5)',
          200: 'var(--color-accent-200, #A7F3D0)',
          300: 'var(--color-accent-300, #6EE7B7)',
          400: 'var(--color-accent-400, #34D399)',
          500: 'var(--color-accent-500, #10B981)',
          600: 'var(--color-accent-600, #059669)',
          700: 'var(--color-accent-700, #047857)',
          800: 'var(--color-accent-800, #065F46)',
          900: 'var(--color-accent-900, #064E3B)',
        },
        'sidebar-bg': 'var(--color-sidebar-bg, #151A1F)',
        'sidebar-text': 'var(--color-sidebar-text, #E8ECF0)',
      },
    },
  },
  plugins: [],
}
