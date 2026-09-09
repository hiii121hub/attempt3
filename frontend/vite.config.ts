import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3999,

    proxy: {
      '/__poxey_session': {
        target: 'http://127.0.0.1:3997',
        changeOrigin: true,
rewrite: (path) => path.replace('/__poxey_session', '/session'),
      },

      '/audio': {
        target: 'ws://127.0.0.1:3998',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReqWs', (_proxyReq, req) => {
            console.log('[Poxey Audio WS proxy] upgrade', req.url)
          })
          proxy.on('error', (err, req) => {
            console.error('[Poxey Audio WS proxy] error', req.url, err.message)
          })
          proxy.on('open', () => {
            console.log('[Poxey Audio WS proxy] target connected')
          })
          proxy.on('close', () => {
            console.log('[Poxey Audio WS proxy] target closed')
          })
        },
      },
      '/websockify': {
        target: 'ws://127.0.0.1:6080',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReqWs', (_proxyReq, req) => {
            console.log('[Poxey WS proxy] upgrade', req.url)
          })
          proxy.on('error', (err, req) => {
            console.error('[Poxey WS proxy] error', req.url, err.message)
          })
          proxy.on('open', () => {
            console.log('[Poxey WS proxy] target connected')
          })
          proxy.on('close', () => {
            console.log('[Poxey WS proxy] target closed')
          })
        },
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
      process.env.VITE_GATEWAY_URL ||
        'http://localhost:8787'
    ),
  },

  optimizeDeps: {
    exclude: ['novnc'],
  },

  test: {
    environment: 'jsdom',
    globals: true,
  },
})
