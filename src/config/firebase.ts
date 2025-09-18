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

// VAPID key for web push notifications  
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp;

export const initializeFirebase = (): FirebaseApp => {
  try {
    // Check if Firebase is already initialized
    if (getApps().length === 0) {
      // Validate required configuration
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.warn('Firebase configuration incomplete. Push notifications will use fallback mode.');
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
