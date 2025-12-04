import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dedicated path for the test site on GitHub Pages.
  base: '/visus/visus-tst/',
})
