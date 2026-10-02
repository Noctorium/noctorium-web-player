import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * In development the page is served by Vite and everything under /api goes to a `noctorium web` already
 * running on this computer, so the page can be worked on against a real library and a real queue.
 */
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:7300', ws: true, changeOrigin: false },
    },
  },
});
