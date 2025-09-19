/**
 * Backend Sync Service for MedTrack
 * Syncs user data between localStorage and Firestore for backend scheduling
 * 
 * This service bridges the gap between the existing localStorage system
 * and the new backend-scheduled push notifications
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import { Reminder, Medication, UserProfile } from '@/types';
import { firebaseMessaging } from '@/services/firebaseMessaging';
import { isFirebaseConfigured } from '@/config/firebase';

// Firebase configuration (using same config as existing firebase.ts)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

class BackendSyncService {
  private app: any;
  private functions: any;
  private auth: any;
  private user: User | null = null;
  private isInitialized = false;
  private syncInProgress = false;
  private backendEnabled = false;
  
  private readonly LAST_SYNC_KEY = 'medtrack_last_backend_sync';
  private readonly USER_ID_KEY = 'medtrack_backend_user_id';

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Basic runtime gating: only enable backend sync when push preconditions are met
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker not supported - backend sync disabled');
        this.backendEnabled = false;
        this.isInitialized = true;
        return;
      }

      if (!('Notification' in window) || Notification.permission !== 'granted') {
        console.warn('Notification permission not granted - backend sync disabled');
        this.backendEnabled = false;
        this.isInitialized = true;
        return;
      }

      // Skip initialization if Firebase is not configured
      if (!isFirebaseConfigured()) {
        console.warn('Firebase configuration not available - backend sync disabled');
        // Create a fallback user id for consistency even without Firebase
        await this.authenticateUser();
        this.backendEnabled = false;
        this.isInitialized = true;
        return;
      }

      // Initialize Firebase app (check if already exists)
      if (getApps().length === 0) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApps()[0];
      }

      this.functions = getFunctions(this.app);
      this.auth = getAuth(this.app);

      // Connect to emulator in development
      if (import.meta.env.DEV && !this.functions._url) {
        try {
          connectFunctionsEmulator(this.functions, 'localhost', 5001);
        } catch (error) {
          // Ignore if already connected
          console.warn('Functions emulator connection failed (may already be connected):', error);
        }
      }

      // Authenticate user anonymously for backend access
      await this.authenticateUser();

      this.isInitialized = true;
      this.backendEnabled = true;
      console.log('🔄 Backend sync service initialized');

    } catch (error) {
      console.warn('⚠️ Backend sync initialization failed - using client-side notifications only:', error);
      this.backendEnabled = false;
      // Do not throw; allow app to continue with client-side only
    }
  }

  private async authenticateUser(): Promise<void> {
    try {
      const enableBackendAuth = import.meta.env.VITE_ENABLE_BACKEND_AUTH === 'true';

      // Try Firebase Auth only if explicitly enabled
      if (this.auth && enableBackendAuth) {
        try {
          if (this.auth.currentUser) {
            this.user = this.auth.currentUser;
            console.log('🔑 Using existing authenticated user:', this.user.uid);
            return;
          }

          // Sign in anonymously if Auth is configured
          const userCredential = await signInAnonymously(this.auth);
          this.user = userCredential.user;

          // Save user ID for consistency
          localStorage.setItem(this.USER_ID_KEY, this.user.uid);
          
          console.log('🔑 Anonymous authentication successful:', this.user.uid);
          return;

        } catch (authError: any) {
          if (authError.code === 'auth/configuration-not-found') {
            console.warn('⚠️ Firebase Auth not configured, using fallback user ID');
          } else {
            console.warn('⚠️ Firebase Auth failed, using fallback user ID:', authError);
          }
        }
      }

      // Fallback: Generate consistent user ID without Firebase Auth
      let userId = localStorage.getItem(this.USER_ID_KEY);
      if (!userId) {
        userId = this.generateConsistentUserId();
        localStorage.setItem(this.USER_ID_KEY, userId);
      }

      // Create a mock user object
      this.user = {
        uid: userId,
        isAnonymous: true
      } as any;

      console.log('🔑 Using fallback user ID (no Firebase Auth):', userId);

    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  private generateConsistentUserId(): string {
    // Generate a consistent user ID based on browser characteristics
    const browserInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: Date.now()
    };

    // Create a simple hash of browser info
    const infoString = JSON.stringify(browserInfo);
    let hash = 0;
    for (let i = 0; i < infoString.length; i++) {
      const char = infoString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `fallback_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  }

  /**
   * Sync all user data to backend for scheduling
   */
  async syncUserDataToBackend(
    reminders: Reminder[], 
    medications: Medication[], 
    userProfile: UserProfile | null
  ): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.backendEnabled || !this.functions) {
      console.warn('⚠️ Backend not available - skipping sync');
      return false;
    }

    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping...');
      return false;
    }

    this.syncInProgress = true;

    try {
      console.log('🔄 Starting backend sync...', {
        reminders: reminders.length,
        medications: medications.length,
        hasProfile: !!userProfile
      });

      // Get current FCM tokens
      const fcmTokens = await this.getCurrentFCMTokens();
      
      if (fcmTokens.length === 0) {
        console.warn('⚠️ No FCM tokens available for backend sync');
      }

      // Call the Cloud Function to sync data
      const syncFunction = httpsCallable(this.functions, 'syncUserReminders');
      
      const result = await syncFunction({
        userId: this.user?.uid, // Send user ID for fallback auth
        reminders: reminders.filter(r => r.isActive), // Only sync active reminders
        medications,
        fcmTokens,
        userProfile: userProfile || null,
        syncTimestamp: new Date().toISOString()
      });

      console.log('✅ Backend sync successful:', result.data);

      // Update last sync timestamp
      localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());

      return true;

    } catch (error: any) {
      console.error('❌ Backend sync failed:', error);
      
      // Provide more helpful error messages
      if (error.code === 'unavailable') {
        console.warn('⚠️ Backend Cloud Functions not deployed yet - using client-side notifications only');
      } else if (error.code === 'unauthenticated') {
        console.warn('⚠️ Backend authentication failed - check Firebase Auth configuration');
      } else if (error.message?.includes('CORS')) {
        console.warn('⚠️ Backend CORS issue - check Firebase project configuration');
      } else {
        console.warn('⚠️ Backend sync unavailable - client-side notifications will continue working');
      }
      
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get current FCM tokens for push notifications
   */
  private async getCurrentFCMTokens(): Promise<string[]> {
    const tokens = [];

    try {
      // Get FCM token from firebase messaging service
      const token = await firebaseMessaging.getToken();
      if (token) {
        tokens.push(token);
      }

      // Also check for stored token in localStorage
      const storedToken = localStorage.getItem('meditrax_fcm_token');
      if (storedToken && !tokens.includes(storedToken)) {
        tokens.push(storedToken);
      }

    } catch (error) {
      console.error('Failed to get FCM tokens:', error);
    }

    return tokens;
  }

  /**
   * Manually trigger backend notification scheduling
   */
  async scheduleNotifications(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!this.backendEnabled || !this.functions) {
        console.warn('⚠️ Backend not available - skipping scheduling');
        return false;
      }
      console.log('📅 Manually triggering backend notification scheduling...');

      const scheduleFunction = httpsCallable(this.functions, 'scheduleUserNotifications');
      const result = await scheduleFunction({
        userId: this.user?.uid // Send user ID for fallback auth
      });

      console.log('✅ Backend scheduling successful:', result.data);
      return true;

    } catch (error) {
      console.error('❌ Backend scheduling failed:', error);
      return false;
    }
  }

  /**
   * Check if sync is needed based on last sync time
   */
  shouldSync(): boolean {
    const lastSync = localStorage.getItem(this.LAST_SYNC_KEY);
    if (!lastSync) return true;

    const lastSyncTime = new Date(lastSync).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return (now - lastSyncTime) > fiveMinutes;
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTime(): Date | null {
    const lastSync = localStorage.getItem(this.LAST_SYNC_KEY);
    return lastSync ? new Date(lastSync) : null;
  }

  /**
   * Check if backend sync is available
   */
  isBackendAvailable(): boolean {
    return this.isInitialized && !!this.user && navigator.onLine;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.user?.uid || null;
  }

  /**
   * Test backend connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.backendEnabled || !this.functions) {
        return false;
      }

      // Try to call a simple function to test connection
      const scheduleFunction = httpsCallable(this.functions, 'scheduleUserNotifications');
      await scheduleFunction({
        userId: this.user?.uid // Send user ID for fallback auth
      });
      
      return true;
    } catch (error) {
      console.warn('Backend connection test failed:', error);
      return false;
    }
  }

  /**
   * Force sync - bypass timing checks
   */
  async forceSyncUserData(
    reminders: Reminder[], 
    medications: Medication[], 
    userProfile: UserProfile | null
  ): Promise<boolean> {
    // Remove last sync timestamp to force sync
    localStorage.removeItem(this.LAST_SYNC_KEY);
    return this.syncUserDataToBackend(reminders, medications, userProfile);
  }
}

// Export singleton instance
export const backendSyncService = new BackendSyncService();
export default backendSyncService;
