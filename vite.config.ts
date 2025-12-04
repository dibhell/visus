import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dedykowany prefix dla środowiska testowego (Gałąź tst -> GitHub Pages /visus-tst/)
  base: '/visus-tst/',
})
