import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3999,
    strictPort: true,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' ws: wss:; media-src 'self' blob: https:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self';",
    },
    proxy: {
      '/__poxey_session': {
        target: 'http://localhost:3997',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__poxey_session/, '')
      },
      '/websockify': {
        target: 'ws://localhost:3997',
        ws: true,
        changeOrigin: true
      },
      '/audio': {
        target: 'ws://localhost:3998',
        ws: true,
        changeOrigin: true
      }
    }
  },
});
