/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Dev-server proxies mirror the Vercel functions in /api so local development
 * behaves like production. They exist only because the Census geocoder does
 * not send CORS headers. No business logic here.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*.png', 'data/*.json'],
      manifest: {
        name: 'Fault Line — New Madrid shaking at your address',
        short_name: 'Fault Line',
        description:
          'What the ground under a West Tennessee address is expected to do if a major New Madrid earthquake occurs, and a household plan that works with the power out.',
        theme_color: '#0E1114',
        background_color: '#0E1114',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // The app shell and the prebaked district dataset are precached. This is
        // the thesis: the site readout and scenario simulator work with zero
        // connectivity (CLAUDE.md, "Never do").
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // OpenFreeMap style, vector tiles, glyphs and sprites. Every tile the
            // user has viewed keeps rendering offline.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'basemap', expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 60 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/earthquake\.usgs\.gov\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'usgs-live', networkTimeoutSeconds: 6, expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 8, expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  server: {
    proxy: {
      '/api/geocode': {
        target: 'https://geocoding.geo.census.gov',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/geocode\??/, '/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&'),
      },
      '/api/designmaps': {
        // The documented /ws/designmaps/asce7-16.json URL 301-redirects here; target it directly.
        target: 'https://earthquake.usgs.gov',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) =>
          path.replace(/^\/api\/designmaps\??/, '/ws/building-codes/asce7-16/calculate?riskCategory=II&siteClass=B&title=fault-line&'),
      },
    },
  },
  build: {
    sourcemap: false,
    target: 'es2022',
    rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'], supabase: ['@supabase/supabase-js'] } } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
