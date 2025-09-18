/**
 * Firebase Service Worker Configuration Utility
 * Replaces placeholders in firebase-messaging-sw.js with actual environment variables
 */

export function getFirebaseServiceWorkerConfig() {
  // Use process.env in Node.js (build time), import.meta.env in browser (runtime)
  const env = typeof process !== 'undefined' && process.env ? process.env : import.meta.env;
  
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || ''
  };
}

export function generateFirebaseServiceWorkerContent() {
  // Always generate with runtime configuration loading
  return `/**
 * Firebase Cloud Messaging Service Worker for MedTrack
 * Handles FCM push notifications when app is closed or in background
 * Generated automatically during build process
 */

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Get Firebase configuration from runtime environment
function getFirebaseConfig() {
  // Try to get config from the main app via postMessage
  return new Promise((resolve) => {
    // Default fallback config (will be replaced by main app)
    const fallbackConfig = {
      apiKey: null,
      authDomain: null,
      projectId: null,
      storageBucket: null,
      messagingSenderId: null,
      appId: null
    };
    
    // Listen for config message from main app
    const messageHandler = (event) => {
      if (event.data && event.data.type === 'FIREBASE_CONFIG') {
        self.removeEventListener('message', messageHandler);
        resolve(event.data.config);
      }
    };
    
    self.addEventListener('message', messageHandler);
    
    // Request config from main app
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'REQUEST_FIREBASE_CONFIG' });
      });
    });
    
    // Timeout fallback
    setTimeout(() => {
      self.removeEventListener('message', messageHandler);
      resolve(fallbackConfig);
    }, 5000);
  });
}

// Firebase configuration will be loaded at runtime
let firebaseConfig = null;

// Initialize Firebase when configuration is available
let messaging = null;

async function initializeFirebaseMessaging() {
  try {
    console.log('🔥 Attempting to initialize Firebase messaging in service worker...');
    
    // Get Firebase config from main app
    firebaseConfig = await getFirebaseConfig();
    
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
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
            icon: payload.notification?.icon || '/pill-icon.svg',
            badge: '/pill-icon.svg',
            data: {
              ...payload.data,
              fcm: true,
              timestamp: Date.now()
            },
            tag: payload.data?.medicationId ? \`medication_\${payload.data.medicationId}\` : 'medtrack-fcm',
            requireInteraction: true,
            actions: [
              { action: 'take', title: '✅ Taken', icon: '/pill-icon.svg' },
              { action: 'snooze', title: '⏰ Snooze 15min', icon: '/pill-icon.svg' },
              { action: 'skip', title: '⏸️ Skip', icon: '/pill-icon.svg' }
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
            icon: '/pill-icon.svg',
            badge: '/pill-icon.svg',
            requireInteraction: true
          });
        }
      });

      console.log('✅ Firebase messaging service worker ready');
      
      // Notify main app that Firebase is ready
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'FIREBASE_READY', success: true });
        });
      });
      
    } else {
      console.warn('⚠️ Firebase configuration not available - FCM disabled');
      
      // Notify main app that Firebase failed to initialize
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'FIREBASE_READY', success: false });
        });
      });
      
      throw new Error('Firebase configuration incomplete');
    }

  } catch (error) {
    console.error('❌ Failed to initialize Firebase in service worker:', error);
    
    // Notify main app that Firebase failed
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
self.firebaseMessaging = messaging;`;
}
