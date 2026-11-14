import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs let the PWA work at a GitHub Pages project path as well as at `/`.
  base: './',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
