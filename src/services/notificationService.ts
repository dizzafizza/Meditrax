/**
 * Notification Service - Handles push notifications for medication reminders
 */

import { Reminder, Medication } from '@/types';
import { MEDICATION_DATABASE } from './medicationDatabase';
import { firebaseMessaging, type FCMSubscription, type FCMStatus } from './firebaseMessaging';
import { isFirebaseConfigured, VAPID_KEY } from '@/config/firebase';

export interface NotificationPermissionState {
  status: 'default' | 'granted' | 'denied';
  supported: boolean;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

export interface ScheduledNotification {
  id: string;
  reminderId: string;
  medicationId: string;
  scheduledTime: Date;
  payload: NotificationPayload;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  retryCount?: number;
}

class NotificationService {
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private pushSubscription: PushSubscription | null = null;
  
  // VAPID key for push notifications (uses Firebase VAPID key)
  private readonly VAPID_PUBLIC_KEY = VAPID_KEY || null;
  
  // Firebase Cloud Messaging support
  private fcmSubscription: FCMSubscription | null = null;
  private useFirebase = false;
  
  private readonly NOTIFICATION_STORAGE_KEY = 'meditrax_scheduled_notifications';
  private readonly NOTIFICATION_QUEUE_KEY = 'meditrax_notification_queue';
  private readonly BADGE_COUNT_KEY = 'meditrax_badge_count';
  private readonly FCM_TOKEN_KEY = 'meditrax_fcm_token';
  
  private pushNotificationsAvailable = false;
  private visibilityChangeHandler: (() => void) | null = null;
  private isAppVisible = !document.hidden;
  private lastVisibilityCheck = Date.now();
  private currentBadgeCount = 0;
  private lastPermissionCheck: { status: NotificationPermission; timestamp: number } | null = null;

  constructor() {
    this.initializeService();
    this.setupVisibilityHandling();
    this.setupBeforeUnloadHandler();
  }

  // Get random motivational message for a medication
  private getMotivationalMessage(medicationName: string): string {
    const defaultMessages = [
      "You're taking great care of your health! 🌟",
      "Every dose is a step toward better wellness! 💪",
      "Staying consistent with your medication matters! 🎯",
      "Great job prioritizing your health today! ✨",
      "You're doing amazing managing your medications! 🏆",
      "Small steps, big impact on your wellbeing! 🌱",
      "Your health journey is worth celebrating! 🎉",
      "Consistency is the key to success! 🔑"
    ];

    try {
      // Find medication in database
      const medicationData = MEDICATION_DATABASE.find(med => 
        med.name.toLowerCase().includes(medicationName.toLowerCase()) ||
        med.genericName?.toLowerCase().includes(medicationName.toLowerCase()) ||
        med.brandNames?.some(brand => brand.toLowerCase().includes(medicationName.toLowerCase()))
      );

      if (medicationData?.psychologicalSupport?.motivationalMessages?.length) {
        const messages = medicationData.psychologicalSupport.motivationalMessages;
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        return randomMessage;
      }
    } catch (error) {
      console.warn('Error getting medication-specific motivational message:', error);
    }

    // Fall back to default messages
    return defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
  }

  private async initializeService(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker not supported');
        return;
      }

      this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully');

      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
      this.loadScheduledNotifications();
      this.loadBadgeCount();
      this.loadFCMToken();
      this.checkMissedNotifications();

      // Try Firebase first, then fallback to legacy VAPID
      await this.initializePushNotifications();

    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  private async initializePushNotifications(): Promise<void> {
    try {
      // Check if Firebase is configured and available
      if (isFirebaseConfigured()) {
        console.log('🔥 Attempting Firebase Cloud Messaging setup...');
        const success = await this.initializeFirebaseMessaging();
        
        if (success) {
          this.useFirebase = true;
          this.pushNotificationsAvailable = true;
          console.log('✅ Firebase Cloud Messaging initialized successfully');
          
          if (this.isIOSPWA()) {
            console.log('📱 iOS PWA detected - Firebase FCM provides optimal push notification support');
          }
          return;
        }
      }

      // Fallback to legacy VAPID if Firebase not available
      if (this.VAPID_PUBLIC_KEY && this.isValidVapidKey(this.VAPID_PUBLIC_KEY)) {
        console.log('🔄 Firebase unavailable - using legacy VAPID push notifications...');
        this.subscribeToPushNotifications().catch(error => {
          console.info('Legacy push notifications not initialized:', error.message);
          this.fallbackToServiceWorkerNotifications();
        });
      } else {
        this.fallbackToServiceWorkerNotifications();
      }

    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      this.fallbackToServiceWorkerNotifications();
    }
  }

  private async initializeFirebaseMessaging(): Promise<boolean> {
    try {
      // Test Firebase messaging availability
      const fcmStatus = await firebaseMessaging.getStatus();
      
      if (!fcmStatus.supported || !fcmStatus.configured) {
        console.warn('Firebase messaging not supported or configured');
        return false;
      }

      // Subscribe to FCM
      this.fcmSubscription = await firebaseMessaging.subscribe();
      
      if (!this.fcmSubscription) {
        console.warn('Failed to subscribe to Firebase Cloud Messaging');
        return false;
      }

      // Save FCM token for persistence
      this.saveFCMToken(this.fcmSubscription.token);
      
      // Set up message handler for foreground notifications
      firebaseMessaging.setMessageHandler((payload) => {
        console.log('📱 Foreground FCM message received:', payload);
        // Handle foreground messages if needed
      });

      return true;
      
    } catch (error) {
      console.error('Firebase messaging initialization failed:', error);
      return false;
    }
  }

  private fallbackToServiceWorkerNotifications(): void {
    console.info('🔧 Using enhanced service worker notifications for reliable delivery.');
    
    // For iOS PWA, show helpful message
    if (this.isIOSPWA()) {
      console.info('📱 iOS PWA detected - using optimized service worker notification delivery.');
    }
    
    this.useFirebase = false;
    this.pushNotificationsAvailable = false;
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    
    switch (type) {
      case 'NOTIFICATION_CLICKED':
        this.handleNotificationClick(data);
        break;
      case 'MEDICATION_TAKEN':
        this.handleMedicationTaken(data);
        break;
      case 'MEDICATION_SNOOZED':
        this.handleMedicationSnoozed(data);
        break;
      case 'CHECK_MISSED_NOTIFICATIONS':
      case 'SYNC_REMINDERS_REQUEST':
      case 'SYNC_MEDICATION_ACTION':
      case 'NOTIFICATION_SENT':
        // These messages are handled by useNotificationHandler hook
        break;
      default:
        console.log('Unknown service worker message:', type, data);
    }
  }

  async getPermissionState(): Promise<NotificationPermissionState> {
    if (!('Notification' in window)) {
      return { status: 'denied', supported: false };
    }

    const status = Notification.permission as 'default' | 'granted' | 'denied';
    const now = Date.now();
    
    // Only log permission status if it changed or it's been more than 30 seconds
    if (!this.lastPermissionCheck || 
        this.lastPermissionCheck.status !== status || 
        now - this.lastPermissionCheck.timestamp > 30000) {
      
      console.log('Notification permission status:', status, 'Supported:', true);
      this.lastPermissionCheck = { status, timestamp: now };
    }
    
    return { status, supported: true };
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported in this browser');
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  private isValidVapidKey(key: string | null): boolean {
    if (!key || key.length < 10 || key.includes('YOUR_VAPID_PUBLIC_KEY_HERE')) {
      return false;
    }
    try {
      this.urlBase64ToUint8Array(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  async subscribeToPushNotifications(): Promise<PushSubscription | null> {
    try {
      if (!this.serviceWorkerRegistration) {
        console.warn('Service Worker not registered - push notifications unavailable');
        return null;
      }

      if (!this.VAPID_PUBLIC_KEY || !this.isValidVapidKey(this.VAPID_PUBLIC_KEY)) {
        console.warn('VAPID public key not configured or invalid - push notifications unavailable');
        this.pushNotificationsAvailable = false;
        return null;
      }

      this.pushSubscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      
      if (!this.pushSubscription) {
        this.pushSubscription = await this.serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY)
        });
      }

      this.pushNotificationsAvailable = true;
      return this.pushSubscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      this.pushNotificationsAvailable = false;
      return null;
    }
  }

  async scheduleReminder(reminder: Reminder, medication: Medication): Promise<void> {
    try {
      const now = new Date();
      const notificationId = `${reminder.id}_${Date.now()}`;
      
      // Check if browser supports notifications at all
      const permissionState = await this.getPermissionState();
      if (!permissionState.supported) {
        console.warn(`Browser notifications not supported for reminder ${reminder.id}`);
        return;
      }
      
      // Use enhanced service worker notifications for all platforms
      console.info(`📅 Scheduling enhanced notification for reminder ${reminder.id} using service worker delivery.`);
      
      const nextNotificationTime = this.calculateNextNotificationTime(reminder, now);
      
      if (!nextNotificationTime) {
        console.warn(`Could not calculate next notification time for reminder ${reminder.id}`);
        return;
      }

      console.log(`Scheduling notification for ${nextNotificationTime.toLocaleString()} (in ${Math.round((nextNotificationTime.getTime() - now.getTime()) / 1000 / 60)} minutes)`);

      // Get motivational message for this medication
      const motivationalMessage = this.getMotivationalMessage(medication.name);
      
      const payload: NotificationPayload = {
        title: `💊 Time for ${medication.name}`,
        body: reminder.customMessage || `Take your ${medication.dosage}${medication.unit} dose of ${medication.name}\n\n${motivationalMessage}`,
        icon: '/pill-icon.svg',
        badge: '/pill-icon.svg',
        actions: [
          { action: 'take', title: '✅ Taken', icon: '/pill-icon.svg' },
          { action: 'snooze', title: '⏰ Remind me in 5 min', icon: '/pill-icon.svg' },
          { action: 'skip', title: '⏸️ Skip this dose', icon: '/pill-icon.svg' }
        ],
        data: {
          medicationId: medication.id,
          reminderId: reminder.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          unit: medication.unit,
          timestamp: nextNotificationTime.getTime(),
          motivationalMessage: motivationalMessage
        },
        tag: `medication_${medication.id}`,
        requireInteraction: true
      };

      const scheduledNotification: ScheduledNotification = {
        id: notificationId,
        reminderId: reminder.id,
        medicationId: medication.id,
        scheduledTime: nextNotificationTime,
        payload,
        status: 'scheduled'
      };

      this.scheduledNotifications.set(notificationId, scheduledNotification);
      this.saveScheduledNotifications();
      await this.scheduleNotification(scheduledNotification);

    } catch (error) {
      console.error('Failed to schedule reminder:', error);
    }
  }

  cancelReminder(reminderId: string): void {
    for (const [id, notification] of this.scheduledNotifications.entries()) {
      if (notification.reminderId === reminderId) {
        notification.status = 'cancelled';
        this.scheduledNotifications.delete(id);
      }
    }
    this.saveScheduledNotifications();
  }

  async sendImmediateNotification(payload: NotificationPayload): Promise<void> {
    try {
      const permissionState = await this.getPermissionState();
      
      if (permissionState.status !== 'granted') {
        console.warn('Notification permission not granted, requesting permission...');
        const granted = await this.requestPermission();
        if (!granted) {
          throw new Error('Notification permission denied by user');
        }
      }

      console.log('Sending immediate notification:', payload.title);

      // Enhanced notification options for iOS PWA compatibility
      const notificationOptions = {
        body: payload.body,
        icon: payload.icon || '/pill-icon.svg',
        badge: payload.badge || '/pill-icon.svg',
        data: payload.data,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction !== false,
        actions: payload.actions,
        vibrate: [200, 100, 200],
        silent: false,
        // iOS PWA enhancements
        renotify: true, // Allow replacing previous notifications
        timestamp: Date.now(),
      };

      if (this.serviceWorkerRegistration) {
        console.log('Using service worker to show notification');
        await this.serviceWorkerRegistration.showNotification(payload.title, notificationOptions);
      } else {
        console.log('Using basic notification API');
        const notification = new Notification(payload.title, {
          body: notificationOptions.body,
          icon: notificationOptions.icon,
          tag: notificationOptions.tag,
          data: notificationOptions.data,
          requireInteraction: notificationOptions.requireInteraction
        });
        
        // Auto-close after 10 seconds if not interactive
        if (!payload.requireInteraction) {
          setTimeout(() => notification.close(), 10000);
        }
      }
      
      console.log('Notification sent successfully');
    } catch (error) {
      console.error('Failed to send immediate notification:', error);
      throw error;
    }
  }

  private calculateNextNotificationTime(reminder: Reminder, fromDate: Date): Date | null {
    const [hours, minutes] = reminder.time.split(':').map(Number);
    const now = new Date(fromDate);
    
    console.log(`Calculating next notification time for reminder ${reminder.id}:`);
    console.log(`  - Time: ${reminder.time} (${hours}:${minutes})`);
    console.log(`  - Days: ${reminder.days.join(', ')}`);
    console.log(`  - From date: ${now.toLocaleString()}`);
    
    if (!reminder.days || reminder.days.length === 0) {
      console.warn('Reminder has no days selected');
      return null;
    }
    
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) { // Check 2 weeks ahead
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + dayOffset);
      checkDate.setHours(hours, minutes, 0, 0);
      
      // Skip if time has already passed today
      if (dayOffset === 0 && checkDate <= now) {
        console.log(`  - Skipping today (${checkDate.toLocaleString()}) - time has passed`);
        continue;
      }
      
      const dayName = checkDate.toLocaleDateString('en', { weekday: 'long' }).toLowerCase() as any;
      
      console.log(`  - Checking ${dayName} (${checkDate.toLocaleDateString()}): ${reminder.days.includes(dayName) ? 'MATCH' : 'skip'}`);
      
      if (reminder.days.includes(dayName)) {
        console.log(`  - Next notification scheduled for: ${checkDate.toLocaleString()}`);
        return checkDate;
      }
    }
    
    console.warn('No valid notification time found in the next 14 days');
    return null;
  }

  private async scheduleNotification(scheduledNotification: ScheduledNotification): Promise<void> {
    const now = new Date().getTime();
    const scheduledTime = scheduledNotification.scheduledTime.getTime();
    const delay = scheduledTime - now;

    console.log(`📅 Scheduling notification with delay: ${Math.round(delay / 1000 / 60)} minutes (${Math.round(delay / 1000)} seconds)`);

    // **IMMEDIATE NOTIFICATIONS**: Send right away if within 5 minutes for better reliability
    if (delay <= 5 * 60 * 1000) { // Within 5 minutes - more generous for iOS
      console.log('🚀 Sending immediate notification (within 5 minutes)');
      try {
        await this.sendImmediateNotificationWithBadge(scheduledNotification.payload, true);
        scheduledNotification.status = 'sent';
        
        // Still schedule with service worker as backup for iOS PWA reliability
        if (this.serviceWorkerRegistration) {
          this.serviceWorkerRegistration.active?.postMessage({
            type: 'SCHEDULE_NOTIFICATION',
            data: {
              id: scheduledNotification.id + '_backup',
              scheduledTime: scheduledTime,
              title: scheduledNotification.payload.title,
              body: scheduledNotification.payload.body,
              icon: scheduledNotification.payload.icon || '/pill-icon.svg',
              badge: scheduledNotification.payload.badge || '/pill-icon.svg',
              data: scheduledNotification.payload.data,
              tag: scheduledNotification.payload.tag,
              requireInteraction: scheduledNotification.payload.requireInteraction !== false,
              actions: scheduledNotification.payload.actions,
              status: 'backup'
            }
          });
          console.log('✅ Backup notification scheduled with service worker');
        }
        
        console.log('✅ Immediate notification sent with backup scheduled');
        return;
      } catch (error) {
        console.error('❌ Failed to send immediate notification, using service worker:', error);
        // Continue with service worker fallback
      }
    }

    // **CRITICAL FOR CLOSED-APP**: Send notification data to service worker for persistent scheduling
    if (this.serviceWorkerRegistration) {
      try {
        // Send scheduling message to service worker - this enables notifications when app is closed
        this.serviceWorkerRegistration.active?.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          data: {
            id: scheduledNotification.id,
            scheduledTime: scheduledTime,
            title: scheduledNotification.payload.title,
            body: scheduledNotification.payload.body,
            icon: scheduledNotification.payload.icon || '/pill-icon.svg',
            badge: scheduledNotification.payload.badge || '/pill-icon.svg',
            data: scheduledNotification.payload.data,
            tag: scheduledNotification.payload.tag,
            requireInteraction: scheduledNotification.payload.requireInteraction !== false,
            actions: scheduledNotification.payload.actions,
            status: 'scheduled'
          }
        });
        console.log('✅ Sent notification schedule to service worker for closed-app delivery');
      } catch (error) {
        console.warn('Failed to send schedule to service worker:', error);
      }
    }

    // ALWAYS store in queue for persistence (regardless of delay)
    this.addToNotificationQueue(scheduledNotification);
    console.log(`Added notification to queue. Queue size: ${this.getNotificationQueue().length}`);

    // **REMOVED setTimeout - doesn't work when app is closed**
    // All scheduled notifications now go through service worker for reliable delivery
    console.log('✅ Relying on service worker for all scheduled notifications (works when app is closed)');

    // **ENHANCED BACKGROUND SYNC** for reliable closed-app notifications
    if (this.serviceWorkerRegistration) {
      try {
        // Background sync (triggered when connectivity restored)
        if ('sync' in window.ServiceWorkerRegistration.prototype) {
          await this.serviceWorkerRegistration.sync.register('check-notifications');
          console.log('✅ Background sync registered successfully');
        }
        
        // **Periodic background sync** for regular checks (key for iOS PWA closed-app notifications)
        if ('periodicSync' in window.ServiceWorkerRegistration.prototype) {
          try {
            await (this.serviceWorkerRegistration as any).periodicSync.register('check-medication-reminders', {
              minInterval: 15 * 60 * 1000, // Check every 15 minutes minimum
            });
            console.log('✅ Periodic background sync registered for closed-app notifications');
          } catch (error) {
            console.log('⚠️ Periodic sync not available or permission denied:', error.message);
          }
        }
        
      } catch (error) {
        console.log('⚠️ Background sync not available:', error);
      }
    } else {
      console.warn('⚠️ Service Worker not available - notifications will only work when app is open');
    }
  }

  private handleNotificationClick(data: any): void {
    const { action, medicationId, reminderId } = data;
    
    switch (action) {
      case 'take':
        this.markMedicationAsTaken(medicationId, reminderId);
        break;
      case 'snooze':
        this.snoozeMedication(medicationId, reminderId, 15);
        break;
      case 'skip':
        this.skipMedication(medicationId, reminderId);
        break;
      default:
        this.openApp(`/medications/${medicationId}`);
    }
  }

  private handleMedicationTaken(data: any): void {
    window.postMessage({ 
      type: 'MEDICATION_TAKEN', 
      medicationId: data.medicationId,
      timestamp: new Date()
    }, '*');
  }

  private handleMedicationSnoozed(data: any): void {
    window.postMessage({ 
      type: 'MEDICATION_SNOOZED', 
      medicationId: data.medicationId,
      snoozeMinutes: data.snoozeMinutes,
      timestamp: new Date()
    }, '*');
  }

  private markMedicationAsTaken(medicationId: string, reminderId: string): void {
    window.postMessage({ 
      type: 'MARK_MEDICATION_TAKEN', 
      medicationId, 
      reminderId,
      timestamp: new Date()
    }, '*');
  }

  private snoozeMedication(medicationId: string, reminderId: string, minutes: number): void {
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
    window.postMessage({ 
      type: 'SNOOZE_MEDICATION', 
      medicationId, 
      reminderId,
      snoozeUntil
    }, '*');
  }

  private skipMedication(medicationId: string, reminderId: string): void {
    window.postMessage({ 
      type: 'SKIP_MEDICATION', 
      medicationId, 
      reminderId,
      timestamp: new Date()
    }, '*');
  }

  private openApp(path: string = '/'): void {
    if ('clients' in self && typeof self !== 'undefined') {
      (self as any).clients.openWindow(path);
    } else {
      window.focus();
      if (path !== '/') {
        window.location.hash = path;
      }
    }
  }

  private saveScheduledNotifications(): void {
    const notifications = Array.from(this.scheduledNotifications.values());
    localStorage.setItem(this.NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
  }

  private loadScheduledNotifications(): void {
    try {
      const stored = localStorage.getItem(this.NOTIFICATION_STORAGE_KEY);
      if (stored) {
        const notifications: ScheduledNotification[] = JSON.parse(stored);
        notifications.forEach(notification => {
          notification.scheduledTime = new Date(notification.scheduledTime);
          this.scheduledNotifications.set(notification.id, notification);
        });
      }
    } catch (error) {
      console.error('Failed to load scheduled notifications:', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    try {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (error) {
      throw new Error(`Invalid VAPID key format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isPushNotificationAvailable(): boolean {
    if (this.useFirebase) {
      return this.pushNotificationsAvailable && !!this.fcmSubscription;
    }
    return this.pushNotificationsAvailable && !!this.pushSubscription;
  }

  async getPushNotificationStatus(): Promise<{
    supported: boolean;
    configured: boolean;
    subscribed: boolean;
    permission: NotificationPermission;
    usingFirebase?: boolean;
    fcmStatus?: FCMStatus;
  }> {
    const permissionState = await this.getPermissionState();
    
    const status = {
      supported: 'serviceWorker' in navigator && 'PushManager' in window,
      configured: this.useFirebase ? isFirebaseConfigured() : (!!this.VAPID_PUBLIC_KEY && this.isValidVapidKey(this.VAPID_PUBLIC_KEY)),
      subscribed: this.isPushNotificationAvailable(),
      permission: permissionState.status,
      usingFirebase: this.useFirebase
    };

    // Add Firebase-specific status if using Firebase
    if (this.useFirebase) {
      status.fcmStatus = await firebaseMessaging.getStatus();
    }

    return status;
  }

  getScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values());
  }

  async testNotification(): Promise<void> {
    const payload: NotificationPayload = {
      title: '🧪 Test Notification',
      body: 'Meditrax notifications are working correctly! ✅',
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      requireInteraction: false,
      tag: 'test-notification',
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    };

    await this.sendImmediateNotification(payload);
  }

  async testScheduledNotification(delayMinutes: number = 1): Promise<void> {
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    const payload: NotificationPayload = {
      title: '🧪 Scheduled Test Notification',
      body: `This was scheduled ${delayMinutes} minute(s) ago! Closed-app delivery works! 🚀`,
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      requireInteraction: true,
      tag: 'scheduled-test-notification',
      actions: [
        { action: 'confirm', title: '✅ Got it!', icon: '/pill-icon.svg' },
        { action: 'close', title: '❌ Close', icon: '/pill-icon.svg' }
      ],
      data: {
        type: 'scheduled-test',
        originalScheduleTime: scheduledTime.getTime(),
        timestamp: Date.now()
      }
    };

    const scheduledNotification: ScheduledNotification = {
      id: `test-scheduled-${Date.now()}`,
      payload,
      scheduledTime,
      status: 'scheduled'
    };

    console.log(`🧪 Scheduling test notification for ${scheduledTime.toLocaleString()}`);
    await this.scheduleNotification(scheduledNotification);
    
    console.log(`✅ Test notification scheduled - close the app to test closed-app delivery!`);
  }

  // New methods for enhanced background notification handling

  private setupVisibilityHandling(): void {
    this.visibilityChangeHandler = () => {
      const isVisible = !document.hidden;
      
      if (!this.isAppVisible && isVisible) {
        // App became visible, check for missed notifications
        console.log('App became visible, checking for missed notifications');
        this.checkMissedNotifications();
      }
      
      // **CRITICAL FOR CLOSED-APP NOTIFICATIONS**: Notify service worker of visibility changes
      if (this.serviceWorkerRegistration && this.isAppVisible !== isVisible) {
        this.serviceWorkerRegistration.active?.postMessage({
          type: 'APP_VISIBILITY_CHANGED',
          data: { 
            visible: isVisible,
            timestamp: Date.now()
          }
        });
        console.log(`Notified service worker: app ${isVisible ? 'visible' : 'hidden'}`);
      }
      
      this.isAppVisible = isVisible;
      this.lastVisibilityCheck = Date.now();
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    
    // Also check on page focus/blur
    window.addEventListener('focus', () => {
      if (!this.isAppVisible) {
        this.checkMissedNotifications();
        this.isAppVisible = true;
        
        // Notify service worker
        if (this.serviceWorkerRegistration) {
          this.serviceWorkerRegistration.active?.postMessage({
            type: 'APP_VISIBILITY_CHANGED',
            data: { 
              visible: true,
              timestamp: Date.now(),
              trigger: 'focus'
            }
          });
        }
      }
    });
    
    window.addEventListener('blur', () => {
      this.isAppVisible = false;
      this.lastVisibilityCheck = Date.now();
      
      // Notify service worker that app is hidden
      if (this.serviceWorkerRegistration) {
        this.serviceWorkerRegistration.active?.postMessage({
          type: 'APP_VISIBILITY_CHANGED',
          data: { 
            visible: false,
            timestamp: Date.now(),
            trigger: 'blur'
          }
        });
        console.log('Notified service worker: app hidden (blur)');
      }
    });
  }

  private setupBeforeUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Save current state before app closes
      this.lastVisibilityCheck = Date.now();
      this.saveScheduledNotifications();
    });
  }

  private addToNotificationQueue(notification: ScheduledNotification): void {
    try {
      const queue = this.getNotificationQueue();
      queue.push({
        ...notification,
        queuedAt: Date.now()
      });
      localStorage.setItem(this.NOTIFICATION_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to add notification to queue:', error);
    }
  }

  private getNotificationQueue(): any[] {
    try {
      const stored = localStorage.getItem(this.NOTIFICATION_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load notification queue:', error);
      return [];
    }
  }

  private removeFromNotificationQueue(notificationId: string): void {
    try {
      const queue = this.getNotificationQueue();
      const updatedQueue = queue.filter(n => n.id !== notificationId);
      localStorage.setItem(this.NOTIFICATION_QUEUE_KEY, JSON.stringify(updatedQueue));
      console.log(`Removed notification ${notificationId} from queue`);
    } catch (error) {
      console.error('Failed to remove notification from queue:', error);
    }
  }

  async checkMissedNotifications(): Promise<void> {
    try {
      const now = Date.now();
      const queue = this.getNotificationQueue();
      const allMissedNotifications: any[] = [];
      
      // Check queued notifications
      for (const notification of queue) {
        const scheduledTime = new Date(notification.scheduledTime).getTime();
        if (scheduledTime <= now && scheduledTime > (this.lastVisibilityCheck - 60000)) {
          allMissedNotifications.push(notification);
        }
      }

      // Check currently scheduled notifications
      for (const [id, notification] of this.scheduledNotifications.entries()) {
        const scheduledTime = notification.scheduledTime.getTime();
        if (scheduledTime <= now && notification.status === 'scheduled') {
          allMissedNotifications.push(notification);
        }
      }

      if (allMissedNotifications.length === 0) {
        return;
      }

      // **FIX iOS PWA BATCHING ISSUE** 
      // Deduplicate notifications per medication (keep only the most recent per medication)
      const medicationNotifications = new Map<string, any>();
      for (const notification of allMissedNotifications) {
        const medicationId = notification.medicationId || notification.payload?.data?.medicationId;
        if (medicationId) {
          const existing = medicationNotifications.get(medicationId);
          if (!existing || new Date(notification.scheduledTime).getTime() > new Date(existing.scheduledTime).getTime()) {
            medicationNotifications.set(medicationId, notification);
          }
        }
      }

      const deduplicatedNotifications = Array.from(medicationNotifications.values());
      console.log(`Deduplicated ${allMissedNotifications.length} notifications to ${deduplicatedNotifications.length} (one per medication)`);

      // **SMART BATCHING**: If more than 2 missed medications, send a summary notification
      if (deduplicatedNotifications.length > 2) {
        const medicationNames = deduplicatedNotifications
          .map(n => n.payload?.data?.medicationName || 'Unknown medication')
          .slice(0, 3); // Show max 3 medication names
        
        const summaryTitle = `💊 ${deduplicatedNotifications.length} Missed Medications`;
        const summaryBody = deduplicatedNotifications.length > 3 
          ? `${medicationNames.join(', ')} and ${deduplicatedNotifications.length - 3} more\n\nTap to review your missed doses 📝`
          : `${medicationNames.join(', ')}\n\nTap to review your missed doses 📝`;

        // Send single summary notification
        await this.sendImmediateNotificationWithBadge({
          title: summaryTitle,
          body: summaryBody,
          icon: '/pill-icon.svg',
          badge: '/pill-icon.svg',
          tag: 'missed-medications-summary',
          requireInteraction: true,
          data: {
            type: 'missed-summary',
            count: deduplicatedNotifications.length,
            medications: medicationNames
          }
        }, false); // Don't increment badge for summary

        // Update badge count to reflect total missed
        await this.setBadgeCount(deduplicatedNotifications.length);

      } else {
        // **THROTTLED INDIVIDUAL NOTIFICATIONS**: Send up to 2 individual notifications with delay
        for (let i = 0; i < Math.min(2, deduplicatedNotifications.length); i++) {
          const notification = deduplicatedNotifications[i];
          try {
            // Add small delay between notifications to prevent overwhelming
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }

            await this.sendImmediateNotificationWithBadge(notification.payload, true);
            notification.status = 'sent';
            
          } catch (error) {
            console.error('Failed to send missed notification:', error);
            notification.status = 'failed';
            notification.retryCount = (notification.retryCount || 0) + 1;
          }
        }
      }

      // Clean up ALL processed notifications from queue and scheduled
      for (const notification of allMissedNotifications) {
        if (this.scheduledNotifications.has(notification.id)) {
          this.scheduledNotifications.delete(notification.id);
        }
      }

      const remainingQueue = queue.filter(n => 
        !allMissedNotifications.some(missed => missed.id === n.id)
      );
      localStorage.setItem(this.NOTIFICATION_QUEUE_KEY, JSON.stringify(remainingQueue));
      this.saveScheduledNotifications();

      console.log(`Processed ${allMissedNotifications.length} missed notifications (sent ${Math.min(deduplicatedNotifications.length > 2 ? 1 : deduplicatedNotifications.length, 2)} notifications)`);

    } catch (error) {
      console.error('Failed to check missed notifications:', error);
    }
  }

  // Enhanced scheduling that considers app state
  async scheduleReminderEnhanced(reminder: any, medication: any): Promise<void> {
    console.log('=== Enhanced Reminder Scheduling ===');
    console.log('Reminder:', reminder);
    console.log('Medication:', medication);
    
    await this.scheduleReminder(reminder, medication);
    
    console.log(`After scheduling - Queue size: ${this.getNotificationQueue().length}, Scheduled: ${this.scheduledNotifications.size}`);
    
    // If service worker supports periodic background sync, register it
    if (this.serviceWorkerRegistration && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
      try {
        // @ts-ignore - periodicSync is experimental
        await this.serviceWorkerRegistration.periodicSync.register('check-medication-reminders', {
          minInterval: 15 * 60 * 1000, // 15 minutes minimum
        });
        console.log('Periodic background sync registered');
      } catch (error) {
        console.log('Periodic background sync not available:', error);
      }
    }
  }

  // Get notification system diagnostics
  async getNotificationDiagnostics(): Promise<{
    scheduledCount: number;
    queuedCount: number;
    pushAvailable: boolean;
    serviceWorkerActive: boolean;
    visibilitySupported: boolean;
    backgroundSyncSupported: boolean;
    periodicSyncSupported: boolean;
    lastVisibilityCheck: string;
    notificationPermission: string;
    vapidKeyConfigured: boolean;
    browserSupportsNotifications: boolean;
    pushSubscription: boolean;
    badgeCount: number;
    badgeSupported: boolean;
    isIOSPWA: boolean;
    isIOSDevice: boolean;
    iosWebPushSupported: boolean;
    // Firebase-specific diagnostics
    usingFirebase: boolean;
    firebaseConfigured: boolean;
    fcmSubscription: boolean;
    fcmToken?: string;
  }> {
    const permissionState = await this.getPermissionState();
    
    const diagnostics = {
      scheduledCount: this.scheduledNotifications.size,
      queuedCount: this.getNotificationQueue().length,
      pushAvailable: this.isPushNotificationAvailable(),
      serviceWorkerActive: !!this.serviceWorkerRegistration?.active,
      visibilitySupported: 'visibilityState' in document,
      backgroundSyncSupported: this.serviceWorkerRegistration ? 'sync' in window.ServiceWorkerRegistration.prototype : false,
      periodicSyncSupported: this.serviceWorkerRegistration ? 'periodicSync' in window.ServiceWorkerRegistration.prototype : false,
      lastVisibilityCheck: new Date(this.lastVisibilityCheck).toLocaleString(),
      notificationPermission: permissionState.status,
      vapidKeyConfigured: !!this.VAPID_PUBLIC_KEY && this.isValidVapidKey(this.VAPID_PUBLIC_KEY),
      browserSupportsNotifications: permissionState.supported,
      pushSubscription: !!this.pushSubscription,
      badgeCount: this.currentBadgeCount,
      badgeSupported: 'setAppBadge' in navigator,
      isIOSPWA: this.isIOSPWA(),
      isIOSDevice: this.isIOSDevice(),
      iosWebPushSupported: this.isIOSWebPushSupported(),
      // Firebase-specific diagnostics
      usingFirebase: this.useFirebase,
      firebaseConfigured: isFirebaseConfigured(),
      fcmSubscription: !!this.fcmSubscription,
      fcmToken: this.fcmSubscription ? this.fcmSubscription.token.substring(0, 20) + '...' : undefined
    };

    return diagnostics;
  }

  // Manual trigger to check and process missed notifications
  async triggerNotificationCheck(): Promise<{
    checked: number;
    sent: number;
    failed: number;
  }> {
    console.log('=== Manual Notification Check Triggered ===');
    const beforeQueue = this.getNotificationQueue().length;
    const beforeScheduled = this.scheduledNotifications.size;
    
    console.log(`Before check - Queue: ${beforeQueue}, Scheduled: ${beforeScheduled}`);
    
    await this.checkMissedNotifications();
    
    const afterQueue = this.getNotificationQueue().length;
    const afterScheduled = this.scheduledNotifications.size;
    
    console.log(`After check - Queue: ${afterQueue}, Scheduled: ${afterScheduled}`);
    
    const result = {
      checked: beforeQueue + beforeScheduled,
      sent: (beforeQueue - afterQueue) + (beforeScheduled - afterScheduled),
      failed: 0 // TODO: Track failed notifications
    };
    
    console.log('Check result:', result);
    return result;
  }

  // Debug method to test notification immediately
  async debugTestNotification(): Promise<void> {
    console.log('=== Debug Test Notification ===');
    const diagnostics = await this.getNotificationDiagnostics();
    console.log('Current diagnostics:', diagnostics);
    
    const payload: NotificationPayload = {
      title: 'DEBUG: MedTrack Test',
      body: 'If you see this, notifications are working!',
      icon: '/pill-icon.svg',
      requireInteraction: true
    };
    
    try {
      await this.sendImmediateNotification(payload);
      console.log('Debug notification sent successfully');
    } catch (error) {
      console.error('Debug notification failed:', error);
      throw error;
    }
  }


  // Get FCM token for server-side push notifications
  getFCMToken(): string | null {
    if (this.useFirebase && this.fcmSubscription) {
      return this.fcmSubscription.token;
    }
    return null;
  }

  // Get Firebase messaging diagnostics
  async getFirebaseDiagnostics() {
    if (!this.useFirebase) {
      return { error: 'Firebase not in use' };
    }
    
    return firebaseMessaging.getDiagnostics();
  }

  // Debug method to check reminder scheduling status
  debugReminderSystem(reminders: any[], medications: any[]): void {
    console.log('=== DEBUG REMINDER SYSTEM ===');
    console.log('Total reminders:', reminders.length);
    console.log('Active reminders:', reminders.filter(r => r.isActive).length);
    console.log('Total medications:', medications.length);
    console.log('Active medications:', medications.filter(m => m.isActive).length);
    
    console.log('\nREMINDER DETAILS:');
    reminders.forEach((reminder, index) => {
      const medication = medications.find(m => m.id === reminder.medicationId);
      console.log(`${index + 1}. Reminder ${reminder.id}:`);
      console.log(`   - Medication: ${medication?.name || 'NOT FOUND'}`);
      console.log(`   - Time: ${reminder.time}`);
      console.log(`   - Days: ${reminder.days?.join(', ') || 'NONE'}`);
      console.log(`   - Active: ${reminder.isActive}`);
      console.log(`   - Created: ${reminder.createdAt}`);
      
      if (reminder.isActive && medication) {
        const nextTime = this.calculateNextNotificationTime(reminder, new Date());
        console.log(`   - Next notification: ${nextTime ? nextTime.toLocaleString() : 'NONE CALCULATED'}`);
      }
    });
    
    console.log('\nCURRENT NOTIFICATION STATE:');
    console.log(`- Scheduled notifications: ${this.scheduledNotifications.size}`);
    console.log(`- Queued notifications: ${this.getNotificationQueue().length}`);
    
    console.log('\nSCHEDULED NOTIFICATIONS:');
    this.scheduledNotifications.forEach((notification, id) => {
      console.log(`- ${id}: ${notification.payload.title} at ${notification.scheduledTime.toLocaleString()}`);
    });
    
    console.log('\nQUEUED NOTIFICATIONS:');
    this.getNotificationQueue().forEach((notification, index) => {
      console.log(`- ${index}: ${notification.payload?.title} at ${new Date(notification.scheduledTime).toLocaleString()}`);
    });
  }

  // Badge Management (iOS 16.4+ PWA Support)
  
  async setBadgeCount(count: number): Promise<void> {
    try {
      this.currentBadgeCount = count;
      localStorage.setItem(this.BADGE_COUNT_KEY, count.toString());
      
      // Use Badging API if available (iOS 16.4+, Chrome, etc.)
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
          console.log(`Badge set to ${count}`);
        } else {
          await (navigator as any).clearAppBadge();
          console.log('Badge cleared');
        }
      } else {
        console.log(`Badge API not available. Count would be: ${count}`);
      }
    } catch (error) {
      console.error('Failed to set badge count:', error);
    }
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  incrementBadgeCount(): Promise<void> {
    return this.setBadgeCount(this.currentBadgeCount + 1);
  }

  decrementBadgeCount(): Promise<void> {
    const newCount = Math.max(0, this.currentBadgeCount - 1);
    return this.setBadgeCount(newCount);
  }

  getBadgeCount(): number {
    return this.currentBadgeCount;
  }

  private loadBadgeCount(): void {
    try {
      const stored = localStorage.getItem(this.BADGE_COUNT_KEY);
      this.currentBadgeCount = stored ? parseInt(stored, 10) : 0;
      
      // Restore badge on app load
      if (this.currentBadgeCount > 0) {
        this.setBadgeCount(this.currentBadgeCount);
      }
    } catch (error) {
      console.error('Failed to load badge count:', error);
      this.currentBadgeCount = 0;
    }
  }

  // FCM Token Management
  private saveFCMToken(token: string): void {
    try {
      localStorage.setItem(this.FCM_TOKEN_KEY, token);
      console.log('🔑 FCM token saved to localStorage');
    } catch (error) {
      console.error('Failed to save FCM token:', error);
    }
  }

  private loadFCMToken(): void {
    try {
      const stored = localStorage.getItem(this.FCM_TOKEN_KEY);
      if (stored && this.fcmSubscription) {
        // Validate stored token matches current subscription
        if (this.fcmSubscription.token !== stored) {
          console.log('🔄 FCM token mismatch - clearing stored token');
          localStorage.removeItem(this.FCM_TOKEN_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load FCM token:', error);
    }
  }

  private clearFCMToken(): void {
    try {
      localStorage.removeItem(this.FCM_TOKEN_KEY);
      console.log('🗑️ FCM token cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear FCM token:', error);
    }
  }

  // iOS PWA Detection and User Guidance
  
  isIOSPWA(): boolean {
    // Check if running as PWA on iOS
    return (
      window.navigator.standalone === true || // iOS Safari PWA
      window.matchMedia('(display-mode: standalone)').matches
    );
  }

  isIOSDevice(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  isIOSWebPushSupported(): boolean {
    // iOS 16.4+ supports web push in PWAs
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!ios) return true; // Assume supported on other platforms
    
    // Try to detect iOS version (basic detection)
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (match) {
      const majorVersion = parseInt(match[1], 10);
      const minorVersion = parseInt(match[2], 10);
      return majorVersion > 16 || (majorVersion === 16 && minorVersion >= 4);
    }
    
    return false; // Conservative fallback
  }

  getIOSPWAInstructions(): {
    isSupported: boolean;
    isPWA: boolean;
    instructions: string[];
    limitations: string[];
  } {
    const isSupported = this.isIOSWebPushSupported();
    const isPWA = this.isIOSPWA();
    const isIOS = this.isIOSDevice();
    
    return {
      isSupported: isSupported && isIOS,
      isPWA,
      instructions: isIOS ? [
        'Open MedTrack in Safari',
        'Tap the Share button (square with arrow)',
        'Select "Add to Home Screen"',
        'Tap "Add" to install the app',
        'Launch MedTrack from your home screen',
        'Enable notifications when prompted',
        'Keep the app installed for best notification reliability'
      ] : [
        'Install MedTrack using your browser\'s install prompt',
        'Enable notifications when prompted'
      ],
      limitations: isIOS ? [
        'For reliable notifications, install app to home screen',
        'Launch from home screen icon, not Safari browser',
        'iOS 16.4+ recommended for best experience',
        'Notifications work best when app stays installed'
      ] : []
    };
  }

  // Enhanced notification with badge management
  
  async sendImmediateNotificationWithBadge(payload: NotificationPayload, incrementBadge = true): Promise<void> {
    try {
      // Send the notification
      await this.sendImmediateNotification(payload);
      
      // Increment badge count
      if (incrementBadge) {
        await this.incrementBadgeCount();
      }
      
      console.log(`Notification sent. Badge count: ${this.currentBadgeCount}`);
    } catch (error) {
      console.error('Failed to send notification with badge:', error);
      throw error;
    }
  }


  // Clean up method
  destroy(): void {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    
    window.removeEventListener('focus', this.checkMissedNotifications);
    window.removeEventListener('blur', () => {});
    window.removeEventListener('beforeunload', () => {});
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
