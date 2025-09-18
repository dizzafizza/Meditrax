/**
 * Firebase Cloud Messaging Service for MedTrack
 * Handles FCM token management and push notification subscriptions
 * Optimized for iOS PWA support
 */

import { 
  getToken, 
  onMessage, 
  deleteToken,
  type Messaging,
  type MessagePayload,
  type NotificationPayload as FCMNotificationPayload
} from 'firebase/messaging';

import { initializeMessaging, VAPID_KEY, getFirebaseStatus } from '@/config/firebase';
import type { NotificationPayload } from './notificationService';

export interface FCMSubscription {
  token: string;
  endpoint: string;
  expirationTime?: number;
}

export interface FCMStatus {
  supported: boolean;
  configured: boolean;
  subscribed: boolean;
  token?: string;
  error?: string;
}

class FirebaseMessagingService {
  private messaging: Messaging | null = null;
  private currentToken: string | null = null;
  private isInitialized = false;
  private messageHandler: ((payload: MessagePayload) => void) | null = null;

  constructor() {
    // Don't initialize immediately, wait for explicit initialization
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }

    try {
      console.log('🔥 Initializing Firebase messaging service...');
      
      // Initialize Firebase messaging
      this.messaging = await initializeMessaging();
      
      if (!this.messaging) {
        console.warn('Firebase messaging not available - using fallback notifications');
        return;
      }

      // Set up foreground message handling
      this.setupForegroundMessageHandler();
      
      this.isInitialized = true;
      console.log('🔥 Firebase messaging service initialized');
      
    } catch (error) {
      console.error('Failed to initialize Firebase messaging service:', error);
      this.messaging = null;
    }
  }

  private async initializeAsync(): Promise<void> {
    // Deprecated - use initialize() instead
    await this.initialize();
  }

  /**
   * Get FCM registration token for push notifications
   */
  async getToken(): Promise<string | null> {
    try {
      if (!this.messaging) {
        console.warn('Firebase messaging not initialized');
        return null;
      }

      if (!VAPID_KEY) {
        console.warn('Firebase VAPID key not configured');
        return null;
      }

      // Check if notification permission is already granted
      if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted. User must enable notifications first.');
        return null;
      }

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: await this.getServiceWorkerRegistration()
      });

      if (token) {
        this.currentToken = token;
        console.log('🔑 FCM token obtained successfully');
        
        // Store token for debugging (remove in production)
        console.log('FCM Token (for server configuration):', token.substring(0, 20) + '...');
        
        return token;
      } else {
        console.warn('No FCM registration token available');
        return null;
      }
      
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  /**
   * Subscribe to push notifications with FCM
   */
  async subscribe(): Promise<FCMSubscription | null> {
    try {
      const token = await this.getToken();
      
      if (!token) {
        return null;
      }

      // Create subscription object
      const subscription: FCMSubscription = {
        token,
        endpoint: `https://fcm.googleapis.com/fcm/send/${token}`,
        expirationTime: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
      };

      console.log('✅ FCM subscription created');
      return subscription;
      
    } catch (error) {
      console.error('Failed to subscribe to FCM:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.messaging || !this.currentToken) {
        return false;
      }

      await deleteToken(this.messaging);
      this.currentToken = null;
      
      console.log('🚫 FCM subscription removed');
      return true;
      
    } catch (error) {
      console.error('Failed to unsubscribe from FCM:', error);
      return false;
    }
  }

  /**
   * Get current FCM status
   */
  async getStatus(): Promise<FCMStatus> {
    const firebaseStatus = getFirebaseStatus();
    
    return {
      supported: !!this.messaging && this.isInitialized,
      configured: firebaseStatus.configured,
      subscribed: !!this.currentToken,
      token: this.currentToken || undefined,
      error: !this.messaging && this.isInitialized ? 'Firebase messaging not available' : undefined
    };
  }

  /**
   * Set up foreground message handling
   */
  private setupForegroundMessageHandler(): void {
    if (!this.messaging) return;

    // Handle messages when app is in foreground
    onMessage(this.messaging, (payload: MessagePayload) => {
      console.log('📱 FCM message received in foreground:', payload);

      // Convert FCM payload to local notification format
      const notification = this.convertFCMToNotification(payload);
      
      // Show notification using service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: notification
        });
      }
      
      // Call custom message handler if set
      if (this.messageHandler) {
        this.messageHandler(payload);
      }
    });
  }

  /**
   * Set custom message handler for foreground messages
   */
  setMessageHandler(handler: (payload: MessagePayload) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Convert FCM message payload to local notification format
   */
  private convertFCMToNotification(payload: MessagePayload): NotificationPayload {
    const notification = payload.notification;
    
    return {
      title: notification?.title || 'MedTrack Reminder',
      body: notification?.body || 'Time for your medication',
      icon: notification?.icon || '/pill-icon.svg',
      badge: '/pill-icon.svg',
      data: payload.data || {},
      tag: payload.data?.medicationId ? `medication_${payload.data.medicationId}` : 'medtrack-notification',
      requireInteraction: true,
      actions: [
        { action: 'take', title: '✅ Taken', icon: '/pill-icon.svg' },
        { action: 'snooze', title: '⏰ Snooze 15min', icon: '/pill-icon.svg' },
        { action: 'skip', title: '⏸️ Skip', icon: '/pill-icon.svg' }
      ]
    };
  }

  /**
   * Get service worker registration for FCM
   */
  private async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    return registration;
  }

  /**
   * Test FCM functionality
   */
  async testFCM(): Promise<void> {
    try {
      const status = await this.getStatus();
      console.log('🧪 FCM Test Status:', status);
      
      if (!status.supported) {
        throw new Error('FCM not supported or configured');
      }
      
      if (!status.subscribed) {
        console.log('🔔 Subscribing to FCM...');
        const subscription = await this.subscribe();
        if (!subscription) {
          throw new Error('Failed to subscribe to FCM');
        }
        console.log('✅ FCM subscription successful');
      }
      
      console.log('✅ FCM test completed successfully');
      console.log('💡 To test push notifications, use the FCM token with your server or Firebase Console');
      
    } catch (error) {
      console.error('❌ FCM test failed:', error);
      throw error;
    }
  }

  /**
   * Get FCM diagnostics for debugging
   */
  getDiagnostics() {
    const firebaseStatus = getFirebaseStatus();
    
    return {
      firebaseConfigured: firebaseStatus.configured,
      messagingInitialized: !!this.messaging,
      hasToken: !!this.currentToken,
      isInitialized: this.isInitialized,
      vapidKeyPresent: !!VAPID_KEY,
      notificationPermission: Notification.permission,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      firebaseStatus
    };
  }
}

// Create singleton instance but don't initialize yet
const firebaseMessagingInstance = new FirebaseMessagingService();

// Export singleton instance
export const firebaseMessaging = firebaseMessagingInstance;
export default firebaseMessagingInstance;
