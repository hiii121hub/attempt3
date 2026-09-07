import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/websockify': {
        target: 'ws://127.0.0.1:6080',
        ws: true,
        changeOrigin: true,
      },
      '/__poxey_admin': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    'process.env.VITE_GATEWAY_URL': JSON.stringify(
      process.env.VITE_GATEWAY_URL || 'http://localhost:8787'
    ),
  },
  optimizeDeps: {
    exclude: ['novnc'],
  },
})
