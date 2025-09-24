/**
 * Firebase Configuration for MedTrack
 * Uses environment variables for secure credential management
 * Configure these values in GitHub Secrets for production
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

// Firebase configuration from environment variables
// These should be set in GitHub Secrets and .env files
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Debug logging for environment variables (in development and production for troubleshooting)
console.log('🔍 Firebase Environment Variables Debug:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasProjectId: !!firebaseConfig.projectId,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasVapidKey: !!import.meta.env.VITE_FIREBASE_VAPID_KEY,
  projectId: firebaseConfig.projectId?.substring(0, 8) + '...' || 'missing',
  mode: import.meta.env.MODE
});

// VAPID key for web push notifications  
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
// Using a single VAPID key for both FCM and standard Web Push

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp;

export const initializeFirebase = (): FirebaseApp => {
  try {
    // Check if Firebase is already initialized
    if (getApps().length === 0) {
      // Detailed validation of required configuration
      const missingKeys = [];
      if (!firebaseConfig.apiKey) missingKeys.push('VITE_FIREBASE_API_KEY');
      if (!firebaseConfig.projectId) missingKeys.push('VITE_FIREBASE_PROJECT_ID');
      if (!firebaseConfig.messagingSenderId) missingKeys.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
      if (!VAPID_KEY) missingKeys.push('VITE_FIREBASE_VAPID_KEY');

      if (missingKeys.length > 0) {
        const errorMsg = `Firebase configuration incomplete. Missing: ${missingKeys.join(', ')}. Push notifications will use fallback mode.`;
        console.warn(errorMsg);
        console.log('🔍 Current config status:', getFirebaseStatus());
        throw new Error('Firebase configuration missing');
      }

      app = initializeApp(firebaseConfig);
      console.log('🔥 Firebase initialized successfully');
    } else {
      app = getApp();
      console.log('🔥 Firebase already initialized');
    }

    return app;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
};

// Initialize Firebase messaging with error handling
export const initializeMessaging = async (): Promise<Messaging | null> => {
  try {
    // Check if messaging is supported in this environment
    const messagingSupported = await isSupported();
    if (!messagingSupported) {
      console.warn('Firebase messaging not supported in this browser');
      return null;
    }

    // Check if service worker is available
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported - Firebase messaging unavailable');
      return null;
    }

    // Initialize Firebase app first
    const firebaseApp = initializeFirebase();
    
    // Initialize messaging
    const messaging = getMessaging(firebaseApp);
    console.log('📱 Firebase messaging initialized');
    
    return messaging;
  } catch (error) {
    console.error('Failed to initialize Firebase messaging:', error);
    return null;
  }
};

// Check if Firebase is properly configured
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey && 
    firebaseConfig.projectId && 
    firebaseConfig.messagingSenderId &&
    VAPID_KEY
  );
};

// Get Firebase configuration status for debugging
export const getFirebaseStatus = () => {
  return {
    configured: isFirebaseConfigured(),
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId,
    hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
    hasVapidKey: !!VAPID_KEY,
    config: firebaseConfig.projectId ? {
      projectId: firebaseConfig.projectId,
      messagingSenderId: firebaseConfig.messagingSenderId
    } : null
  };
};

export default app;
