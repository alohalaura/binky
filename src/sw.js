import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import {
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from 'workbox-strategies'
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

// Auth/session/token requests must not be cached — stale 401s break login after
// OAuth redirect (DevTools shows "401 from service worker").
registerRoute(
  ({ url }) => url.hostname.endsWith('supabase.co') && url.pathname.startsWith('/auth/'),
  new NetworkOnly(),
)

// Supabase REST/Storage (runtime): cache for offline; excludes /auth/ above.
registerRoute(
  ({ url }) => url.hostname.endsWith('supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 86400 })],
  }),
)

