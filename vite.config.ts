import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/visus/',   // <--- NAZWA REPO
  //base: './', // Important for GitHub Pages relative paths
})