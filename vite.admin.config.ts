import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// ADMIN website (dashboard, projector ledger). Own root, own entry, no PWA files (publicDir off). Output: dist/admin.
export default defineConfig({
  root: 'admin-site',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist/admin', emptyOutDir: true, chunkSizeWarningLimit: 900, rollupOptions: { output: { inlineDynamicImports: true } } },
  server: { port: 3001, host: '0.0.0.0', fs: { allow: ['..'] }, proxy: { '/api': { target: 'http://127.0.0.1:8001', rewrite: (p) => p.replace(/^\/api/, '') } } },
});
