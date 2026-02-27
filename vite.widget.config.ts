import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/widget/main.tsx',
      name: 'LoyalUpWidget',
      formats: ['iife'],
      fileName: () => 'loyalup-widget.js',
    },
    outDir: 'dist/widget',
    emptyOutDir: true,
  },
})
