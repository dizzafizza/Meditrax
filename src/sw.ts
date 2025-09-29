/*
 * Meditrax Service Worker (single-file, injected by Workbox)
 * - Reliable offline: app shell precached, navigation fallback to index.html
 * - Updates: autoUpdate + skipWaiting + clientsClaim
 * - Optional addons (notifications, FCM) are best-effort via importScripts with try/catch
 */

/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Take over as soon as possible
self.skipWaiting();
clientsClaim();

// Precache the app shell and assets injected at build time
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - __WB_MANIFEST is injected by VitePWA injectManifest
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Always serve the SPA shell for navigations
const navigationHandler = createHandlerBoundToURL('index.html');
registerRoute(new NavigationRoute(navigationHandler));

// Network-first for JS/CSS/HTML with fast fallback to cache
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style' || request.destination === 'document',
  new NetworkFirst({
    cacheName: 'app-shell-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  })
);

// Cache-first for fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

// Cache-first for images and icons
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// Handle messages from the app
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = (event as any).data;
  if (!data) return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'SW_ACTIVATED') {
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'CACHE_UPDATED' }));
    });
  }
});

// Best-effort load optional addons only when available (never block offline startup)
(async () => {
  try {
    // Custom notification logic (push handlers, diagnostics, scheduling)
    // Optional: if unavailable (offline), the SW continues to operate for caching
    // This file lives at public/notification-sw.js and is generated into dist/
    importScripts('/notification-sw.js');
    // eslint-disable-next-line no-console
    console.log('SW: Optional notification addon loaded');
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('SW: Optional notification addon not loaded (offline or missing):', e?.message || e);
  }

  try {
    // Firebase messaging addon (wraps remote imports internally with try/catch)
    importScripts('/firebase-messaging-sw.js');
    // eslint-disable-next-line no-console
    console.log('SW: Optional Firebase messaging addon loaded');
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('SW: Optional Firebase messaging addon not loaded (offline or missing):', e?.message || e);
  }
})();

// Ensure control of clients after activation
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});


