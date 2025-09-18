/**
 * MedTrack Service Worker Entry Point
 * Imports custom notification logic alongside Workbox
 * This file is processed by Workbox generateSW
 */

// Import custom notification service worker logic
try {
  importScripts('./notification-sw.js');
  console.log('🔥 Custom notification service worker imported');
} catch (error) {
  console.warn('Custom notification service worker not available:', error);
}

// Handle update messages from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⚡ Received SKIP_WAITING message, activating new service worker...');
    self.skipWaiting();
  }
  // Note: DIAGNOSTIC_PING is already handled by imported notification-sw.js
});

// Notify clients when cache is updated
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SW_ACTIVATED') {
    console.log('✅ Service worker activated, notifying clients...');
    
    // Notify all clients that cache has been updated
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'CACHE_UPDATED' });
      });
    });
  }
});