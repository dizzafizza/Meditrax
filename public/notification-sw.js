/**
 * MedTrack Custom Notification Service Worker
 * Handles push notifications, offline functionality, and Firebase Cloud Messaging
 * Optimized for iOS PWA support - Loaded by main Workbox service worker
 */

// Import Firebase messaging service worker for FCM support
try {
  importScripts('./firebase-messaging-sw.js');
  console.log('🔥 Firebase messaging service worker imported');
} catch (error) {
  console.warn('Firebase messaging service worker not available:', error);
}

const NOTIFICATION_CACHE = 'meditrax-notifications-v1';

// **NOTIFICATION EVENT HANDLERS**

// Push event - handle incoming push notifications  
// **CRITICAL FOR iOS**: Based on guide - MUST show notification for every push or permissions revoked
self.addEventListener('push', (event) => {
  console.log('Service Worker: 📨 Push notification received');
  
  // **iOS PWA CRITICAL**: Always show notification - never skip or iOS kills permissions
  let notificationData = {
    title: 'Meditrax Reminder',
    body: 'Time to take your medication!',
    icon: '/pill-icon.svg',
    badge: '/pill-icon.svg',
    data: {},
    requireInteraction: true,
    actions: [
      { action: 'take', title: '✅ Mark as Taken', icon: '/pill-icon.svg' },
      { action: 'snooze', title: '⏰ Snooze 15min', icon: '/pill-icon.svg' }
    ],
    tag: 'medication-reminder',
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    timestamp: Date.now()
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
      console.log('Service Worker: Parsed push data:', pushData);
    } catch (error) {
      console.error('Service Worker: Failed to parse push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    (async () => {
      try {
        // **iOS PWA CRITICAL**: Always show notification
        await self.registration.showNotification(notificationData.title, {
          body: notificationData.body,
          icon: notificationData.icon,
          badge: notificationData.badge,
          data: notificationData.data,
          requireInteraction: notificationData.requireInteraction,
          actions: notificationData.actions,
          tag: notificationData.tag,
          renotify: notificationData.renotify,
          silent: notificationData.silent,
          vibrate: notificationData.vibrate,
          timestamp: notificationData.timestamp
        });
        
        console.log('Service Worker: ✅ Notification displayed successfully');

        // Cache notification for offline access (non-critical)
        try {
          const cache = await caches.open(NOTIFICATION_CACHE);
          const notificationRecord = {
            id: Date.now().toString(),
            ...notificationData,
            timestamp: new Date().toISOString(),
            status: 'shown',
            receivedAt: Date.now()
          };
          await cache.put(`notification-${notificationRecord.id}`, new Response(JSON.stringify(notificationRecord)));
        } catch (cacheError) {
          console.warn('Service Worker: Failed to cache notification (non-critical):', cacheError);
        }

      } catch (error) {
        console.error('Service Worker: ❌ CRITICAL - Failed to show notification:', error);
        
        // **iOS PWA FAILSAFE**: Show basic notification no matter what
        try {
          await self.registration.showNotification('MedTrack Notification Error', {
            body: 'A medication notification could not be displayed properly. Please open the app.',
            icon: '/pill-icon.svg',
            badge: '/pill-icon.svg',
            requireInteraction: true,
            tag: 'error-notification',
            timestamp: Date.now()
          });
          console.log('Service Worker: 🆘 Showed fallback error notification');
        } catch (fallbackError) {
          console.error('Service Worker: ❌ FATAL - Even fallback notification failed:', fallbackError);
        }
      }
    })()
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === 'take') {
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
    event.waitUntil(
      handleMedicationAction('snoozed', data, 15)
        .then(() => scheduleSnoozeNotification(data, 15))
        .then(() => sendMessageToClients({
          type: 'MEDICATION_SNOOZED',
          medicationId: data.medicationId,
          reminderId: data.reminderId,
          snoozeMinutes: 15,
          timestamp: new Date().toISOString()
        }))
    );
  } else {
    // Default: open app
    event.waitUntil(
      clients.openWindow('/').then(client => {
        if (client && data.medicationId) {
          client.postMessage({
            type: 'NAVIGATE_TO_MEDICATION',
            medicationId: data.medicationId
          });
        }
      })
    );
  }

  // Update notification status
  event.waitUntil(updateNotificationStatus(data.notificationId, 'clicked', action));
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed', event);
  
  const data = event.notification.data || {};
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

// **MESSAGE HANDLING**

self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SW_ACTIVATED':
      console.log('Service Worker: Activation confirmed, starting notification systems...');
      setTimeout(() => {
        setupPeriodicNotificationCheck();
        checkScheduledNotifications();
      }, 1000);
      break;
      
    case 'SCHEDULE_NOTIFICATION':
      event.waitUntil(scheduleNotification(data));
      break;
      
    case 'CANCEL_NOTIFICATION':
      event.waitUntil(cancelNotification(data.notificationId));
      break;
      
    case 'TEST_NOTIFICATION':
      event.waitUntil(showTestNotification());
      break;
      
    case 'SHOW_NOTIFICATION':
      event.waitUntil(showImmediateNotification(data.payload));
      break;
      
    case 'DIAGNOSTIC_PING':
      console.log('Service Worker: 🏓 Diagnostic ping received, responding...');
      // Immediate direct reply to the source client to avoid timeouts before claim()
      try {
        const immediate = {
          timestamp: Date.now(),
          receivedPingAt: data?.timestamp,
          responseDelay: Date.now() - (data?.timestamp || Date.now()),
          serviceWorkerActive: true
        };
        // Prefer replying to the specific source client if available
        if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage({ type: 'DIAGNOSTIC_PONG', data: immediate });
        }
      } catch (e) {
        // Non-fatal
      }
      // Continue with full diagnostic + broadcast to all clients
      event.waitUntil(handleDiagnosticPing(data));
      break;
    
    // Store full reminder pattern so SW can independently schedule/check when app is closed
    case 'STORE_REMINDER_PATTERN':
      event.waitUntil((async () => {
        try {
          const cache = await caches.open(NOTIFICATION_CACHE);
          const key = `reminder-pattern-${data?.reminderId}`;
          await cache.put(key, new Response(JSON.stringify({ ...data, storedAt: Date.now() })));
          console.log('Service Worker: ✅ Stored reminder pattern', data?.reminderId);
        } catch (e) {
          console.warn('Service Worker: Failed to store reminder pattern:', e);
        }
      })());
      break;

    // Deactivate a reminder pattern by removing it from cache
    case 'DEACTIVATE_REMINDER_PATTERN':
      event.waitUntil((async () => {
        try {
          const cache = await caches.open(NOTIFICATION_CACHE);
          const key = `reminder-pattern-${data?.reminderId}`;
          await cache.delete(key);
          console.log('Service Worker: ✅ Deactivated reminder pattern', data?.reminderId);
        } catch (e) {
          console.warn('Service Worker: Failed to deactivate reminder pattern:', e);
        }
      })());
      break;

    // Cancel any scheduled notifications for a given reminderId
    case 'CANCEL_REMINDER_NOTIFICATIONS':
      event.waitUntil((async () => {
        try {
          const cache = await caches.open(NOTIFICATION_CACHE);
          const keys = await cache.keys();
          let removed = 0;
          for (const request of keys) {
            if (request.url.includes('scheduled-')) {
              const resp = await cache.match(request);
              const json = resp ? await resp.json() : null;
              if (json && json.reminderId && json.reminderId === data?.reminderId) {
                await cache.delete(request);
                removed += 1;
              }
            }
          }
          console.log(`Service Worker: 🗑️ Cancelled ${removed} scheduled notifications for reminder ${data?.reminderId}`);
        } catch (e) {
          console.warn('Service Worker: Failed to cancel reminder notifications:', e);
        }
      })());
      break;

    // Track app visibility so we can opportunistically check missed notifications on blur/hide
    case 'APP_VISIBILITY_CHANGED':
      try {
        const isVisible = !!data?.visible;
        console.log('Service Worker: App visibility changed:', isVisible ? 'visible' : 'hidden');
        // If app just became visible, trigger a quick check to reconcile missed/queued notifications
        if (isVisible) {
          event.waitUntil(checkScheduledNotifications());
        }
      } catch (e) {
        // no-op
      }
      break;
      
    default:
      console.log('Service Worker: Unknown message type:', type);
  }
});

// **HELPER FUNCTIONS**

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
    
    await cache.put(`action-${Date.now()}`, new Response(JSON.stringify(actionRecord)));
    console.log(`Service Worker: Recorded ${action} action for medication ${data.medicationId}`);
    
    // Sync immediately if online, otherwise register for background sync
    if (navigator.onLine) {
      await syncMedicationLogs();
    } else {
      await self.registration.sync.register('sync-medication-logs');
    }
  } catch (error) {
    console.error('Service Worker: Failed to handle medication action:', error);
  }
}

/**
 * Schedule a snooze notification
 */
async function scheduleSnoozeNotification(data, minutes) {
  try {
    const snoozeTime = Date.now() + (minutes * 60 * 1000);
    const cache = await caches.open(NOTIFICATION_CACHE);
    
    const snoozeData = {
      medicationId: data.medicationId,
      reminderId: data.reminderId,
      scheduledTime: snoozeTime,
      originalData: data,
      type: 'snooze'
    };
    
    await cache.put(`snooze-${data.medicationId}-${snoozeTime}`, new Response(JSON.stringify(snoozeData)));
    
    // For short snoozes, use setTimeout
    if (minutes <= 5) {
      setTimeout(() => {
        showSnoozeNotification(data);
      }, minutes * 60 * 1000);
    }
    
    console.log(`Service Worker: Scheduled snooze notification for ${minutes} minutes`);
  } catch (error) {
    console.error('Service Worker: Failed to schedule snooze notification:', error);
  }
}

/**
 * Show snooze notification
 */
async function showSnoozeNotification(data) {
  try {
    await self.registration.showNotification(`Reminder: ${data.medicationName}`, {
      body: `Snoozed reminder - Time to take your ${data.dosage}${data.unit} dose`,
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      data: data,
      requireInteraction: true,
      tag: `medication-${data.medicationId}`,
      renotify: true,
      actions: [
        { action: 'take', title: 'Mark as Taken', icon: '/icons/check.png' },
        { action: 'snooze', title: 'Snooze Again', icon: '/icons/snooze.png' }
      ]
    });
  } catch (error) {
    console.error('Service Worker: Failed to show snooze notification:', error);
  }
}

/**
 * Schedule a notification for future delivery
 */
async function scheduleNotification(notification) {
  try {
    const { scheduledTime, ...notificationData } = notification;
    const delay = scheduledTime - Date.now();
    
    console.log(`Service Worker: 📅 Scheduling notification "${notificationData.title}" for ${new Date(scheduledTime).toLocaleString()}, delay: ${Math.round(delay / 1000 / 60)} minutes`);
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const scheduledNotification = {
      ...notification,
      id: notification.id || `scheduled-${Date.now()}`,
      persistedAt: Date.now(),
      status: 'scheduled',
      scheduledTime
    };
    
    await cache.put(`scheduled-${scheduledNotification.id}`, new Response(JSON.stringify(scheduledNotification)));
    console.log(`Service Worker: ✅ Persisted notification ${scheduledNotification.id} in cache`);
    
    // If notification is within 1 minute, show immediately
    if (delay <= 60 * 1000) {
      console.log('Service Worker: 🚀 Sending immediate notification (within 1 minute)');
      try {
        await self.registration.showNotification(notificationData.title, {
          ...notificationData,
          timestamp: Date.now(),
          renotify: true,
          vibrate: [200, 100, 200],
          silent: false
        });
        
        scheduledNotification.status = 'sent';
        scheduledNotification.sentAt = Date.now();
        scheduledNotification.sentByServiceWorker = true;
        await cache.put(`scheduled-${scheduledNotification.id}`, new Response(JSON.stringify(scheduledNotification)));
        
        console.log('Service Worker: ✅ Immediate notification sent successfully');
        
        await sendMessageToClients({
          type: 'NOTIFICATION_SENT',
          notificationId: scheduledNotification.id,
          immediate: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Service Worker: ❌ Failed to send immediate notification:', error);
        scheduledNotification.status = 'failed';
        await cache.put(`scheduled-${scheduledNotification.id}`, new Response(JSON.stringify(scheduledNotification)));
      }
    } else {
      console.log('Service Worker: ⏰ Scheduled for future processing - will be checked every 1-5 minutes');
      // Trigger a check in 10 seconds for testing
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
async function cancelNotification(notificationId) {
  try {
    const cache = await caches.open(NOTIFICATION_CACHE);
    await cache.delete(`scheduled-${notificationId}`);
    console.log(`Service Worker: Cancelled notification ${notificationId}`);
  } catch (error) {
    console.error('Service Worker: Failed to cancel notification:', error);
  }
}

/**
 * Update notification status
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
      
      await cache.put(`notification-${notificationId}`, new Response(JSON.stringify(notification)));
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
    const keys = await cache.keys();
    const actionKeys = keys.filter(key => key.url.includes('action-'));
    
    for (const key of actionKeys) {
      const response = await cache.match(key);
      if (response) {
        const actionData = await response.json();
        
        if (!actionData.synced) {
          // Send to main app for syncing
          await sendMessageToClients({
            type: 'SYNC_MEDICATION_ACTION',
            data: actionData
          });
          
          // Mark as synced
          actionData.synced = true;
          await cache.put(key, new Response(JSON.stringify(actionData)));
        }
      }
    }
    
    console.log('Service Worker: Medication log sync complete');
  } catch (error) {
    console.error('Service Worker: Failed to sync medication logs:', error);
  }
}

/**
 * Show test notification
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
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    });
    
    console.log('Service Worker: Test notification displayed');
  } catch (error) {
    console.error('Service Worker: Failed to show test notification:', error);
  }
}

/**
 * Show immediate notification
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
 * Check scheduled notifications and send due ones
 */
async function checkScheduledNotifications() {
  try {
    console.log('Service Worker: 🔍 Checking scheduled notifications for closed-app delivery...');
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const keys = await cache.keys();
    const now = Date.now();
    let processed = 0, sent = 0;
    
    const scheduledKeys = keys.filter(key => 
      key.url.includes('scheduled-') || key.url.includes('notification-queue-')
    );
    
    console.log(`Service Worker: Found ${scheduledKeys.length} scheduled notification(s) to check`);
    
    for (const key of scheduledKeys) {
      try {
        const response = await cache.match(key);
        if (response) {
          const notification = await response.json();
          const scheduledTime = new Date(notification.scheduledTime).getTime();
          processed++;
          
          console.log(`Service Worker: Checking notification ${notification.id}, scheduled for ${new Date(scheduledTime).toLocaleString()}, status: ${notification.status}`);
          
          if (scheduledTime <= now && notification.status !== 'sent') {
            console.log(`Service Worker: 📳 Sending missed/scheduled notification: ${notification.title}`);
            
            await self.registration.showNotification(
              notification.title || '💊 Meditrax Reminder',
              {
                body: notification.body || 'Time to take your medication!',
                icon: notification.icon || '/pill-icon.svg',
                badge: notification.badge || '/pill-icon.svg',
                data: notification.data || {},
                requireInteraction: notification.requireInteraction !== false,
                tag: notification.tag || `medication-reminder-${Date.now()}`,
                renotify: true,
                timestamp: now,
                silent: false,
                vibrate: [200, 100, 200],
                actions: notification.actions || [
                  { action: 'take', title: '✅ Taken', icon: '/pill-icon.svg' },
                  { action: 'snooze', title: '⏰ Snooze 15min', icon: '/pill-icon.svg' }
                ]
              }
            );
            
            // Update notification status
            notification.status = 'sent';
            notification.sentAt = new Date().toISOString();
            notification.sentByServiceWorker = true;
            await cache.put(key, new Response(JSON.stringify(notification)));
            
            sent++;
            
            await sendMessageToClients({
              type: 'NOTIFICATION_SENT',
              notificationId: notification.id,
              sentByServiceWorker: true,
              timestamp: new Date().toISOString()
            });
            
            console.log(`Service Worker: ✅ Successfully sent notification ${notification.id}`);
          } else if (scheduledTime > now) {
            console.log(`Service Worker: ⏳ Notification ${notification.id} still scheduled for future: ${new Date(scheduledTime).toLocaleString()}`);
          }
        }
      } catch (error) {
        console.error('Service Worker: Error processing scheduled notification:', error);
      }
    }
    
    // Notify main app to check for missed notifications
    await sendMessageToClients({
      type: 'CHECK_MISSED_NOTIFICATIONS',
      serviceWorkerTriggered: true
    });
    
    console.log(`Service Worker: 📊 Notification check complete - Processed: ${processed}, Sent: ${sent}`);
  } catch (error) {
    console.error('Service Worker: ❌ Failed to check scheduled notifications:', error);
  }
}

/**
 * Setup periodic notification checking
 */
async function setupPeriodicNotificationCheck() {
  try {
    // Register periodic sync if supported
    if ('periodicSync' in self.registration) {
      await self.registration.periodicSync.register('check-medication-reminders', {
        minInterval: 15 * 60 * 1000 // 15 minutes
      });
      console.log('Service Worker: ✅ Periodic sync registered for closed-app notifications');
    }
    
    // Start immediate checks for testing
    setTimeout(() => {
      checkScheduledNotifications();
    }, 5000);
  } catch (error) {
    console.log('Service Worker: ⚠️ Periodic sync not available:', error.message);
  }
}

/**
 * Handle diagnostic ping to test service worker background execution
 */
async function handleDiagnosticPing(data) {
  try {
    console.log('Service Worker: 🔍 Processing diagnostic ping...');
    
    const cache = await caches.open(NOTIFICATION_CACHE);
    const diagnosticData = {
      timestamp: Date.now(),
      receivedPingAt: data.timestamp,
      responseDelay: Date.now() - data.timestamp,
      serviceWorkerActive: true,
      canExecuteInBackground: true,
      lastExecutionTime: new Date().toISOString()
    };
    
    // Store diagnostic result
    await cache.put('diagnostic-ping-result', new Response(JSON.stringify(diagnosticData)));
    
    // Send response back to main app
    await sendMessageToClients({
      type: 'DIAGNOSTIC_PONG',
      data: diagnosticData
    });
    
    console.log('Service Worker: ✅ Diagnostic ping processed successfully');
  } catch (error) {
    console.error('Service Worker: ❌ Failed to handle diagnostic ping:', error);
  }
}

/**
 * Background sync event handler
 */
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'sync-medication-logs') {
    event.waitUntil(syncMedicationLogs());
  } else if (event.tag === 'check-notifications') {
    event.waitUntil(checkScheduledNotifications());
  }
});

/**
 * Periodic sync event handler
 */
self.addEventListener('periodicsync', (event) => {
  console.log('Service Worker: Periodic sync triggered', event.tag);
  
  if (event.tag === 'check-medication-reminders') {
    event.waitUntil(checkScheduledNotifications());
  }
});

console.log('Service Worker: ✅ Custom notification service worker loaded successfully');

// Take control of uncontrolled clients immediately after activation to ensure messaging works
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

