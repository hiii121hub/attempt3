import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3999,
    strictPort: true,
    proxy: {
      '/__poxey_session': {
        target: 'http://localhost:3997',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__poxey_session/, '')
      },
      '^/(rfb\\.js|vnc\\.html|app|core|vendor|po|styles|images|favicon\\.ico).*': {
        target: 'http://localhost:6080',
        changeOrigin: true
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
