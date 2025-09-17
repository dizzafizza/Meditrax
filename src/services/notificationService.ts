/**
 * Notification Service - Handles push notifications for medication reminders
 */

import { Reminder, Medication } from '@/types';

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
  
  private readonly VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || null;
  private readonly NOTIFICATION_STORAGE_KEY = 'meditrax_scheduled_notifications';
  private readonly NOTIFICATION_QUEUE_KEY = 'meditrax_notification_queue';
  private pushNotificationsAvailable = false;
  private visibilityChangeHandler: (() => void) | null = null;
  private isAppVisible = !document.hidden;
  private lastVisibilityCheck = Date.now();

  constructor() {
    this.initializeService();
    this.setupVisibilityHandling();
    this.setupBeforeUnloadHandler();
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
      this.checkMissedNotifications();

      if (this.VAPID_PUBLIC_KEY && this.isValidVapidKey(this.VAPID_PUBLIC_KEY)) {
        this.subscribeToPushNotifications().catch(error => {
          console.info('Push notifications not initialized during startup:', error.message);
        });
      } else {
        console.info('Push notifications disabled: VAPID key not configured. Set VITE_VAPID_PUBLIC_KEY environment variable to enable.');
      }

    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
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
      default:
        console.log('Unknown service worker message:', type, data);
    }
  }

  async getPermissionState(): Promise<NotificationPermissionState> {
    if (!('Notification' in window)) {
      return { status: 'denied', supported: false };
    }

    const status = Notification.permission as 'default' | 'granted' | 'denied';
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
      
      if (!this.isPushNotificationAvailable()) {
        console.info(`Push notifications not available for reminder ${reminder.id}. Using fallback browser notifications.`);
      }
      
      const nextNotificationTime = this.calculateNextNotificationTime(reminder, now);
      
      if (!nextNotificationTime) {
        console.warn(`Could not calculate next notification time for reminder ${reminder.id}`);
        return;
      }

      console.log(`Scheduling notification for ${nextNotificationTime.toLocaleString()} (in ${Math.round((nextNotificationTime.getTime() - now.getTime()) / 1000 / 60)} minutes)`);

      const payload: NotificationPayload = {
        title: `Time for ${medication.name}`,
        body: reminder.customMessage || `Take your ${medication.dosage}${medication.unit} dose of ${medication.name}`,
        icon: '/pill-icon.svg',
        badge: '/pill-icon.svg',
        data: {
          medicationId: medication.id,
          reminderId: reminder.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          unit: medication.unit,
          timestamp: nextNotificationTime.getTime()
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

      if (this.serviceWorkerRegistration) {
        console.log('Using service worker to show notification');
        await this.serviceWorkerRegistration.showNotification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/pill-icon.svg',
          badge: payload.badge || '/pill-icon.svg',
          data: payload.data,
          tag: payload.tag,
          requireInteraction: payload.requireInteraction !== false,
          actions: payload.actions,
          vibrate: [200, 100, 200],
          silent: false
        });
      } else {
        console.log('Using basic notification API');
        const notification = new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/pill-icon.svg',
          tag: payload.tag,
          data: payload.data,
          requireInteraction: payload.requireInteraction !== false
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

    console.log(`Scheduling notification with delay: ${Math.round(delay / 1000 / 60)} minutes`);

    if (delay <= 0) {
      console.log('Sending immediate notification (time already passed)');
      await this.sendImmediateNotification(scheduledNotification.payload);
      scheduledNotification.status = 'sent';
      return;
    }

    // ALWAYS store in queue for persistence (regardless of delay)
    this.addToNotificationQueue(scheduledNotification);
    console.log(`Added notification to queue. Queue size: ${this.getNotificationQueue().length}`);

    // For immediate notifications (within 30 minutes), also use setTimeout as primary method
    if (delay <= 30 * 60 * 1000) {
      console.log(`Setting setTimeout for ${Math.round(delay / 1000 / 60)} minutes`);
      setTimeout(async () => {
        try {
          console.log('setTimeout triggered, sending notification');
          await this.sendImmediateNotification(scheduledNotification.payload);
          scheduledNotification.status = 'sent';
          this.scheduledNotifications.delete(scheduledNotification.id);
          this.saveScheduledNotifications();
          // Also remove from queue
          this.removeFromNotificationQueue(scheduledNotification.id);
        } catch (error) {
          console.error('Failed to send scheduled notification via setTimeout:', error);
          scheduledNotification.status = 'failed';
          scheduledNotification.retryCount = (scheduledNotification.retryCount || 0) + 1;
        }
      }, delay);
    }

    // Try to register background sync for backup
    if (this.serviceWorkerRegistration && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await this.serviceWorkerRegistration.sync.register('check-notifications');
        console.log('Background sync registered successfully');
      } catch (error) {
        console.log('Background sync not available:', error);
      }
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
    return this.pushNotificationsAvailable && !!this.pushSubscription;
  }

  async getPushNotificationStatus(): Promise<{
    supported: boolean;
    configured: boolean;
    subscribed: boolean;
    permission: NotificationPermission;
  }> {
    const permissionState = await this.getPermissionState();
    
    return {
      supported: 'serviceWorker' in navigator && 'PushManager' in window,
      configured: !!this.VAPID_PUBLIC_KEY && this.isValidVapidKey(this.VAPID_PUBLIC_KEY),
      subscribed: this.isPushNotificationAvailable(),
      permission: permissionState.status
    };
  }

  getScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values());
  }

  async testNotification(): Promise<void> {
    const payload: NotificationPayload = {
      title: 'Meditrax Test Notification',
      body: 'This is a test notification to verify everything is working correctly.',
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      requireInteraction: true,
      data: { test: true }
    };

    await this.sendImmediateNotification(payload);
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
      
      this.isAppVisible = isVisible;
      this.lastVisibilityCheck = Date.now();
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    
    // Also check on page focus/blur
    window.addEventListener('focus', () => {
      if (!this.isAppVisible) {
        this.checkMissedNotifications();
        this.isAppVisible = true;
      }
    });
    
    window.addEventListener('blur', () => {
      this.isAppVisible = false;
      this.lastVisibilityCheck = Date.now();
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
      const missedNotifications: any[] = [];
      
      // Check queued notifications
      for (const notification of queue) {
        const scheduledTime = new Date(notification.scheduledTime).getTime();
        if (scheduledTime <= now && scheduledTime > (this.lastVisibilityCheck - 60000)) {
          missedNotifications.push(notification);
        }
      }

      // Check currently scheduled notifications
      for (const [id, notification] of this.scheduledNotifications.entries()) {
        const scheduledTime = notification.scheduledTime.getTime();
        if (scheduledTime <= now && notification.status === 'scheduled') {
          missedNotifications.push(notification);
        }
      }

      // Send missed notifications
      for (const notification of missedNotifications) {
        try {
          await this.sendImmediateNotification(notification.payload);
          notification.status = 'sent';
          
          // Remove from scheduled notifications
          if (this.scheduledNotifications.has(notification.id)) {
            this.scheduledNotifications.delete(notification.id);
          }
        } catch (error) {
          console.error('Failed to send missed notification:', error);
          notification.status = 'failed';
          notification.retryCount = (notification.retryCount || 0) + 1;
        }
      }

      // Clean up processed notifications from queue
      if (missedNotifications.length > 0) {
        const remainingQueue = queue.filter(n => 
          !missedNotifications.some(missed => missed.id === n.id)
        );
        localStorage.setItem(this.NOTIFICATION_QUEUE_KEY, JSON.stringify(remainingQueue));
        this.saveScheduledNotifications();
      }

      if (missedNotifications.length > 0) {
        console.log(`Processed ${missedNotifications.length} missed notifications`);
      }

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
  }> {
    const permissionState = await this.getPermissionState();
    
    return {
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
      pushSubscription: !!this.pushSubscription
    };
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
      title: 'DEBUG: Meditrax Test',
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
