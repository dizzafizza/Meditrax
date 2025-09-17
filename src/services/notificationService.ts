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
  private readonly NOTIFICATION_STORAGE_KEY = 'medtrack_scheduled_notifications';
  private pushNotificationsAvailable = false;

  constructor() {
    this.initializeService();
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
      
      if (!this.isPushNotificationAvailable()) {
        console.info(`Push notifications not available for reminder ${reminder.id}. Using fallback browser notifications.`);
      }
      
      const nextNotificationTime = this.calculateNextNotificationTime(reminder, now);
      
      if (!nextNotificationTime) {
        return;
      }

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
        throw new Error('Notification permission not granted');
      }

      if (this.serviceWorkerRegistration) {
        await this.serviceWorkerRegistration.showNotification(payload.title, {
          body: payload.body,
          icon: payload.icon,
          badge: payload.badge,
          data: payload.data,
          tag: payload.tag,
          requireInteraction: payload.requireInteraction,
          actions: payload.actions
        });
      } else {
        new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon,
          tag: payload.tag,
          data: payload.data
        });
      }
    } catch (error) {
      console.error('Failed to send immediate notification:', error);
      throw error;
    }
  }

  private calculateNextNotificationTime(reminder: Reminder, fromDate: Date): Date | null {
    const [hours, minutes] = reminder.time.split(':').map(Number);
    const now = new Date(fromDate);
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + dayOffset);
      checkDate.setHours(hours, minutes, 0, 0);
      
      if (dayOffset === 0 && checkDate <= now) {
        continue;
      }
      
      const dayName = checkDate.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
      
      if (reminder.days.includes(dayName)) {
        return checkDate;
      }
    }
    
    return null;
  }

  private async scheduleNotification(scheduledNotification: ScheduledNotification): Promise<void> {
    const now = new Date().getTime();
    const scheduledTime = scheduledNotification.scheduledTime.getTime();
    const delay = scheduledTime - now;

    if (delay <= 0) {
      await this.sendImmediateNotification(scheduledNotification.payload);
      scheduledNotification.status = 'sent';
      return;
    }

    setTimeout(async () => {
      try {
        await this.sendImmediateNotification(scheduledNotification.payload);
        scheduledNotification.status = 'sent';
        this.scheduledNotifications.delete(scheduledNotification.id);
        this.saveScheduledNotifications();
      } catch (error) {
        console.error('Failed to send scheduled notification:', error);
        scheduledNotification.status = 'failed';
        scheduledNotification.retryCount = (scheduledNotification.retryCount || 0) + 1;
      }
    }, delay);
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
      title: 'MedTrack Test Notification',
      body: 'This is a test notification to verify everything is working correctly.',
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      requireInteraction: true,
      data: { test: true }
    };

    await this.sendImmediateNotification(payload);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
