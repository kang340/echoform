import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
    watch: {
      ignored: [
        '**/.chrome-profile*/**',
        '**/.npm-cache/**',
        '**/shots/**',
        '**/media/**',
        '**/tests/artifacts/**',
      ],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4178,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
