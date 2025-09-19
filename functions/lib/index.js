"use strict";
/**
 * Firebase Cloud Functions for MedTrack
 * Backend-scheduled push notifications for iOS PWA reliability
 *
 * Solves the iOS PWA limitation where service workers don't run when app is closed
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldNotifications = exports.scheduleUserNotifications = exports.sendScheduledNotifications = exports.syncUserReminders = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
/**
 * HTTP function to sync reminders from frontend to backend
 * Called when user creates/updates/deletes reminders
 */
exports.syncUserReminders = functions.https.onCall(async (data, context) => {
    var _a;
    // Support both authenticated and fallback user IDs
    const userId = ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || data.userId;
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
            batch.set(reminderRef, Object.assign(Object.assign({}, reminder), { userId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        }
        // Store user's medications for reference
        for (const medication of medications) {
            const medRef = db.collection('users').doc(userId).collection('medications').doc(medication.id);
            batch.set(medRef, Object.assign(Object.assign({}, medication), { userId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        }
        // Store user's FCM tokens
        for (const token of fcmTokens) {
            const tokenRef = db.collection('users').doc(userId).collection('fcmTokens').doc(token);
            batch.set(tokenRef, {
                token,
                userId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
        // Schedule notifications for active reminders
        await scheduleNotificationsForUser(userId);
        console.log('✅ User reminders synced successfully', { userId });
        return { success: true };
    }
    catch (error) {
        console.error('❌ Failed to sync user reminders:', error);
        throw new functions.https.HttpsError('internal', 'Failed to sync reminders');
    }
});
/**
 * Scheduled function that runs every minute to send due notifications
 * This replaces the service worker scheduling that iOS kills
 */
exports.sendScheduledNotifications = functions.pubsub
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
            const notification = doc.data();
            const notificationWithDocId = Object.assign(Object.assign({}, notification), { id: doc.id // Override with document ID
             });
            notificationsToSend.push(notificationWithDocId);
            // Mark as being processed
            batch.update(doc.ref, {
                status: 'sending',
                attempts: (notification.attempts || 0) + 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    }
    catch (error) {
        console.error('❌ Failed to send scheduled notifications:', error);
        throw error;
    }
});
/**
 * Send individual notification via FCM
 */
async function sendNotificationToUser(notification) {
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
                    link: 'https://your-pwa-url.com/', // Replace with your PWA URL
                },
            },
        };
        // Send to all user's FCM tokens
        const sendPromises = fcmTokens.map(async (token) => {
            try {
                await messaging.send(Object.assign(Object.assign({}, message), { token }));
                console.log(`✅ Notification sent to token: ${token.substring(0, 20)}...`);
                return { success: true, token };
            }
            catch (error) {
                console.warn(`❌ Failed to send to token ${token.substring(0, 20)}...`, error);
                return { success: false, token, error: error.message };
            }
        });
        const results = await Promise.allSettled(sendPromises);
        const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
        if (successCount > 0) {
            await updateNotificationStatus(notification.id, 'sent', `Sent to ${successCount}/${fcmTokens.length} tokens`);
            console.log(`✅ Notification ${notification.id} sent successfully to ${successCount} devices`);
        }
        else {
            await updateNotificationStatus(notification.id, 'failed', 'Failed to send to any tokens');
            console.error(`❌ Notification ${notification.id} failed to send to all tokens`);
        }
    }
    catch (error) {
        console.error(`❌ Error sending notification ${notification.id}:`, error);
        await updateNotificationStatus(notification.id, 'failed', error.message);
    }
}
/**
 * Update notification status in Firestore
 */
async function updateNotificationStatus(notificationId, status, error) {
    try {
        await db.collection('scheduledNotifications').doc(notificationId).update({
            status,
            error: error || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (updateError) {
        console.error(`Failed to update notification ${notificationId} status:`, updateError);
    }
}
/**
 * Schedule future notifications for a user's reminders
 */
async function scheduleNotificationsForUser(userId) {
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
        const medications = {};
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
            const reminder = reminderDoc.data();
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
                            status: 'scheduled',
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
    }
    catch (error) {
        console.error(`❌ Failed to schedule notifications for user ${userId}:`, error);
        throw error;
    }
}
/**
 * HTTP function to manually trigger notification scheduling
 * Useful for testing and immediate scheduling
 */
exports.scheduleUserNotifications = functions.https.onCall(async (data, context) => {
    var _a;
    // Support both authenticated and fallback user IDs
    const userId = ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || data.userId;
    console.log(`📅 Manual scheduling triggered for user: ${userId}`, { hasAuth: !!context.auth });
    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'User ID must be provided');
    }
    try {
        await scheduleNotificationsForUser(userId);
        return { success: true, message: 'Notifications scheduled successfully' };
    }
    catch (error) {
        console.error('❌ Manual scheduling failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to schedule notifications');
    }
});
/**
 * Cleanup old sent/failed notifications (runs daily)
 */
exports.cleanupOldNotifications = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
    console.log('🧹 Cleaning up old notifications');
    const twoDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - (2 * 24 * 60 * 60 * 1000));
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
//# sourceMappingURL=index.js.map