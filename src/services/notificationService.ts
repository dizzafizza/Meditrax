/**
 * Notification Service - Capacitor Local Notifications
 * Handles local push notifications for medication reminders
 */

import {
  LocalNotifications,
  LocalNotificationSchema,
  ActionPerformed,
  PendingResult,
  ScheduleOptions,
} from '@capacitor/local-notifications';
import { 
  Reminder, 
  Medication, 
  MedicationLog,
  EffectProfile,
  EffectStatus 
} from '@/types';
import { MEDICATION_DATABASE } from './medicationDatabase';
import { supportsLocalNotifications, isNative } from '@/utils/platform';
import { hapticsSuccess, hapticsWarning, hapticsError } from '@/utils/haptics';

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

interface NotificationAction {
  action: string;
  title: string;
}

class NotificationService {
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
  private readonly NOTIFICATION_STORAGE_KEY = 'meditrax_scheduled_notifications';
  private readonly NOTIFICATION_QUEUE_KEY = 'meditrax_notification_queue';
  private readonly BADGE_COUNT_KEY = 'meditrax_badge_count';
  private currentBadgeCount = 0;
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize notification service
   */
  private async initializeService(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Register action types for notification actions
      if (isNative() && supportsLocalNotifications()) {
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'medication-reminder',
              actions: [
                {
                  id: 'take',
                  title: 'Mark as Taken',
                },
                {
                  id: 'snooze',
                  title: 'Snooze 15min',
                },
                {
                  id: 'skip',
                  title: 'Skip',
                },
              ],
            },
            {
              id: 'dependency-alert',
              actions: [
                {
                  id: 'acknowledge',
                  title: 'Acknowledge',
                },
                {
                  id: 'view-tapering',
                  title: 'View Tapering Plan',
                },
              ],
            },
            {
              id: 'psychological-alert',
              actions: [
                {
                  id: 'acknowledge',
                  title: 'Acknowledge',
                },
                {
                  id: 'dismiss',
                  title: 'Dismiss',
                },
              ],
            },
            {
              id: 'inventory-alert',
              actions: [
                {
                  id: 'refill',
                  title: 'Request Refill',
                },
                {
                  id: 'update-inventory',
                  title: 'Update Inventory',
                },
              ],
            },
            {
              id: 'effect-tracking',
              actions: [
                {
                  id: 'feeling-it',
                  title: 'Feeling It',
                },
                {
                  id: 'not-yet',
                  title: 'Not Yet',
                },
              ],
            },
            {
              id: 'adherence-alert',
              actions: [
                {
                  id: 'take-now',
                  title: 'Take Now',
                },
                {
                  id: 'already-taken',
                  title: 'Already Taken',
                },
              ],
            },
          ],
        });

        // Listen for notification actions
        await LocalNotifications.addListener('localNotificationActionPerformed', this.handleNotificationAction.bind(this));

        // Listen for notification received
        await LocalNotifications.addListener('localNotificationReceived', this.handleNotificationReceived.bind(this));
      }

      this.loadScheduledNotifications();
      this.loadBadgeCount();
      this.checkMissedNotifications();

      this.isInitialized = true;
      console.log('✅ Notification service initialized (Capacitor Local Notifications)');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  /**
   * Get motivational message for a medication
   */
  private getMotivationalMessage(medicationName: string): string {
    const defaultMessages = [
      "You're taking great care of your health! 🌟",
      "Every dose is a step toward better wellness! 💪",
      "Staying consistent with your medication matters! 🎯",
      "Great job prioritizing your health today! ✨",
      "You're doing amazing managing your medications! 🏆",
    ];

    try {
      const medicationData = MEDICATION_DATABASE.find(
        (med) =>
          med.name.toLowerCase().includes(medicationName.toLowerCase()) ||
          med.genericName?.toLowerCase().includes(medicationName.toLowerCase()) ||
          med.brandNames?.some((brand) => brand.toLowerCase().includes(medicationName.toLowerCase()))
      );

      if (medicationData?.psychologicalSupport?.motivationalMessages?.length) {
        const messages = medicationData.psychologicalSupport.motivationalMessages;
        return messages[Math.floor(Math.random() * messages.length)];
      }
    } catch (error) {
      console.warn('Error getting medication-specific motivational message:', error);
    }

    return defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
  }

  /**
   * Check notification permission state
   */
  async getPermissionState(): Promise<NotificationPermissionState> {
    // For native apps, use Capacitor Local Notifications
    if (isNative() && supportsLocalNotifications()) {
      try {
        const result = await LocalNotifications.checkPermissions();
        return {
          status: result.display as 'default' | 'granted' | 'denied',
          supported: true,
        };
      } catch (error) {
        console.error('Failed to check notification permissions:', error);
        return { status: 'denied', supported: false };
      }
    }

    // For web/PWA, use standard Web Notification API
    if ('Notification' in window) {
      return {
        status: Notification.permission as 'default' | 'granted' | 'denied',
        supported: true,
      };
    }

    return { status: 'denied', supported: false };
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    // For native apps, use Capacitor Local Notifications
    if (isNative() && supportsLocalNotifications()) {
      try {
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';

        if (granted) {
          console.log('✅ Notification permission granted (native)');
        } else {
          console.warn('⚠️ Notification permission denied (native)');
        }

        return granted;
      } catch (error) {
        console.error('Failed to request notification permission:', error);
        return false;
      }
    }

    // For web/PWA, use Web Notification API
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        const granted = permission === 'granted';

        if (granted) {
          console.log('✅ Notification permission granted (web)');
        } else {
          console.warn('⚠️ Notification permission denied (web)');
        }

        return granted;
      } catch (error) {
        console.error('Failed to request web notification permission:', error);
        return false;
      }
    }

    console.warn('Notifications not supported on this platform');
    return false;
  }

  /**
   * Schedule a reminder notification
   */
  async scheduleReminder(reminder: Reminder, medication: Medication): Promise<void> {
    if (!reminder.enabled) {
      console.log('Reminder is disabled, skipping schedule');
      return;
    }

    const permissionState = await this.getPermissionState();
    if (permissionState.status !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    // For web/PWA, store reminders and use service worker or show warnings
    if (!isNative()) {
      console.warn('⚠️ Scheduled notifications on web require service worker or user must be active at reminder time');
      console.log('💡 Web platform: Reminders will show when app is open at scheduled time');
      // Store the reminder for in-app checking
      return;
    }

    try {
      const notifications: LocalNotificationSchema[] = [];
      const now = new Date();

      // Parse reminder time
      const [hours, minutes] = reminder.time.split(':').map(Number);

      // Generate notifications based on frequency
      if (reminder.frequency === 'daily') {
        // Schedule daily notifications for the next 30 days
        for (let i = 0; i < 30; i++) {
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + i);
          scheduledDate.setHours(hours, minutes, 0, 0);

          if (scheduledDate > now) {
            const notificationId = this.generateNotificationId(reminder.id, i);
            const motivationalMessage = this.getMotivationalMessage(medication.name);

            notifications.push({
              id: notificationId,
              title: `Time to take ${medication.name}`,
              body: `${medication.dosage} ${medication.unit || 'dose'}\n${motivationalMessage}`,
              schedule: { at: scheduledDate },
              actionTypeId: 'medication-reminder',
              extra: {
                reminderId: reminder.id,
                medicationId: medication.id,
                medicationName: medication.name,
                dosage: medication.dosage,
              },
              sound: 'default',
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: '#3b82f6',
            });

            // Store scheduled notification
            const scheduledNotification: ScheduledNotification = {
              id: String(notificationId),
              reminderId: reminder.id,
              medicationId: medication.id,
              scheduledTime: scheduledDate,
              payload: {
                title: `Time to take ${medication.name}`,
                body: `${medication.dosage} ${medication.unit || 'dose'}`,
              },
              status: 'scheduled',
            };

            this.scheduledNotifications.set(String(notificationId), scheduledNotification);
          }
        }
      } else if (reminder.frequency === 'weekly' && reminder.daysOfWeek) {
        // Schedule weekly notifications for the next 12 weeks
        for (let week = 0; week < 12; week++) {
          for (const dayOfWeek of reminder.daysOfWeek) {
            const scheduledDate = new Date();
            const daysUntilTarget = (dayOfWeek - scheduledDate.getDay() + 7) % 7;
            scheduledDate.setDate(scheduledDate.getDate() + daysUntilTarget + week * 7);
            scheduledDate.setHours(hours, minutes, 0, 0);

            if (scheduledDate > now) {
              const notificationId = this.generateNotificationId(reminder.id, week * 7 + dayOfWeek);
              const motivationalMessage = this.getMotivationalMessage(medication.name);

              notifications.push({
                id: notificationId,
                title: `Time to take ${medication.name}`,
                body: `${medication.dosage} ${medication.unit || 'dose'}\n${motivationalMessage}`,
                schedule: { at: scheduledDate },
                actionTypeId: 'medication-reminder',
                extra: {
                  reminderId: reminder.id,
                  medicationId: medication.id,
                  medicationName: medication.name,
                  dosage: medication.dosage,
                },
                sound: 'default',
                smallIcon: 'ic_stat_icon_config_sample',
                iconColor: '#3b82f6',
              });

              const scheduledNotification: ScheduledNotification = {
                id: String(notificationId),
                reminderId: reminder.id,
                medicationId: medication.id,
                scheduledTime: scheduledDate,
                payload: {
                  title: `Time to take ${medication.name}`,
                  body: `${medication.dosage} ${medication.unit || 'dose'}`,
                },
                status: 'scheduled',
              };

              this.scheduledNotifications.set(String(notificationId), scheduledNotification);
            }
          }
        }
      }

      // Schedule all notifications
      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        this.saveScheduledNotifications();
        console.log(`✅ Scheduled ${notifications.length} notifications for ${medication.name}`);
      }
    } catch (error) {
      console.error('Failed to schedule reminder:', error);
      throw error;
    }
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(reminderId: string): Promise<void> {
    try {
      // Find all notifications for this reminder
      const notificationIds: number[] = [];

      for (const [id, notification] of this.scheduledNotifications.entries()) {
        if (notification.reminderId === reminderId) {
          notificationIds.push(parseInt(id));
          this.scheduledNotifications.delete(id);
        }
      }

      if (notificationIds.length > 0) {
        await LocalNotifications.cancel({ notifications: notificationIds.map((id) => ({ id })) });
        this.saveScheduledNotifications();
        console.log(`✅ Cancelled ${notificationIds.length} notifications for reminder ${reminderId}`);
      }
    } catch (error) {
      console.error('Failed to cancel reminder:', error);
    }
  }

  /**
   * Cancel all notifications for a medication
   */
  async cancelMedicationNotifications(medicationId: string): Promise<void> {
    try {
      const notificationIds: number[] = [];

      for (const [id, notification] of this.scheduledNotifications.entries()) {
        if (notification.medicationId === medicationId) {
          notificationIds.push(parseInt(id));
          this.scheduledNotifications.delete(id);
        }
      }

      if (notificationIds.length > 0) {
        await LocalNotifications.cancel({ notifications: notificationIds.map((id) => ({ id })) });
        this.saveScheduledNotifications();
        console.log(`✅ Cancelled ${notificationIds.length} notifications for medication ${medicationId}`);
      }
    } catch (error) {
      console.error('Failed to cancel medication notifications:', error);
    }
  }

  /**
   * Send an immediate notification
   */
  async sendImmediateNotification(payload: NotificationPayload): Promise<void> {
    const permissionState = await this.getPermissionState();
    if (permissionState.status !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      // For native apps, use Capacitor Local Notifications
      if (isNative() && supportsLocalNotifications()) {
        const notificationId = Date.now();

        await LocalNotifications.schedule({
          notifications: [
            {
              id: notificationId,
              title: payload.title,
              body: payload.body,
              schedule: { at: new Date(Date.now() + 1000) }, // Schedule 1 second in the future
              actionTypeId: payload.actions ? 'medication-reminder' : undefined,
              extra: payload.data,
              sound: 'default',
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: '#3b82f6',
            },
          ],
        });

        console.log('✅ Immediate notification scheduled (native)');
      } else {
        // For web/PWA, use Web Notification API
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/icons/icon-192x192.png',
            badge: payload.badge || '/icons/icon-192x192.png',
            tag: payload.tag,
            data: payload.data,
            requireInteraction: payload.requireInteraction !== false,
          });

          console.log('✅ Immediate notification sent (web)');
        } else {
          console.warn('Web notifications not available');
        }
      }
    } catch (error) {
      console.error('Failed to send immediate notification:', error);
      throw error;
    }
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications(): Promise<PendingResult> {
    // Only works on native apps
    if (!isNative() || !supportsLocalNotifications()) {
      return { notifications: [] };
    }

    try {
      return await LocalNotifications.getPending();
    } catch (error) {
      console.error('Failed to get pending notifications:', error);
      return { notifications: [] };
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      // For native apps
      if (isNative() && supportsLocalNotifications()) {
        const pending = await this.getPendingNotifications();
        const notificationIds = pending.notifications.map((n) => ({ id: n.id }));

        if (notificationIds.length > 0) {
          await LocalNotifications.cancel({ notifications: notificationIds });
        }
      }

      // Clear local storage
      this.scheduledNotifications.clear();
      this.saveScheduledNotifications();
      console.log('✅ Cleared all notifications');
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  }

  /**
   * Handle notification action performed
   */
  private async handleNotificationAction(action: ActionPerformed): Promise<void> {
    console.log('Notification action performed:', action);

    const extra = action.notification.extra || {};
    const { reminderId, medicationId, medicationName, alertType, logId, effectStage, alertId } = extra;

    try {
      switch (action.actionId) {
        // Medication reminder actions
        case 'take':
          await hapticsSuccess();
          window.dispatchEvent(
            new CustomEvent('medicationTaken', {
              detail: { medicationId, reminderId },
            })
          );
          console.log(`✅ Medication marked as taken: ${medicationName}`);
          break;

        case 'snooze':
          await hapticsWarning();
          await this.snoozeNotification(action.notification.id, 15);
          console.log(`⏰ Notification snoozed: ${medicationName}`);
          break;

        case 'skip':
          console.log(`⏸️ Medication skipped: ${medicationName}`);
          break;

        // Dependency alert actions
        case 'acknowledge':
          await hapticsSuccess();
          window.dispatchEvent(
            new CustomEvent('alertAcknowledged', {
              detail: { alertId, alertType, medicationId },
            })
          );
          console.log(`✅ Alert acknowledged`);
          break;

        case 'view-tapering':
          window.dispatchEvent(
            new CustomEvent('viewTaperingPlan', {
              detail: { medicationId },
            })
          );
          console.log(`📋 View tapering plan requested`);
          break;

        // Psychological alert actions
        case 'dismiss':
          window.dispatchEvent(
            new CustomEvent('alertDismissed', {
              detail: { alertId, alertType, medicationId },
            })
          );
          console.log(`❌ Alert dismissed`);
          break;

        // Inventory alert actions
        case 'refill':
          window.dispatchEvent(
            new CustomEvent('requestRefill', {
              detail: { medicationId },
            })
          );
          console.log(`📦 Refill requested`);
          break;

        case 'update-inventory':
          window.dispatchEvent(
            new CustomEvent('updateInventory', {
              detail: { medicationId },
            })
          );
          console.log(`📝 Update inventory requested`);
          break;

        // Effect tracking actions
        case 'feeling-it':
          await hapticsSuccess();
          window.dispatchEvent(
            new CustomEvent('effectFeedback', {
              detail: { logId, medicationId, effectStage, status: effectStage === 'onset' ? 'kicking_in' : 'peaking' },
            })
          );
          console.log(`✅ Effect feedback: feeling it`);
          break;

        case 'not-yet':
          window.dispatchEvent(
            new CustomEvent('effectFeedback', {
              detail: { logId, medicationId, effectStage, status: 'pre_onset' },
            })
          );
          console.log(`⏳ Effect feedback: not yet`);
          break;

        // Adherence alert actions
        case 'take-now':
          await hapticsSuccess();
          window.dispatchEvent(
            new CustomEvent('takeMedicationNow', {
              detail: { medicationId },
            })
          );
          console.log(`✅ Take medication now`);
          break;

        case 'already-taken':
          window.dispatchEvent(
            new CustomEvent('medicationAlreadyTaken', {
              detail: { medicationId },
            })
          );
          console.log(`✅ Medication already taken`);
          break;

        case 'tap':
          // Notification tapped (default action)
          console.log(`📱 Notification tapped`);
          break;
      }
    } catch (error) {
      console.error('Failed to handle notification action:', error);
    }
  }

  /**
   * Handle notification received
   */
  private handleNotificationReceived(notification: any): void {
    console.log('Notification received:', notification);
    this.incrementBadgeCount();
  }

  /**
   * Snooze a notification
   */
  private async snoozeNotification(notificationId: number, minutes: number): Promise<void> {
    try {
      const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId + 1000000, // Use a different ID for snoozed notification
            title: 'Reminder: Time to take your medication',
            body: 'Snoozed reminder',
            schedule: { at: snoozeTime },
            actionTypeId: 'medication-reminder',
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#3b82f6',
          },
        ],
      });

      console.log(`✅ Notification snoozed for ${minutes} minutes`);
    } catch (error) {
      console.error('Failed to snooze notification:', error);
    }
  }

  /**
   * Badge count management
   */
  private incrementBadgeCount(): void {
    this.currentBadgeCount++;
    this.saveBadgeCount();
  }

  private resetBadgeCount(): void {
    this.currentBadgeCount = 0;
    this.saveBadgeCount();
  }

  private saveBadgeCount(): void {
    try {
      localStorage.setItem(this.BADGE_COUNT_KEY, String(this.currentBadgeCount));
    } catch (error) {
      console.error('Failed to save badge count:', error);
    }
  }

  private loadBadgeCount(): void {
    try {
      const count = localStorage.getItem(this.BADGE_COUNT_KEY);
      this.currentBadgeCount = count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Failed to load badge count:', error);
    }
  }

  /**
   * Scheduled notifications storage
   */
  private saveScheduledNotifications(): void {
    try {
      const notifications = Array.from(this.scheduledNotifications.entries());
      localStorage.setItem(this.NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save scheduled notifications:', error);
    }
  }

  private loadScheduledNotifications(): void {
    try {
      const stored = localStorage.getItem(this.NOTIFICATION_STORAGE_KEY);
      if (stored) {
        const notifications = JSON.parse(stored);
        this.scheduledNotifications = new Map(notifications);
      }
    } catch (error) {
      console.error('Failed to load scheduled notifications:', error);
    }
  }

  /**
   * Check for missed notifications
   */
  private checkMissedNotifications(): void {
    const now = new Date();

    for (const [id, notification] of this.scheduledNotifications.entries()) {
      if (notification.scheduledTime < now && notification.status === 'scheduled') {
        notification.status = 'sent';
      }
    }

    this.saveScheduledNotifications();
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(reminderId: string, index: number): number {
    // Generate a unique integer ID from reminder ID and index
    const hash = reminderId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);

    return (hash % 100000) * 1000 + index;
  }

  /**
   * Get scheduled notifications for a medication
   */
  getScheduledNotificationsForMedication(medicationId: string): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values()).filter(
      (notification) => notification.medicationId === medicationId
    );
  }

  /**
   * Get all scheduled notifications
   */
  getAllScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values());
  }

  // ============================================================
  // ALERT NOTIFICATIONS
  // ============================================================

  /**
   * Schedule a dependency alert notification
   */
  async scheduleDependencyAlert(alert: any, medication: Medication): Promise<void> {
    const permissionState = await this.getPermissionState();
    if (permissionState.status !== 'granted') return;

    try {
      const notificationId = this.generateAlertNotificationId('dependency', alert.id);
      const iconColor = alert.priority === 'critical' ? '#ef4444' : alert.priority === 'high' ? '#f59e0b' : '#3b82f6';

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: `⚠️ Dependency Alert: ${medication.name}`,
            body: alert.message,
            schedule: { at: new Date(Date.now() + 2000) },
            actionTypeId: 'dependency-alert',
            extra: {
              alertId: alert.id,
              medicationId: medication.id,
              alertType: 'dependency',
              priority: alert.priority,
            },
            sound: alert.priority === 'critical' ? 'default' : undefined,
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor,
          },
        ],
      });

      console.log(`✅ Scheduled dependency alert notification for ${medication.name}`);
    } catch (error) {
      console.error('Failed to schedule dependency alert:', error);
    }
  }

  /**
   * Schedule a psychological safety alert notification
   */
  async schedulePsychologicalAlert(alert: any, medication: Medication): Promise<void> {
    const permissionState = await this.getPermissionState();
    if (permissionState.status !== 'granted') return;

    // Only notify for medium+ priority
    if (alert.priority === 'low') return;

    try {
      const notificationId = this.generateAlertNotificationId('psychological', alert.id);
      const iconColor = alert.priority === 'urgent' ? '#ef4444' : alert.priority === 'high' ? '#f59e0b' : '#3b82f6';

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: `🧠 ${alert.title}`,
            body: alert.message,
            schedule: { at: new Date(Date.now() + 2000) },
            actionTypeId: 'psychological-alert',
            extra: {
              alertId: alert.id,
              medicationId: medication.id,
              alertType: 'psychological',
              priority: alert.priority,
            },
            sound: alert.priority === 'urgent' ? 'default' : undefined,
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor,
          },
        ],
      });

      console.log(`✅ Scheduled psychological alert notification for ${medication.name}`);
    } catch (error) {
      console.error('Failed to schedule psychological alert:', error);
    }
  }

  /**
   * Schedule an inventory/refill alert notification
   */
  async scheduleInventoryAlert(alert: any, medication: Medication): Promise<void> {
    const permissionState = await this.getPermissionState();
    if (permissionState.status !== 'granted') return;

    try {
      const notificationId = this.generateAlertNotificationId('inventory', alert.id);
      const iconColor = alert.priority === 'urgent' ? '#ef4444' : alert.priority === 'important' ? '#f59e0b' : '#3b82f6';
      
      const titlePrefix = alert.priority === 'urgent' ? '🚨' : alert.priority === 'important' ? '⚠️' : '📦';

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: `${titlePrefix} ${alert.type === 'almost_out' ? 'Almost Out' : alert.type === 'running_low' ? 'Running Low' : 'Refill Reminder'}: ${medication.name}`,
            body: `${alert.message}\n${alert.suggestion || ''}`,
            schedule: { at: new Date(Date.now() + 2000) },
            actionTypeId: 'inventory-alert',
            extra: {
              alertId: alert.id,
              medicationId: medication.id,
              alertType: 'inventory',
              priority: alert.priority,
              daysRemaining: alert.daysRemaining,
            },
            sound: alert.priority === 'urgent' ? 'default' : undefined,
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor,
          },
        ],
      });

      console.log(`✅ Scheduled inventory alert notification for ${medication.name}`);
    } catch (error) {
      console.error('Failed to schedule inventory alert:', error);
    }
  }

  /**
   * Schedule effect tracking notifications
   */
  async scheduleEffectNotifications(
    log: MedicationLog,
    medication: Medication,
    profile: EffectProfile
  ): Promise<void> {
    const permissionState = await this.getPermissionState();
    if (permissionState.status !== 'granted') return;

    try {
      const logTime = new Date(log.timestamp);
      const notifications: LocalNotificationSchema[] = [];

      // Onset notification
      const onsetTime = new Date(logTime.getTime() + profile.onsetMinutes * 60 * 1000);
      if (onsetTime > new Date()) {
        notifications.push({
          id: this.generateEffectNotificationId(log.id, 'onset'),
          title: `⏱️ Effect Onset: ${medication.name}`,
          body: `Your ${medication.name} should be kicking in soon. Tap to log how you're feeling.`,
          schedule: { at: onsetTime },
          actionTypeId: 'effect-tracking',
          extra: {
            logId: log.id,
            medicationId: medication.id,
            effectStage: 'onset',
            medicationName: medication.name,
          },
          sound: undefined,
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#3b82f6',
        });
      }

      // Peak notification
      const peakTime = new Date(logTime.getTime() + profile.peakMinutes * 60 * 1000);
      if (peakTime > new Date()) {
        notifications.push({
          id: this.generateEffectNotificationId(log.id, 'peak'),
          title: `🎯 Peak Effect: ${medication.name}`,
          body: `Your ${medication.name} should be at peak effectiveness. How are you feeling?`,
          schedule: { at: peakTime },
          actionTypeId: 'effect-tracking',
          extra: {
            logId: log.id,
            medicationId: medication.id,
            effectStage: 'peak',
            medicationName: medication.name,
          },
          sound: undefined,
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#10b981',
        });
      }

      // Wear-off notification
      const wearOffTime = new Date(logTime.getTime() + profile.wearOffStartMinutes * 60 * 1000);
      if (wearOffTime > new Date()) {
        notifications.push({
          id: this.generateEffectNotificationId(log.id, 'wearoff'),
          title: `📉 Wearing Off: ${medication.name}`,
          body: `Effects of ${medication.name} may be wearing off. Tap to confirm.`,
          schedule: { at: wearOffTime },
          actionTypeId: 'effect-tracking',
          extra: {
            logId: log.id,
            medicationId: medication.id,
            effectStage: 'wearoff',
            medicationName: medication.name,
          },
          sound: undefined,
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#f59e0b',
        });
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`✅ Scheduled ${notifications.length} effect tracking notifications for ${medication.name}`);
      }
    } catch (error) {
      console.error('Failed to schedule effect notifications:', error);
    }
  }

  /**
   * Cancel effect tracking notifications for a log
   */
  async cancelEffectNotifications(logId: string): Promise<void> {
    try {
      const notificationIds = [
        this.generateEffectNotificationId(logId, 'onset'),
        this.generateEffectNotificationId(logId, 'peak'),
        this.generateEffectNotificationId(logId, 'wearoff'),
      ];

      await LocalNotifications.cancel({
        notifications: notificationIds.map((id) => ({ id })),
      });

      console.log(`✅ Cancelled effect tracking notifications for log ${logId}`);
    } catch (error) {
      console.error('Failed to cancel effect notifications:', error);
    }
  }

  /**
   * Schedule an adherence alert notification
   */
  async scheduleAdherenceAlert(notification: any, medication: Medication): Promise<void> {
    const permissionState = await this.getPermissionState();
    if (permissionState.status !== 'granted') return;

    try {
      const notificationId = this.generateAlertNotificationId('adherence', notification.id);
      const scheduledTime = notification.scheduledTime || new Date(Date.now() + 2000);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: notification.title,
            body: notification.message,
            schedule: { at: scheduledTime },
            actionTypeId: 'adherence-alert',
            extra: {
              notificationId: notification.id,
              medicationId: medication.id,
              alertType: 'adherence',
              priority: notification.priority,
            },
            sound: notification.priority === 'high' ? 'default' : undefined,
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#3b82f6',
          },
        ],
      });

      console.log(`✅ Scheduled adherence alert notification for ${medication.name}`);
    } catch (error) {
      console.error('Failed to schedule adherence alert:', error);
    }
  }

  /**
   * Schedule a streak celebration notification
   */
  async scheduleStreakCelebration(streak: number, medicationName?: string): Promise<void> {
    const permissionState = await this.getPermissionState();
    if (permissionState.status !== 'granted') return;

    try {
      const notificationId = Date.now();
      const title = medicationName 
        ? `🎉 ${streak}-Day Streak: ${medicationName}!`
        : `🎉 ${streak}-Day Overall Streak!`;
      
      const messages = [
        `Amazing! You've maintained your ${streak}-day streak!`,
        `Fantastic work! ${streak} days of perfect adherence!`,
        `You're crushing it! ${streak} consecutive days!`,
        `Incredible dedication! ${streak} days strong!`,
      ];

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title,
            body: messages[Math.floor(Math.random() * messages.length)],
            schedule: { at: new Date(Date.now() + 1000) },
            extra: {
              alertType: 'achievement',
              streak,
              medicationName,
            },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#10b981',
          },
        ],
      });

      console.log(`✅ Scheduled streak celebration notification`);
    } catch (error) {
      console.error('Failed to schedule streak celebration:', error);
    }
  }

  /**
   * Schedule multiple alert notifications
   */
  async scheduleMultipleAlerts(alerts: any[], type: string, medication?: Medication): Promise<void> {
    for (const alert of alerts) {
      if (type === 'dependency' && medication) {
        await this.scheduleDependencyAlert(alert, medication);
      } else if (type === 'psychological' && medication) {
        await this.schedulePsychologicalAlert(alert, medication);
      } else if (type === 'inventory' && medication) {
        await this.scheduleInventoryAlert(alert, medication);
      }
    }
  }

  /**
   * Check if currently in quiet hours
   */
  private isQuietHours(quietHoursConfig?: { enabled: boolean; startTime: string; endTime: string }): boolean {
    if (!quietHoursConfig?.enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = quietHoursConfig.startTime.split(':').map(Number);
    const [endHour, endMinute] = quietHoursConfig.endTime.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Quiet hours cross midnight
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  /**
   * Check if alert should be sent based on preferences
   */
  shouldSendAlert(
    alertType: 'dependency' | 'psychological' | 'inventory' | 'effect' | 'adherence' | 'achievement',
    priority: 'low' | 'medium' | 'high' | 'critical',
    preferences?: any
  ): boolean {
    if (!preferences) return true;

    // Check if alert type is enabled
    const typeEnabled = {
      dependency: preferences.enableDependencyAlerts !== false,
      psychological: preferences.enablePsychologicalAlerts !== false,
      inventory: preferences.enableInventoryAlerts !== false,
      effect: preferences.enableEffectTracking !== false,
      adherence: preferences.enableAdherenceAlerts !== false,
      achievement: preferences.enableAchievements !== false,
    };

    if (!typeEnabled[alertType]) return false;

    // Critical alerts always send, even during quiet hours
    if (priority === 'critical') return true;

    // Check quiet hours for non-critical alerts
    if (this.isQuietHours(preferences.quietHours)) {
      return false;
    }

    // Check minimum priority threshold
    const priorityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const minLevel = priorityLevels[preferences.minimumPriority || 'low'];
    const alertLevel = priorityLevels[priority];

    return alertLevel >= minLevel;
  }

  /**
   * Generate alert notification ID
   */
  private generateAlertNotificationId(type: string, alertId: string): number {
    const typeHash = type.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const idHash = alertId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (typeHash % 1000) * 1000000 + (idHash % 1000000);
  }

  /**
   * Generate effect notification ID
   */
  private generateEffectNotificationId(logId: string, stage: string): number {
    const stageMap: Record<string, number> = { onset: 1, peak: 2, wearoff: 3 };
    const stageNum = stageMap[stage] || 0;
    const hash = logId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 1000000) * 10 + stageNum;
  }
}

export const notificationService = new NotificationService();
export default notificationService;


