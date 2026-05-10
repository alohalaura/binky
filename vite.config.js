import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      maxParallelFileOps: 1,
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'pwa-192.png',
        'pwa-512.png',
        'pwa-maskable-192.png',
        'pwa-maskable-512.png',
      ],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest,ico,png,txt}'],
      },
      manifest: {
        name: 'Binky Labs',
        short_name: 'Binky Labs',
        description: 'Health records for your bunny — Binky Labs',
        lang: 'en',
        theme_color: '#9B91D8',
        background_color: '#9B91D8',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
