import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// USER website (phones). One bundle, no lazy chunks, so the service worker can cache everything after the first load.
// Output: dist/user. The admin website is a separate build (vite.admin.config.ts) and shares no entry point with this one.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/user', emptyOutDir: true, chunkSizeWarningLimit: 900, rollupOptions: { output: { inlineDynamicImports: true } } },
  server: { port: 3000, host: '0.0.0.0', proxy: { '/api': { target: 'http://127.0.0.1:8000', rewrite: (p) => p.replace(/^\/api/, '') } } },
});
