/**
 * MedTrack Service Worker
 * Handles push notifications, caching, offline functionality, and Firebase Cloud Messaging
 * Optimized for iOS PWA support
 */

// Import Firebase messaging service worker for FCM support
try {
  importScripts('./firebase-messaging-sw.js');
  console.log('🔥 Firebase messaging service worker imported');
} catch (error) {
  console.warn('Firebase messaging service worker not available:', error);
}

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

// Install event - cache critical assets and setup closed-app notifications
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing with enhanced closed-app notification support...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        // Start notification checking immediately after install
        setTimeout(() => {
          setupPeriodicNotificationCheck();
          checkScheduledNotifications();
        }, 1000);
        return Promise.resolve();
      })
      .then(() => self.skipWaiting())
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
    case 'SHOW_NOTIFICATION':
      // Handle immediate notification display (from Firebase foreground messages)
      event.waitUntil(showImmediateNotification(data.payload));
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'APP_VISIBILITY_CHANGED':
      console.log('Service Worker: App visibility changed:', data);
      // Handle app visibility changes - could trigger notification checks when app becomes hidden
      if (data && !data.visible) {
        console.log('Service Worker: App became hidden - scheduling aggressive notification checks');
        // Trigger more frequent notification checks when app is hidden
        setTimeout(() => {
          console.log('Service Worker: 🔄 Aggressive notification check triggered');
          checkScheduledNotifications();
        }, 10000); // Check after 10 seconds
      }
      break;
    case 'STORE_REMINDER_PATTERN':
      // **iOS PWA FIX**: Store reminder patterns for independent scheduling
      event.waitUntil(storeReminderPattern(data));
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
 * Schedule a local notification - RELIABLE closed-app support using cache-based scheduling
 */
async function scheduleLocalNotification(notificationData) {
  try {
    const { scheduledTime, ...notificationOptions } = notificationData;
    const delay = scheduledTime - Date.now();
    
    console.log(`Service Worker: 📅 Scheduling notification "${notificationOptions.title}" for ${new Date(scheduledTime).toLocaleString()}, delay: ${Math.round(delay / 1000 / 60)} minutes`);
    
    // **CRITICAL**: Always store first for persistence
    const cache = await caches.open(NOTIFICATION_CACHE);
    const persistentNotification = {
      ...notificationData,
      id: notificationData.id || `scheduled-${Date.now()}`,
      persistedAt: Date.now(),
      status: 'scheduled',
      scheduledTime: scheduledTime // Ensure this is preserved
    };
    
    await cache.put(
      `scheduled-${persistentNotification.id}`,
      new Response(JSON.stringify(persistentNotification))
    );
    console.log(`Service Worker: ✅ Persisted notification ${persistentNotification.id} in cache`);
    
    // **IMMEDIATE NOTIFICATIONS**: Send right away if time has passed or is very close (within 1 minute)
    if (delay <= 60 * 1000) { // Within 1 minute - send immediately
      console.log('Service Worker: 🚀 Sending immediate notification (within 1 minute)');
      try {
        await self.registration.showNotification(notificationOptions.title, {
          ...notificationOptions,
          timestamp: Date.now(),
          renotify: true,
          vibrate: [200, 100, 200],
          silent: false
        });
        
        // Mark as sent in cache
        persistentNotification.status = 'sent';
        persistentNotification.sentAt = Date.now();
        persistentNotification.sentByServiceWorker = true;
        
        await cache.put(
          `scheduled-${persistentNotification.id}`,
          new Response(JSON.stringify(persistentNotification))
        );
        
        console.log('Service Worker: ✅ Immediate notification sent successfully');
        
        // Notify app if it's open
        await sendMessageToClients({
          type: 'NOTIFICATION_SENT',
          notificationId: persistentNotification.id,
          immediate: true,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Service Worker: ❌ Failed to send immediate notification:', error);
        persistentNotification.status = 'failed';
        await cache.put(
          `scheduled-${persistentNotification.id}`,
          new Response(JSON.stringify(persistentNotification))
        );
      }
    } else {
      // **FUTURE NOTIFICATIONS**: Schedule for later processing
      console.log(`Service Worker: ⏰ Scheduled for future processing - will be checked every 1-5 minutes`);
      
      // Force an immediate check to establish timing
      setTimeout(() => {
        console.log('Service Worker: Triggering check in 10 seconds for testing');
        checkScheduledNotifications();
      }, 10000);
    }
    
  } catch (error) {
    console.error('Service Worker: ❌ Failed to schedule notification:', error);
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
    await self.registration.showNotification('🧪 MedTrack Test', {
      body: 'Service Worker notifications are working correctly!',
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      requireInteraction: true,
      tag: 'test-notification',
      actions: [
        { action: 'confirm', title: '✅ Got it!', icon: '/pill-icon.svg' },
        { action: 'close', title: '❌ Close', icon: '/pill-icon.svg' }
      ],
      data: { type: 'test', timestamp: Date.now() }
    });
    console.log('Service Worker: Test notification displayed');
  } catch (error) {
    console.error('Service Worker: Failed to show test notification:', error);
  }
}

/**
 * Show an immediate notification (for Firebase foreground messages)
 */
async function showImmediateNotification(payload) {
  try {
    console.log('Service Worker: Showing immediate notification:', payload);
    
    const title = payload.title || 'MedTrack Reminder';
    const options = {
      body: payload.body || 'Time for your medication',
      icon: payload.icon || '/pill-icon.svg',
      badge: payload.badge || '/pill-icon.svg',
      data: payload.data || {},
      tag: payload.tag || 'medtrack-immediate',
      requireInteraction: payload.requireInteraction !== false,
      actions: payload.actions || [
        { action: 'take', title: '✅ Taken', icon: '/pill-icon.svg' },
        { action: 'snooze', title: '⏰ Snooze', icon: '/pill-icon.svg' },
        { action: 'skip', title: '⏸️ Skip', icon: '/pill-icon.svg' }
      ],
      vibrate: [200, 100, 200],
      silent: false,
      renotify: true,
      timestamp: Date.now()
    };

    await self.registration.showNotification(title, options);
    console.log('Service Worker: Immediate notification displayed');
  } catch (error) {
    console.error('Service Worker: Failed to show immediate notification:', error);
  }
}

/**
 * Check for scheduled notifications that should be shown - ENHANCED for reliable closed-app delivery
 */
async function checkScheduledNotifications() {
  try {
    console.log('Service Worker: 🔍 Checking scheduled notifications for closed-app delivery...');
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const requests = await cache.keys();
    const now = Date.now();
    let processedCount = 0;
    let sentCount = 0;
    
    // Look for scheduled notifications
    const scheduledRequests = requests.filter(request => 
      request.url.includes('scheduled-') || request.url.includes('notification-queue-')
    );
    
    console.log(`Service Worker: Found ${scheduledRequests.length} scheduled notification(s) to check`);
    
    for (const request of scheduledRequests) {
      try {
        const response = await cache.match(request);
        if (response) {
          const notificationData = await response.json();
          const scheduledTime = new Date(notificationData.scheduledTime).getTime();
          processedCount++;
          
          console.log(`Service Worker: Checking notification ${notificationData.id}, scheduled for ${new Date(scheduledTime).toLocaleString()}, status: ${notificationData.status}`);
          
          // **CRITICAL**: If notification time has passed and hasn't been sent, show it
          if (scheduledTime <= now && notificationData.status !== 'sent') {
            console.log(`Service Worker: 📳 Sending missed/scheduled notification: ${notificationData.title}`);
            
            await self.registration.showNotification(
              notificationData.title || '💊 Meditrax Reminder',
              {
                body: notificationData.body || 'Time to take your medication!',
                icon: notificationData.icon || '/pill-icon.svg',
                badge: notificationData.badge || '/pill-icon.svg',
                data: notificationData.data || {},
                requireInteraction: notificationData.requireInteraction !== false,
                tag: notificationData.tag || `medication-reminder-${Date.now()}`,
                renotify: true,
                timestamp: now,
                silent: false,
                vibrate: [200, 100, 200],
                actions: notificationData.actions || [
                  {
                    action: 'take',
                    title: '✅ Taken',
                    icon: '/pill-icon.svg'
                  },
                  {
                    action: 'snooze',
                    title: '⏰ Snooze 15min',
                    icon: '/pill-icon.svg'
                  }
                ]
              }
            );
            
            // Mark as sent and update cache
            notificationData.status = 'sent';
            notificationData.sentAt = new Date().toISOString();
            notificationData.sentByServiceWorker = true;
            await cache.put(request, new Response(JSON.stringify(notificationData)));
            
            sentCount++;
            
            // Notify main app if it's open
            await sendMessageToClients({
              type: 'NOTIFICATION_SENT',
              notificationId: notificationData.id,
              sentByServiceWorker: true,
              timestamp: new Date().toISOString()
            });
            
            console.log(`Service Worker: ✅ Successfully sent notification ${notificationData.id}`);
          } else if (scheduledTime > now) {
            console.log(`Service Worker: ⏳ Notification ${notificationData.id} still scheduled for future: ${new Date(scheduledTime).toLocaleString()}`);
          }
        }
      } catch (error) {
        console.error('Service Worker: Error processing scheduled notification:', error);
      }
    }
    
    // **IMPORTANT**: Also trigger app to check localStorage-based notification queue
    await sendMessageToClients({
      type: 'CHECK_MISSED_NOTIFICATIONS',
      serviceWorkerTriggered: true
    });
    
    console.log(`Service Worker: 📊 Notification check complete - Processed: ${processedCount}, Sent: ${sentCount}`);
  } catch (error) {
    console.error('Service Worker: ❌ Failed to check scheduled notifications:', error);
  }
}

// **ENHANCED CLOSED-APP NOTIFICATION SUPPORT**

// Set up periodic notification checking
async function setupPeriodicNotificationCheck() {
  try {
    // Register periodic sync for regular notification checks when app is closed
    if ('periodicSync' in self.registration) {
      await self.registration.periodicSync.register('check-medication-reminders', {
        minInterval: 15 * 60 * 1000 // Check every 15 minutes minimum
      });
      console.log('Service Worker: ✅ Periodic sync registered for closed-app notifications');
    }
    
    // Also trigger an immediate check on service worker startup
    setTimeout(() => {
      checkScheduledNotifications();
    }, 5000); // Wait 5 seconds after startup
    
  } catch (error) {
    console.log('Service Worker: ⚠️ Periodic sync not available:', error.message);
  }
}

// Enhanced visibility change handling for better app state detection
let isAppVisible = false;
let lastNotificationCheck = Date.now();

// Listen for visibility changes to detect app open/close
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  if (type === 'APP_VISIBILITY_CHANGED') {
    const wasVisible = isAppVisible;
    isAppVisible = data.visible;
    
    if (!wasVisible && isAppVisible) {
      // App just became visible - check for missed notifications
      console.log('Service Worker: App became visible, checking for missed notifications');
      checkScheduledNotifications();
    }
    
    if (!isAppVisible && wasVisible) {
      // App just became hidden - ensure notifications will be sent
      console.log('Service Worker: App hidden, ensuring background notification delivery');
      lastNotificationCheck = Date.now();
    }
  }
});

// **AGGRESSIVE NOTIFICATION CHECKING** - Essential for closed-app delivery
let notificationCheckInterval = null;

function startAggressiveNotificationChecking() {
  // Clear any existing interval
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }
  
  // **PRODUCTION OPTIMIZED CHECKS** - Every 30 seconds for iOS PWA reliability
  notificationCheckInterval = setInterval(() => {
    console.log('Service Worker: 🔄 Notification check triggered');
    checkScheduledNotifications();
    lastNotificationCheck = Date.now();
  }, 30 * 1000); // Check every 30 seconds for production reliability
  
  // Also trigger immediate check
  checkScheduledNotifications();
  console.log('Service Worker: 🚀 Started optimized notification checking (every 30 seconds)');
}

// Start aggressive checking as soon as service worker loads
startAggressiveNotificationChecking();

// **PRODUCTION BACKUP CHECKS**: Also check on service worker activity
self.addEventListener('fetch', () => {
  const timeSinceLastCheck = Date.now() - lastNotificationCheck;
  // If more than 1 minute since last check, do a quick check
  if (timeSinceLastCheck > 60 * 1000) {
    setTimeout(() => checkScheduledNotifications(), 500);
  }
});

// **FAILSAFE CHECK CHAIN** - Ensures continuous operation for iOS PWA
function triggerFailsafeCheck(delayMs = 45000) {
  setTimeout(() => {
    // Only check if main interval might have failed
    const timeSinceLastCheck = Date.now() - lastNotificationCheck;
    if (timeSinceLastCheck > 45 * 1000) {
      console.log('Service Worker: 🔄 Failsafe notification check');
      checkScheduledNotifications();
    }
    triggerFailsafeCheck(); // Chain the next failsafe check
  }, delayMs);
}

// Start the failsafe chain
triggerFailsafeCheck();

// **iOS PWA REMINDER PATTERN MANAGEMENT** - Critical for closed-app recurring notifications

/**
 * Store reminder pattern for independent service worker scheduling
 */
async function storeReminderPattern(reminderPattern) {
  try {
    console.log('Service Worker: 📋 Storing reminder pattern for iOS PWA scheduling:', reminderPattern);
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    
    // Store the reminder pattern with metadata
    const patternData = {
      ...reminderPattern,
      storedAt: Date.now(),
      lastScheduledUntil: null,
      isActive: true
    };
    
    await cache.put(
      `reminder-pattern-${reminderPattern.reminderId}`,
      new Response(JSON.stringify(patternData))
    );
    
    console.log(`✅ Service Worker: Stored reminder pattern for ${reminderPattern.medicationName}`);
    
    // Immediately generate additional future notifications for this pattern
    await extendNotificationsFromPattern(reminderPattern);
    
  } catch (error) {
    console.error('Service Worker: Failed to store reminder pattern:', error);
  }
}

/**
 * Generate additional notifications from stored reminder patterns
 * CRITICAL for iOS PWA - ensures continuous notifications when app is closed
 */
async function extendNotificationsFromPattern(reminderPattern, daysToExtend = 60) {
  try {
    console.log(`Service Worker: 🔄 Extending notifications for pattern ${reminderPattern.reminderId}`);
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const now = new Date();
    const [hours, minutes] = reminderPattern.time.split(':').map(Number);
    
    let generatedCount = 0;
    
    // Generate notifications for the next 60 days
    for (let dayOffset = 7; dayOffset < daysToExtend; dayOffset++) { // Start from day 7 to avoid conflicts
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + dayOffset);
      checkDate.setHours(hours, minutes, 0, 0);
      
      const dayName = checkDate.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
      
      if (reminderPattern.days.includes(dayName)) {
        const notificationId = `sw_${reminderPattern.reminderId}_${checkDate.getTime()}`;
        
        // Check if this notification already exists
        const existingResponse = await cache.match(`scheduled-${notificationId}`);
        if (existingResponse) {
          continue; // Skip if already scheduled
        }
        
        const notificationData = {
          id: notificationId,
          reminderId: reminderPattern.reminderId,
          medicationId: reminderPattern.medicationId,
          scheduledTime: checkDate.getTime(),
          title: `💊 Time for ${reminderPattern.medicationName}`,
          body: reminderPattern.customMessage || `Take your ${reminderPattern.dosage}${reminderPattern.unit} dose of ${reminderPattern.medicationName}`,
          icon: '/pill-icon.svg',
          badge: '/pill-icon.svg',
          data: {
            medicationId: reminderPattern.medicationId,
            reminderId: reminderPattern.reminderId,
            medicationName: reminderPattern.medicationName,
            dosage: reminderPattern.dosage,
            unit: reminderPattern.unit,
            timestamp: checkDate.getTime(),
            generatedByServiceWorker: true
          },
          tag: `sw_medication_${reminderPattern.medicationId}_${dayOffset}`,
          requireInteraction: true,
          actions: [
            { action: 'take', title: '✅ Taken', icon: '/pill-icon.svg' },
            { action: 'snooze', title: '⏰ Snooze 15min', icon: '/pill-icon.svg' },
            { action: 'skip', title: '⏸️ Skip', icon: '/pill-icon.svg' }
          ],
          status: 'scheduled',
          createdByServiceWorker: true,
          persistedAt: Date.now()
        };
        
        // Store the notification
        await cache.put(
          `scheduled-${notificationId}`,
          new Response(JSON.stringify(notificationData))
        );
        
        generatedCount++;
      }
    }
    
    console.log(`✅ Service Worker: Generated ${generatedCount} additional notifications for ${reminderPattern.medicationName}`);
    
  } catch (error) {
    console.error('Service Worker: Failed to extend notifications from pattern:', error);
  }
}

/**
 * Check and extend reminder patterns when notifications are running low
 * Ensures continuous scheduling for iOS PWA
 */
async function maintainReminderPatterns() {
  try {
    console.log('Service Worker: 🔧 Maintaining reminder patterns...');
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const requests = await cache.keys();
    const now = Date.now();
    const oneWeekFromNow = now + (7 * 24 * 60 * 60 * 1000);
    
    // Find stored reminder patterns
    const patternRequests = requests.filter(request => 
      request.url.includes('reminder-pattern-')
    );
    
    for (const request of patternRequests) {
      try {
        const response = await cache.match(request);
        if (response) {
          const patternData = await response.json();
          
          if (!patternData.isActive) continue;
          
          // Count future notifications for this reminder
          const reminderNotifications = requests.filter(req => 
            req.url.includes(`scheduled-`) && 
            req.url.includes(patternData.reminderId)
          );
          
          let futureCount = 0;
          for (const notifRequest of reminderNotifications) {
            try {
              const notifResponse = await cache.match(notifRequest);
              if (notifResponse) {
                const notifData = await notifResponse.json();
                if (notifData.scheduledTime > oneWeekFromNow && notifData.status === 'scheduled') {
                  futureCount++;
                }
              }
            } catch (error) {
              // Skip invalid notifications
            }
          }
          
          // If less than 10 notifications in the next week, generate more
          if (futureCount < 10) {
            console.log(`Service Worker: ⚡ Low notification count (${futureCount}) for ${patternData.medicationName}, extending...`);
            await extendNotificationsFromPattern(patternData, 90); // Extend by 90 days
          }
        }
      } catch (error) {
        console.error('Service Worker: Error processing reminder pattern:', error);
      }
    }
    
  } catch (error) {
    console.error('Service Worker: Failed to maintain reminder patterns:', error);
  }
}

// Run pattern maintenance every 6 hours
setInterval(() => {
  maintainReminderPatterns();
}, 6 * 60 * 60 * 1000);

// Run initial pattern maintenance after 30 seconds
setTimeout(() => {
  maintainReminderPatterns();
}, 30000);

console.log('Service Worker: ✅ Production ready with iOS PWA reminder pattern management');


