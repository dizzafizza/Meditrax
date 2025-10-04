/**
 * Firebase Configuration for Meditrax (Simplified)
 * Note: Firebase Cloud Messaging has been removed in favor of Capacitor Local Notifications
 * This file is kept for potential future use of Firestore or other Firebase services
 */

// Firebase configuration is no longer required for Capacitor local notifications
// If you need Firestore or other Firebase services in the future, configure them here

export const isFirebaseConfigured = (): boolean => {
  return false; // Firebase not configured in Capacitor version
};

export const getFirebaseStatus = () => {
  return {
    configured: false,
    message: 'Firebase disabled - using Capacitor Local Notifications'
  };
};

export default {};
