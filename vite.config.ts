import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути — сборка работает и на GitHub Pages в подпапке.
  base: './',
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
  },
});
