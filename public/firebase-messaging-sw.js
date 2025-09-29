/**
 * Firebase Cloud Messaging Service Worker for MedTrack
 * Handles FCM push notifications when app is closed or in background
 * Generated automatically during build process
 */

// Import Firebase scripts for service worker
// Wrap remote imports to avoid breaking offline startup
try {
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
} catch (e) {
  // If offline or blocked, continue without Firebase; app will fallback gracefully
  console.warn('Firebase libraries unavailable in service worker startup (offline or blocked). FCM disabled until connectivity is restored.');
}

// Global flag to prevent multiple config requests
let configRequestInProgress = false;
let cachedConfig = null;

// Get Firebase configuration from runtime environment
function getFirebaseConfig() {
  // Return cached config if available
  if (cachedConfig) {
    return Promise.resolve(cachedConfig);
  }
  
  // Prevent multiple concurrent requests
  if (configRequestInProgress) {
    return new Promise((resolve) => {
      // Wait for existing request to complete
      const checkInterval = setInterval(() => {
        if (cachedConfig || !configRequestInProgress) {
          clearInterval(checkInterval);
          resolve(cachedConfig || getFallbackConfig());
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(getFallbackConfig());
      }, 10000);
    });
  }
  
  configRequestInProgress = true;
  
  // Try to get config from the main app via postMessage
  return new Promise((resolve) => {
    // Listen for config message from main app
    const messageHandler = (event) => {
      if (event.data && event.data.type === 'FIREBASE_CONFIG') {
        self.removeEventListener('message', messageHandler);
        cachedConfig = event.data.config;
        configRequestInProgress = false;
        resolve(cachedConfig);
      }
    };
    
    self.addEventListener('message', messageHandler);
    
    // Request config from main app (only if clients are available)
    self.clients.matchAll().then(clients => {
      if (clients.length > 0) {
        clients.forEach(client => {
          client.postMessage({ type: 'REQUEST_FIREBASE_CONFIG' });
        });
      } else {
        // No clients available, use fallback
        setTimeout(() => {
          self.removeEventListener('message', messageHandler);
          cachedConfig = getFallbackConfig();
          configRequestInProgress = false;
          resolve(cachedConfig);
        }, 100);
      }
    });
    
    // Timeout fallback
    setTimeout(() => {
      self.removeEventListener('message', messageHandler);
      if (!cachedConfig) {
        cachedConfig = getFallbackConfig();
      }
      configRequestInProgress = false;
      resolve(cachedConfig);
    }, 5000);
  });
}

function getFallbackConfig() {
  return {
    apiKey: null,
    authDomain: null,
    projectId: null,
    storageBucket: null,
    messagingSenderId: null,
    appId: null
  };
}

// Firebase configuration will be loaded at runtime
let firebaseConfig = null;

// Initialize Firebase when configuration is available
let messaging = null;
let initializationInProgress = false;
let initializationCompleted = false;

async function initializeFirebaseMessaging() {
  // Prevent multiple initialization attempts
  if (initializationCompleted) {
    console.log('🔥 Firebase messaging already initialized');
    return;
  }
  
  if (initializationInProgress) {
    console.log('🔥 Firebase messaging initialization in progress...');
    return;
  }
  
  initializationInProgress = true;
  
  try {
    console.log('🔥 Attempting to initialize Firebase messaging in service worker...');
    
    // Get Firebase config from main app
    firebaseConfig = await getFirebaseConfig();
    
    if (typeof firebase !== 'undefined' && firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
      // Initialize Firebase with runtime configuration
      firebase.initializeApp(firebaseConfig);
      messaging = firebase.messaging();
      
      console.log('🔥 Firebase messaging initialized successfully in service worker');

      // Handle background push messages
      messaging.onBackgroundMessage((payload) => {
        console.log('📱 FCM background message received:', payload);
        
        try {
          // Extract notification data
          const notificationTitle = payload.notification?.title || 'MedTrack Reminder';
          const notificationOptions = {
            body: payload.notification?.body || 'Time for your medication',
            icon: payload.notification?.icon || '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            data: {
              ...payload.data,
              fcm: true,
              timestamp: Date.now()
            },
            tag: payload.data?.medicationId ? `medication_${payload.data.medicationId}` : 'medtrack-fcm',
            requireInteraction: true,
            actions: [
              { action: 'take', title: '✅ Taken', icon: '/icons/icon-48x48.png' },
              { action: 'snooze', title: '⏰ Snooze 15min', icon: '/icons/icon-48x48.png' },
              { action: 'skip', title: '⏸️ Skip', icon: '/icons/icon-48x48.png' }
            ],
            vibrate: [200, 100, 200],
            silent: false,
            renotify: true
          };

          // Show the notification
          return self.registration.showNotification(notificationTitle, notificationOptions);
          
        } catch (error) {
          console.error('Failed to show FCM background notification:', error);
          
          // Fallback notification
          return self.registration.showNotification('MedTrack Reminder', {
            body: 'Time for your medication',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            requireInteraction: true
          });
        }
      });

      console.log('✅ Firebase messaging service worker ready');
      
      // Mark initialization as completed
      initializationCompleted = true;
      initializationInProgress = false;
      
      // Notify main app that Firebase is ready
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'FIREBASE_READY', success: true });
        });
      });
      
    } else {
      console.warn('⚠️ Firebase configuration not available - FCM disabled');
      
      // Mark initialization as completed even if failed (don't retry)
      initializationCompleted = true;
      initializationInProgress = false;
      
      // Notify main app that Firebase failed to initialize
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'FIREBASE_READY', success: false });
        });
      });
      
      // Don't throw error, just continue with fallback
      console.log('🔄 Service worker continuing with fallback notifications only');
    }

  } catch (error) {
    console.error('❌ Failed to initialize Firebase in service worker:', error);
    
    // Mark initialization as completed to prevent retries on configuration errors
    initializationCompleted = true;
    initializationInProgress = false;
    
    // Always notify main app that Firebase failed (prevent timeout)
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'FIREBASE_READY', success: false });
      });
    });
    
    // Create fallback messaging object
    messaging = {
      onBackgroundMessage: () => {
        console.warn('Firebase messaging not available - background push notifications disabled');
      }
    };
    
    console.log('🔄 Service worker continuing with client-side notifications only');
  }
}

// Handle messages from main app
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE') {
    await initializeFirebaseMessaging();
  }
});

// Try to initialize immediately when service worker starts
initializeFirebaseMessaging();

// Export messaging for potential use by main service worker
self.firebaseMessaging = messaging;