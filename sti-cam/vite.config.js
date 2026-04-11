import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use the existing manifest.json from public/
      manifest: false,
      workbox: {
        // Cache all assets for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache Google OAuth/API calls
        navigateFallback: '/sti_cam/index.html',
        navigateFallbackDenylist: [/^\/api/, /google/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  base: '/sti_cam/',
  server: {
    https: false,      // En dev local. getUserMedia requiere HTTPS en producción
    host: true,        // Accesible desde el celular en la misma red
  },
});
