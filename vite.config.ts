import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3999,
    proxy: {
      '/__poxey_session': {
        target: 'http://localhost:3997',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__poxey_session/, ''),
      },
      '/websockify': {
        target: 'ws://localhost:6080',
        ws: true,
      },
      '/vnc.html': 'http://localhost:6080',
      '/app': 'http://localhost:6080',
      '/vendor': 'http://localhost:6080',
      '/po': 'http://localhost:6080',
      '/styles': 'http://localhost:6080',
    },
  },
});
