/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Domyślnie budujemy pod GitHub Pages (/visus/). Można nadpisać VITE_BASE gdy trzeba.
const base = process.env.VITE_BASE || '/visus/'

export default defineConfig({
  plugins: [react()],
  // Default production base (main). Override with VITE_BASE for test builds.
  base,
})
