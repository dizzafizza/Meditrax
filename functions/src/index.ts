/**
 * Firebase Cloud Functions for MedTrack
 * Backend-scheduled push notifications for iOS PWA reliability
 * 
 * Solves the iOS PWA limitation where service workers don't run when app is closed
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as webpush from 'web-push';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const FIELD_VALUE = admin.firestore.FieldValue;

// Configure Web Push (VAPID)
const WEB_PUSH_CONTACT = process.env.WEB_PUSH_CONTACT_EMAIL || 'mailto:notifications@meditrax.ca';
const WEB_PUSH_VAPID_PUBLIC = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || (functions.config().webpush?.vapid_public_key as string | undefined);
const WEB_PUSH_VAPID_PRIVATE = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || (functions.config().webpush?.vapid_private_key as string | undefined);

if (WEB_PUSH_VAPID_PUBLIC && WEB_PUSH_VAPID_PRIVATE) {
  webpush.setVapidDetails(WEB_PUSH_CONTACT, WEB_PUSH_VAPID_PUBLIC, WEB_PUSH_VAPID_PRIVATE);
  console.log('🔐 Web Push VAPID configured');
} else {
  console.warn('⚠️ Web Push VAPID keys not configured. iOS/ Safari Web Push will be disabled.');
}

// Types matching frontend
interface MedTrackReminder {
  id: string;
  userId: string;
  medicationId: string;
  medicationName: string;
  time: string; // HH:MM format
  days: string[]; // ['monday', 'tuesday', etc.]
  isActive: boolean;
  customMessage?: string;
  dosage?: string;
  unit?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface ScheduledNotification {
  id: string;
  userId: string;
  reminderId: string;
  medicationId: string;
  medicationName: string;
  scheduledTime: admin.firestore.Timestamp;
  fcmTokens: string[];
  payload: {
    title: string;
    body: string;
    icon: string;
    badge: string;
    data: any;
  };
  status: 'scheduled' | 'sent' | 'failed';
  attempts: number;
  createdAt: admin.firestore.Timestamp;
}

interface WebPushSubscriptionRecord {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * HTTP function to sync reminders from frontend to backend
 * Called when user creates/updates/deletes reminders
 */
export const syncUserReminders = functions.https.onCall(async (data, context) => {
  // Support both authenticated and fallback user IDs
  const userId = context.auth?.uid || data.userId;
  console.log('🔄 syncUserReminders called', { userId, hasAuth: !!context.auth });

  if (!userId) {
    throw new functions.https.HttpsError('unauthenticated', 'User ID must be provided');
  }

  const { reminders, medications, fcmTokens } = data;

  try {
    const batch = db.batch();

    // Store user's reminders
    for (const reminder of reminders) {
      const reminderRef = db.collection('users').doc(userId).collection('reminders').doc(reminder.id);
      batch.set(reminderRef, {
        ...reminder,
        userId,
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });
    }

    // Store user's medications for reference
    for (const medication of medications) {
      const medRef = db.collection('users').doc(userId).collection('medications').doc(medication.id);
      batch.set(medRef, {
        ...medication,
        userId,
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });
    }

    // Store user's FCM tokens
    for (const token of fcmTokens) {
      const tokenRef = db.collection('users').doc(userId).collection('fcmTokens').doc(token);
      batch.set(tokenRef, {
        token,
        userId,
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });
    }

    await batch.commit();

    // Schedule notifications for active reminders
    await scheduleNotificationsForUser(userId);

    console.log('✅ User reminders synced successfully', { userId });
    return { success: true };

  } catch (error) {
    console.error('❌ Failed to sync user reminders:', error);
    throw new functions.https.HttpsError('internal', 'Failed to sync reminders');
  }
});

/**
 * Register a Web Push subscription for the current user (Safari/iOS/desktop)
 */
export const registerWebPushSubscription = functions.https.onCall(async (data, context) => {
  const userId = context.auth?.uid || data.userId;
  const subscription = data.subscription as { endpoint: string; keys: { p256dh: string; auth: string } } | undefined;
  const userAgent = data.userAgent as string | undefined;

  if (!userId) {
    throw new functions.https.HttpsError('unauthenticated', 'User ID must be provided');
  }
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid Web Push subscription is required');
  }
  if (!WEB_PUSH_VAPID_PUBLIC || !WEB_PUSH_VAPID_PRIVATE) {
    console.warn('registerWebPushSubscription called but VAPID keys are not configured.');
  }

  try {
    const subId = Buffer.from(subscription.endpoint).toString('base64').replace(/\W/g, '').slice(0, 64);
    const subRef = db.collection('users').doc(userId).collection('webPushSubscriptions').doc(subId);

    await subRef.set({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: userAgent || null,
      createdAt: FIELD_VALUE.serverTimestamp(),
      updatedAt: FIELD_VALUE.serverTimestamp(),
    } as unknown as WebPushSubscriptionRecord, { merge: true });

    console.log('✅ Web Push subscription registered:', userId, subId);
    return { success: true, id: subId };
  } catch (error) {
    console.error('❌ Failed to register Web Push subscription:', error);
    throw new functions.https.HttpsError('internal', 'Failed to register subscription');
  }
});

/**
 * Unregister a Web Push subscription by endpoint
 */
export const unregisterWebPushSubscription = functions.https.onCall(async (data, context) => {
  const userId = context.auth?.uid || data.userId;
  const endpoint = data.endpoint as string | undefined;

  if (!userId) {
    throw new functions.https.HttpsError('unauthenticated', 'User ID must be provided');
  }
  if (!endpoint) {
    throw new functions.https.HttpsError('invalid-argument', 'Endpoint is required');
  }

  try {
    const subId = Buffer.from(endpoint).toString('base64').replace(/\W/g, '').slice(0, 64);
    const subRef = db.collection('users').doc(userId).collection('webPushSubscriptions').doc(subId);
    await subRef.delete();
    console.log('🗑️ Web Push subscription removed:', userId, subId);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to unregister Web Push subscription:', error);
    throw new functions.https.HttpsError('internal', 'Failed to unregister subscription');
  }
});

/**
 * Scheduled function that runs every minute to send due notifications
 * This replaces the service worker scheduling that iOS kills
 */
export const sendScheduledNotifications = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('America/New_York') // Adjust timezone as needed
  .onRun(async (context) => {
    console.log('⏰ sendScheduledNotifications triggered at:', context.timestamp);

    try {
      const now = admin.firestore.Timestamp.now();
      const oneMinuteAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 60000);

      // Find notifications due within the last minute
      const dueNotifications = await db
        .collection('scheduledNotifications')
        .where('status', '==', 'scheduled')
        .where('scheduledTime', '<=', now)
        .where('scheduledTime', '>', oneMinuteAgo)
        .limit(100) // Process up to 100 notifications per run
        .get();

      console.log(`📋 Found ${dueNotifications.docs.length} due notifications`);

      const batch = db.batch();
      const notificationsToSend = [];

      for (const doc of dueNotifications.docs) {
        const notification = doc.data() as ScheduledNotification;
        const notificationWithDocId = { 
          ...notification,
          id: doc.id // Override with document ID
        };
        notificationsToSend.push(notificationWithDocId);

        // Mark as being processed
        batch.update(doc.ref, {
          status: 'sending',
          attempts: (notification.attempts || 0) + 1,
          updatedAt: FIELD_VALUE.serverTimestamp(),
        });
      }

      if (notificationsToSend.length > 0) {
        await batch.commit();

        // Send all notifications
        const sendPromises = notificationsToSend.map(sendNotificationToUser);
        await Promise.allSettled(sendPromises);
      }

      console.log('✅ Scheduled notifications processing completed');
      return { processed: notificationsToSend.length };

    } catch (error) {
      console.error('❌ Failed to send scheduled notifications:', error);
      throw error;
    }
  });

/**
 * Send individual notification via FCM
 */
async function sendNotificationToUser(notification: ScheduledNotification & { id: string }) {
  console.log(`📨 Sending notification: ${notification.id} to user: ${notification.userId}`);

  try {
    const { fcmTokens, payload } = notification;

    if (!fcmTokens || fcmTokens.length === 0) {
      console.warn(`⚠️ No FCM tokens for notification ${notification.id}`);
      await updateNotificationStatus(notification.id, 'failed', 'No FCM tokens');
      return;
    }

    // Prepare FCM message
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
      },
      data: payload.data,
      android: {
        notification: {
          icon: 'ic_notification',
          sound: 'default',
          channelId: 'medication-reminders',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon,
          badge: payload.badge,
          requireInteraction: true,
          actions: [
            { action: 'take', title: '✅ Taken' },
            { action: 'snooze', title: '⏰ Snooze 15min' },
            { action: 'skip', title: '⏸️ Skip' },
          ],
        },
        fcmOptions: {
          link: 'https://www.meditrax.ca/',
        },
      },
    };

    // Send to all user's FCM tokens
    const sendPromises = fcmTokens.map(async (token) => {
      try {
        await messaging.send({ ...message, token });
        console.log(`✅ Notification sent to token: ${token.substring(0, 20)}...`);
        return { success: true, token };
      } catch (error) {
        console.warn(`❌ Failed to send to token ${token.substring(0, 20)}...`, error);
        return { success: false, token, error: (error as Error).message };
      }
    });

    const results = await Promise.allSettled(sendPromises);
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;

    if (successCount > 0) {
      await updateNotificationStatus(notification.id, 'sent', `Sent to ${successCount}/${fcmTokens.length} FCM tokens`);
      console.log(`✅ Notification ${notification.id} sent successfully to ${successCount} FCM devices`);
    } else {
      console.warn(`⚠️ Notification ${notification.id} failed to send via FCM`);
    }

    // Additionally send via Web Push to iOS/Safari subscriptions
    try {
      const webPushResult = await sendWebPushToUser(notification.userId, notification.payload);
      if (webPushResult.sent > 0) {
        console.log(`✅ Web Push sent to ${webPushResult.sent}/${webPushResult.total} subscriptions`);
        // Mark as sent if either channel succeeded
        await updateNotificationStatus(notification.id, 'sent', `WebPush ${webPushResult.sent}/${webPushResult.total}; FCM ${successCount}/${fcmTokens.length}`);
      } else if (successCount === 0) {
        await updateNotificationStatus(notification.id, 'failed', 'Failed via both FCM and Web Push');
        console.error(`❌ Notification ${notification.id} failed via both channels`);
      }
    } catch (wpError) {
      console.error('❌ Web Push sending error:', wpError);
      if (successCount === 0) {
        await updateNotificationStatus(notification.id, 'failed', 'FCM and Web Push errors');
      }
    }

  } catch (error) {
    console.error(`❌ Error sending notification ${notification.id}:`, error);
    await updateNotificationStatus(notification.id, 'failed', (error as Error).message);
  }
}

/**
 * Send a web push to all subscriptions of a user
 */
async function sendWebPushToUser(userId: string, payload: ScheduledNotification['payload']) {
  if (!WEB_PUSH_VAPID_PUBLIC || !WEB_PUSH_VAPID_PRIVATE) {
    return { sent: 0, total: 0 };
  }

  const subsSnap = await db.collection('users').doc(userId).collection('webPushSubscriptions').get();
  const subscriptions = subsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Array<WebPushSubscriptionRecord & { id: string }>;

  if (subscriptions.length === 0) {
    return { sent: 0, total: 0 };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    data: payload.data,
  });

  let sent = 0;
  const removals: Array<Promise<any>> = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          } as any,
          body,
          { TTL: 60 * 60 } // 1 hour TTL
        );
        sent += 1;
      } catch (err: any) {
        const status = err?.statusCode || err?.statusCode;
        console.warn(`Web Push send failed for ${sub.id} (status: ${status})`);
        if (status === 404 || status === 410) {
          // Subscription expired or gone, remove it
          removals.push(
            db.collection('users').doc(userId).collection('webPushSubscriptions').doc(sub.id).delete()
          );
        }
      }
    })
  );

  if (removals.length) {
    await Promise.allSettled(removals);
  }

  return { sent, total: subscriptions.length };
}

/**
 * Update notification status in Firestore
 */
async function updateNotificationStatus(notificationId: string, status: string, error?: string) {
  try {
    await db.collection('scheduledNotifications').doc(notificationId).update({
      status,
      error: error || null,
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });
  } catch (updateError) {
    console.error(`Failed to update notification ${notificationId} status:`, updateError);
  }
}

/**
 * Schedule future notifications for a user's reminders
 */
async function scheduleNotificationsForUser(userId: string) {
  console.log(`📅 Scheduling notifications for user: ${userId}`);

  try {
    // Get user's active reminders
    const remindersSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('reminders')
      .where('isActive', '==', true)
      .get();

    // Get user's medications
    const medicationsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('medications')
      .get();

    // Get user's FCM tokens
    const tokensSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('fcmTokens')
      .get();

    const medications: { [key: string]: any } = {};
    medicationsSnapshot.docs.forEach((doc) => {
      medications[doc.id] = doc.data();
    });

    const fcmTokens = tokensSnapshot.docs.map((doc) => doc.data().token);

    if (fcmTokens.length === 0) {
      console.warn(`⚠️ No FCM tokens for user ${userId}`);
      return;
    }

    // Remove existing scheduled notifications for this user
    const existingNotifications = await db
      .collection('scheduledNotifications')
      .where('userId', '==', userId)
      .where('status', '==', 'scheduled')
      .get();

    const batch = db.batch();

    // Delete existing scheduled notifications
    existingNotifications.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Generate new notifications for the next 7 days
    const now = new Date();
    const daysToSchedule = 7;

    for (const reminderDoc of remindersSnapshot.docs) {
      const reminder = reminderDoc.data() as MedTrackReminder;
      const medication = medications[reminder.medicationId];

      if (!medication) {
        console.warn(`⚠️ Medication not found for reminder ${reminder.id}`);
        continue;
      }

      // Generate notifications for the next 7 days
      for (let dayOffset = 0; dayOffset < daysToSchedule; dayOffset++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + dayOffset);
        
        const dayName = checkDate.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();

        if (reminder.days.includes(dayName)) {
          const [hours, minutes] = reminder.time.split(':');
          checkDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          // Only schedule future notifications
          if (checkDate > now) {
            const notificationId = `${reminder.id}_${checkDate.getTime()}`;
            const notificationRef = db.collection('scheduledNotifications').doc(notificationId);

            const notificationPayload = {
              id: notificationId,
              userId,
              reminderId: reminder.id,
              medicationId: reminder.medicationId,
              medicationName: medication.name,
              scheduledTime: admin.firestore.Timestamp.fromDate(checkDate),
              fcmTokens,
              payload: {
                title: `💊 Time for ${medication.name}`,
                body: reminder.customMessage || `Take your ${medication.dosage || ''} ${medication.unit || ''} dose of ${medication.name}`.trim(),
                icon: '/pill-icon.svg',
                badge: '/pill-icon.svg',
                data: {
                  type: 'medication-reminder',
                  medicationId: reminder.medicationId,
                  reminderId: reminder.id,
                  medicationName: medication.name,
                  scheduledTime: checkDate.toISOString(),
                  fromBackend: true,
                },
              },
              status: 'scheduled' as const,
              attempts: 0,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            batch.set(notificationRef, notificationPayload);
          }
        }
      }
    }

    await batch.commit();
    console.log(`✅ Notifications scheduled for user ${userId}`);

  } catch (error) {
    console.error(`❌ Failed to schedule notifications for user ${userId}:`, error);
    throw error;
  }
}

/**
 * HTTP function to manually trigger notification scheduling
 * Useful for testing and immediate scheduling
 */
export const scheduleUserNotifications = functions.https.onCall(async (data, context) => {
  // Support both authenticated and fallback user IDs
  const userId = context.auth?.uid || data.userId;
  console.log(`📅 Manual scheduling triggered for user: ${userId}`, { hasAuth: !!context.auth });

  if (!userId) {
    throw new functions.https.HttpsError('unauthenticated', 'User ID must be provided');
  }

  try {
    await scheduleNotificationsForUser(userId);
    return { success: true, message: 'Notifications scheduled successfully' };
  } catch (error) {
    console.error('❌ Manual scheduling failed:', error);
    throw new functions.https.HttpsError('internal', 'Failed to schedule notifications');
  }
});

/**
 * Cleanup old sent/failed notifications (runs daily)
 */
export const cleanupOldNotifications = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    console.log('🧹 Cleaning up old notifications');

    const twoDaysAgo = admin.firestore.Timestamp.fromMillis(
      Date.now() - (2 * 24 * 60 * 60 * 1000)
    );

    const oldNotifications = await db
      .collection('scheduledNotifications')
      .where('status', 'in', ['sent', 'failed'])
      .where('updatedAt', '<=', twoDaysAgo)
      .limit(500)
      .get();

    const batch = db.batch();
    oldNotifications.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`🧹 Cleaned up ${oldNotifications.docs.length} old notifications`);
    return { deleted: oldNotifications.docs.length };
  });

/**
 * Manually send a test Web Push to the current user's subscriptions
 */
export const sendTestWebPush = functions.https.onCall(async (data, context) => {
  const userId = context.auth?.uid || data.userId;
  if (!userId) {
    throw new functions.https.HttpsError('unauthenticated', 'User ID must be provided');
  }
  try {
    const result = await sendWebPushToUser(userId, {
      title: '🧪 MedTrack Test',
      body: 'If you see this, Web Push is working!',
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      data: { type: 'test', timestamp: Date.now() },
    } as any);
    return { success: result.sent > 0, ...result };
  } catch (error) {
    console.error('Test Web Push failed:', error);
    throw new functions.https.HttpsError('internal', 'Test Web Push failed');
  }
});
