/**
 * Meditrax Service Worker
 * Handles push notifications, caching, and offline functionality
 */

const CACHE_NAME = 'meditrax-v1';
const NOTIFICATION_CACHE = 'meditrax-notifications-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pill-icon.svg',
  '/manifest.json',
  // Add other critical assets as needed
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== NOTIFICATION_CACHE) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external requests (fonts, etc. are handled by Vite PWA plugin)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise, fetch from network and cache the response
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response before caching
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If network fails, try to serve from cache or return offline page
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // For other resources, just fail gracefully
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  let notificationData = {
    title: 'Meditrax Reminder',
    body: 'Time to take your medication!',
    icon: '/pill-icon.svg',
    badge: '/pill-icon.svg',
    data: {},
    requireInteraction: true,
    actions: [
      {
        action: 'take',
        title: 'Mark as Taken',
        icon: '/icons/check.png'
      },
      {
        action: 'snooze',
        title: 'Snooze 15min',
        icon: '/icons/snooze.png'
      }
    ]
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.error('Service Worker: Failed to parse push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      tag: notificationData.tag || 'medication-reminder',
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200]
    })
    .then(() => {
      // Cache the notification for tracking
      return caches.open(NOTIFICATION_CACHE).then((cache) => {
        const notification = {
          id: Date.now().toString(),
          ...notificationData,
          timestamp: new Date().toISOString(),
          status: 'shown'
        };
        
        return cache.put(
          `notification-${notification.id}`,
          new Response(JSON.stringify(notification))
        );
      });
    })
    .catch((error) => {
      console.error('Service Worker: Failed to show notification:', error);
    })
  );
});

// Notification click event - handle user interactions with notifications
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  if (action === 'take') {
    // Mark medication as taken
    event.waitUntil(
      handleMedicationAction('taken', data)
        .then(() => sendMessageToClients({
          type: 'MEDICATION_TAKEN',
          medicationId: data.medicationId,
          reminderId: data.reminderId,
          timestamp: new Date().toISOString()
        }))
    );
  } else if (action === 'snooze') {
    // Snooze medication for 15 minutes
    event.waitUntil(
      handleMedicationAction('snoozed', data, 15)
        .then(() => {
          // Schedule a new notification for 15 minutes later
          return scheduleSnoozeNotification(data, 15);
        })
        .then(() => sendMessageToClients({
          type: 'MEDICATION_SNOOZED',
          medicationId: data.medicationId,
          reminderId: data.reminderId,
          snoozeMinutes: 15,
          timestamp: new Date().toISOString()
        }))
    );
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
        .then((client) => {
          if (client && data.medicationId) {
            // Send message to navigate to medication details
            client.postMessage({
              type: 'NAVIGATE_TO_MEDICATION',
              medicationId: data.medicationId
            });
          }
        })
    );
  }

  // Update notification status in cache
  event.waitUntil(
    updateNotificationStatus(data.notificationId, 'clicked', action)
  );
});

// Notification close event - handle when user dismisses notification
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed', event);
  
  const data = event.notification.data || {};
  
  // Update notification status in cache
  event.waitUntil(
    updateNotificationStatus(data.notificationId, 'dismissed')
      .then(() => sendMessageToClients({
        type: 'NOTIFICATION_CLOSED',
        medicationId: data.medicationId,
        reminderId: data.reminderId,
        timestamp: new Date().toISOString()
      }))
  );
});

// Background sync event - handle when connectivity is restored
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'sync-medication-logs') {
    event.waitUntil(syncMedicationLogs());
  } else if (event.tag === 'sync-reminders') {
    event.waitUntil(syncReminders());
  } else if (event.tag === 'check-notifications') {
    event.waitUntil(checkScheduledNotifications());
  }
});

// Periodic Background sync - check notifications periodically
self.addEventListener('periodicsync', (event) => {
  console.log('Service Worker: Periodic sync triggered', event.tag);
  
  if (event.tag === 'check-medication-reminders') {
    event.waitUntil(checkScheduledNotifications());
  }
});

// Message event - handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SCHEDULE_NOTIFICATION':
      event.waitUntil(scheduleLocalNotification(data));
      break;
    case 'CANCEL_NOTIFICATION':
      event.waitUntil(cancelScheduledNotification(data.notificationId));
      break;
    case 'TEST_NOTIFICATION':
      event.waitUntil(showTestNotification());
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    default:
      console.log('Service Worker: Unknown message type:', type);
  }
});

// Helper Functions

/**
 * Handle medication actions (taken, snoozed, skipped)
 */
async function handleMedicationAction(action, data, snoozeMinutes) {
  try {
    // Store the action locally for sync later
    const cache = await caches.open(NOTIFICATION_CACHE);
    const actionRecord = {
      action,
      medicationId: data.medicationId,
      reminderId: data.reminderId,
      timestamp: new Date().toISOString(),
      snoozeMinutes,
      synced: false
    };
    
    await cache.put(
      `action-${Date.now()}`,
      new Response(JSON.stringify(actionRecord))
    );
    
    console.log(`Service Worker: Recorded ${action} action for medication ${data.medicationId}`);
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      await syncMedicationLogs();
    } else {
      // Register for background sync when online
      await self.registration.sync.register('sync-medication-logs');
    }
  } catch (error) {
    console.error('Service Worker: Failed to handle medication action:', error);
  }
}

/**
 * Schedule a snooze notification
 */
async function scheduleSnoozeNotification(originalData, minutes) {
  try {
    const snoozeTime = Date.now() + (minutes * 60 * 1000);
    
    // Store snooze info for later processing
    const cache = await caches.open(NOTIFICATION_CACHE);
    const snoozeRecord = {
      medicationId: originalData.medicationId,
      reminderId: originalData.reminderId,
      scheduledTime: snoozeTime,
      originalData,
      type: 'snooze'
    };
    
    await cache.put(
      `snooze-${originalData.medicationId}-${snoozeTime}`,
      new Response(JSON.stringify(snoozeRecord))
    );
    
    // Use setTimeout for short delays (up to 5 minutes)
    if (minutes <= 5) {
      setTimeout(() => {
        showSnoozeNotification(originalData);
      }, minutes * 60 * 1000);
    }
    
    console.log(`Service Worker: Scheduled snooze notification for ${minutes} minutes`);
  } catch (error) {
    console.error('Service Worker: Failed to schedule snooze notification:', error);
  }
}

/**
 * Show a snoozed notification
 */
async function showSnoozeNotification(data) {
  try {
    await self.registration.showNotification(
      `Reminder: ${data.medicationName}`,
      {
        body: `Snoozed reminder - Time to take your ${data.dosage}${data.unit} dose`,
        icon: '/pill-icon.svg',
        badge: '/pill-icon.svg',
        data: data,
        requireInteraction: true,
        tag: `medication-${data.medicationId}`,
        renotify: true,
        actions: [
          {
            action: 'take',
            title: 'Mark as Taken',
            icon: '/icons/check.png'
          },
          {
            action: 'snooze',
            title: 'Snooze Again',
            icon: '/icons/snooze.png'
          }
        ]
      }
    );
  } catch (error) {
    console.error('Service Worker: Failed to show snooze notification:', error);
  }
}

/**
 * Schedule a local notification (without push server)
 */
async function scheduleLocalNotification(notificationData) {
  try {
    const { scheduledTime, ...notificationOptions } = notificationData;
    const delay = scheduledTime - Date.now();
    
    if (delay <= 0) {
      // Show immediately if time has passed
      await self.registration.showNotification(notificationOptions.title, notificationOptions);
    } else if (delay <= 5 * 60 * 1000) { // Up to 5 minutes
      // Use setTimeout for short delays
      setTimeout(() => {
        self.registration.showNotification(notificationOptions.title, notificationOptions);
      }, delay);
    } else {
      // Store for later processing (would need periodic sync or other mechanism)
      const cache = await caches.open(NOTIFICATION_CACHE);
      await cache.put(
        `scheduled-${Date.now()}`,
        new Response(JSON.stringify(notificationData))
      );
    }
  } catch (error) {
    console.error('Service Worker: Failed to schedule notification:', error);
  }
}

/**
 * Cancel a scheduled notification
 */
async function cancelScheduledNotification(notificationId) {
  try {
    const cache = await caches.open(NOTIFICATION_CACHE);
    await cache.delete(`scheduled-${notificationId}`);
    console.log(`Service Worker: Cancelled notification ${notificationId}`);
  } catch (error) {
    console.error('Service Worker: Failed to cancel notification:', error);
  }
}

/**
 * Update notification status in cache
 */
async function updateNotificationStatus(notificationId, status, action) {
  try {
    if (!notificationId) return;
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const response = await cache.match(`notification-${notificationId}`);
    
    if (response) {
      const notification = await response.json();
      notification.status = status;
      notification.action = action;
      notification.updatedAt = new Date().toISOString();
      
      await cache.put(
        `notification-${notificationId}`,
        new Response(JSON.stringify(notification))
      );
    }
  } catch (error) {
    console.error('Service Worker: Failed to update notification status:', error);
  }
}

/**
 * Send message to all clients
 */
async function sendMessageToClients(message) {
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true
    });
    
    clients.forEach((client) => {
      client.postMessage(message);
    });
  } catch (error) {
    console.error('Service Worker: Failed to send message to clients:', error);
  }
}

/**
 * Sync medication logs with main app
 */
async function syncMedicationLogs() {
  try {
    console.log('Service Worker: Syncing medication logs...');
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const requests = await cache.keys();
    
    const actionRequests = requests.filter(request => 
      request.url.includes('action-')
    );
    
    for (const request of actionRequests) {
      const response = await cache.match(request);
      if (response) {
        const actionData = await response.json();
        
        if (!actionData.synced) {
          // Send to main app for processing
          await sendMessageToClients({
            type: 'SYNC_MEDICATION_ACTION',
            data: actionData
          });
          
          // Mark as synced
          actionData.synced = true;
          await cache.put(request, new Response(JSON.stringify(actionData)));
        }
      }
    }
    
    console.log('Service Worker: Medication log sync complete');
  } catch (error) {
    console.error('Service Worker: Failed to sync medication logs:', error);
  }
}

/**
 * Sync reminders
 */
async function syncReminders() {
  try {
    console.log('Service Worker: Syncing reminders...');
    // Implementation would sync reminder changes with main app
    await sendMessageToClients({
      type: 'SYNC_REMINDERS_REQUEST'
    });
  } catch (error) {
    console.error('Service Worker: Failed to sync reminders:', error);
  }
}

/**
 * Show a test notification
 */
async function showTestNotification() {
  try {
    await self.registration.showNotification('Meditrax Test', {
      body: 'Service Worker notifications are working!',
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      requireInteraction: false,
      tag: 'test-notification'
    });
  } catch (error) {
    console.error('Service Worker: Failed to show test notification:', error);
  }
}

/**
 * Check for scheduled notifications that should be shown
 */
async function checkScheduledNotifications() {
  try {
    console.log('Service Worker: Checking scheduled notifications...');
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const requests = await cache.keys();
    const now = Date.now();
    
    // Look for scheduled notifications
    const scheduledRequests = requests.filter(request => 
      request.url.includes('scheduled-') || request.url.includes('notification-queue-')
    );
    
    for (const request of scheduledRequests) {
      try {
        const response = await cache.match(request);
        if (response) {
          const notificationData = await response.json();
          const scheduledTime = new Date(notificationData.scheduledTime).getTime();
          
          // If notification time has passed, show it
          if (scheduledTime <= now && notificationData.status !== 'sent') {
            await self.registration.showNotification(
              notificationData.title || 'Meditrax Reminder',
              {
                body: notificationData.body || 'Time to take your medication!',
                icon: notificationData.icon || '/pill-icon.svg',
                badge: notificationData.badge || '/pill-icon.svg',
                data: notificationData.data || {},
                requireInteraction: true,
                tag: notificationData.tag || 'medication-reminder',
                renotify: true,
                actions: [
                  {
                    action: 'take',
                    title: 'Mark as Taken',
                    icon: '/icons/check.png'
                  },
                  {
                    action: 'snooze',
                    title: 'Snooze 15min',
                    icon: '/icons/snooze.png'
                  }
                ]
              }
            );
            
            // Mark as sent
            notificationData.status = 'sent';
            notificationData.sentAt = new Date().toISOString();
            await cache.put(request, new Response(JSON.stringify(notificationData)));
            
            // Notify main app
            await sendMessageToClients({
              type: 'NOTIFICATION_SENT',
              notificationId: notificationData.id,
              timestamp: new Date().toISOString()
            });
            
            console.log(`Service Worker: Sent scheduled notification ${notificationData.id}`);
          }
        }
      } catch (error) {
        console.error('Service Worker: Error processing scheduled notification:', error);
      }
    }
    
    // Also check localStorage-based notification queue by sending message to clients
    await sendMessageToClients({
      type: 'CHECK_MISSED_NOTIFICATIONS'
    });
    
    console.log('Service Worker: Notification check complete');
  } catch (error) {
    console.error('Service Worker: Failed to check scheduled notifications:', error);
  }
}

console.log('Service Worker: Loaded and ready');


