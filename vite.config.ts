/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Default to root; override VITE_BASE=/visus/ for GitHub Pages builds
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  plugins: [react()],
  // Default production base (main). Override with VITE_BASE for test builds.
  base,
})
