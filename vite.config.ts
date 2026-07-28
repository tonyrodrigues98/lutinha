import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/health': 'http://localhost:3001',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
