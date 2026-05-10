import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA app-shell routing: serve index.html for navigations (e.g. /records) while offline.
const handler = createHandlerBoundToURL('/index.html')
registerRoute(
  new NavigationRoute(handler, {
    denylist: [
      // Exclude Vite/asset files and API-style routes.
      /^\/assets\//,
      /\/[^/?]+\.[^/]+$/, // paths containing a file extension
    ],
  }),
)

// App shell/static assets (runtime).
registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  }),
)

registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-media',
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// Supabase (runtime) so previously-read data remains available offline.
registerRoute(
  ({ url }) => url.hostname.endsWith('supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 86400 })],
  }),
)

