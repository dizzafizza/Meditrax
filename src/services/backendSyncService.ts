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
    // Allow re-initialization if previously disabled or functions were not available
    if (this.isInitialized && this.backendEnabled && this.functions) return;

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
        // Do NOT mark initialized so we can retry when permission becomes granted
        return;
      }

      // Skip initialization if Firebase is not configured
      if (!isFirebaseConfigured()) {
        console.warn('Firebase configuration not available - backend sync disabled');
        // Create a fallback user id for consistency even without Firebase
        await this.authenticateUser();
        this.backendEnabled = false;
        // Leave isInitialized=false to allow retry later when envs become available
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

  // Ensure PushSubscription is JSON-serializable with endpoint and base64 keys
  private serializePushSubscription(subscription: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
    try {
      const maybeJson = (subscription as any)?.toJSON ? (subscription as any).toJSON() : null;
      const endpoint: string = maybeJson?.endpoint || subscription.endpoint;

      let p256dh: string | null = maybeJson?.keys?.p256dh || null;
      let auth: string | null = maybeJson?.keys?.auth || null;

      // Fallback: derive keys from getKey()
      if ((!p256dh || !auth) && typeof subscription.getKey === 'function') {
        const p256dhBuf = subscription.getKey('p256dh');
        const authBuf = subscription.getKey('auth');
        if (p256dhBuf) p256dh = this.arrayBufferToBase64(p256dhBuf);
        if (authBuf) auth = this.arrayBufferToBase64(authBuf);
      }

      if (!endpoint || !p256dh || !auth) {
        throw new Error('Invalid PushSubscription: missing endpoint or keys');
      }

      return {
        endpoint,
        keys: { p256dh, auth }
      };
    } catch (e) {
      console.warn('Failed to serialize PushSubscription:', e instanceof Error ? e.message : e);
      throw e;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Register a Web Push subscription in the backend for this user
   */
  async registerWebPushSubscription(subscription: PushSubscription): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      if (!this.functions) {
        console.warn('Functions not available; cannot register Web Push subscription');
        return false;
      }

      const registerFn = httpsCallable(this.functions, 'registerWebPushSubscription');
      const serialized = this.serializePushSubscription(subscription);
      const result = await registerFn({
        userId: this.user?.uid,
        subscription: serialized,
        userAgent: navigator.userAgent
      });
      console.log('✅ Web Push subscription registered:', result.data);
      return true;
    } catch (error) {
      console.warn('⚠️ Failed to register Web Push subscription:', error);
      return false;
    }
  }

  /**
   * Unregister a Web Push subscription by endpoint
   */
  async unregisterWebPushSubscription(endpoint: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      if (!this.functions) {
        return false;
      }
      const unregisterFn = httpsCallable(this.functions, 'unregisterWebPushSubscription');
      await unregisterFn({ userId: this.user?.uid, endpoint });
      console.log('🗑️ Web Push subscription unregistered');
      return true;
    } catch (error) {
      console.warn('Failed to unregister Web Push subscription:', error);
      return false;
    }
  }

  /**
   * Send a server-side test Web Push
   */
  async sendTestWebPush(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      if (!this.functions) {
        return false;
      }
      const testFn = httpsCallable(this.functions, 'sendTestWebPush');
      const result = await testFn({ userId: this.user?.uid });
      console.log('🧪 Test Web Push result:', result.data);
      return !!(result.data as any)?.success;
    } catch (error) {
      console.warn('Test Web Push failed:', error);
      return false;
    }
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
    const tokens: string[] = [];
    try {
      // Prefer cached token to avoid forcing refresh on every sync
      const storedToken = localStorage.getItem('meditrax_fcm_token');
      if (storedToken) tokens.push(storedToken);

      // If no cached token available, obtain one (may be same value if already registered)
      if (tokens.length === 0) {
        const token = await firebaseMessaging.getToken();
        if (token) tokens.push(token);
      }
    } catch (error) {
      console.error('Failed to get FCM tokens:', error);
    }
    return Array.from(new Set(tokens));
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
