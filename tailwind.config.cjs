/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './ExperimentalApp.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#a78bfa',
        accent2: '#2dd4bf',
        surface: '#18181b',
        panel: 'rgba(15, 23, 42, 0.85)',
        sync1: '#f472b6',
        sync2: '#38bdf8',
        sync3: '#fbbf24',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'in': 'fade-in 0.3s ease-out',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
