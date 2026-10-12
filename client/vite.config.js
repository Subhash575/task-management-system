import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: true, // listen on 0.0.0.0 so the dev server is reachable from outside the Docker container
    port: 5173,
    strictPort: true,
    proxy: {
      // The browser calls /api on the Vite origin, and Vite forwards it to Express.
      // Same-origin requests mean cookies "just work" in development without CORS issues.
      '/api': {
        // Not VITE_-prefixed on purpose: VITE_* variables can be exposed to browser code.
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
})
