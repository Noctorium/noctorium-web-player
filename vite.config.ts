import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * In development the page is served by Vite and everything under /api goes to a `noctorium web` already
 * running on this computer, so the page can be worked on against a real library and a real queue.
 *
 * `--mode hosted` builds the hosted player instead, the one on Vercel, which has no Noctorium behind it; see
 * src/hosted/. `npm run dev:hosted` runs that one against `vercel dev` on :3000 for its API.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: { __HOSTED__: JSON.stringify(mode === 'hosted') },
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
      '/api': mode === 'hosted'
        ? { target: 'http://127.0.0.1:3000', changeOrigin: false }
        : { target: 'http://127.0.0.1:7300', ws: true, changeOrigin: false },
    },
  },
}));
