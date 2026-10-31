import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// One bundle, no lazy chunks, so the service worker can cache everything after the first load.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 900, rollupOptions: { output: { inlineDynamicImports: true } } },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8000', rewrite: (p) => p.replace(/^\/api/, '') } } },
});
