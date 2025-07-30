/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2d334a',
        background: '#f3f3f3',
        'primary-hover': '#1a1f2e',
        'background-dark': '#1a1a1a',
        'text-primary': '#2d334a',
        'text-secondary': '#6b7280',
        'border-light': '#e5e7eb',
        'success': '#10b981',
        'error': '#ef4444',
        'warning': '#f59e0b',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'button': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
} 