import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Base path for deployment (e.g. '/' for Render, '/PROJECT-AANCHAL-/' for GitHub Pages)
  base: process.env.VITE_BASE_PATH || '/',

  server: {
    // Dev proxy: forwards /api/* requests to backend on port 5000
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
