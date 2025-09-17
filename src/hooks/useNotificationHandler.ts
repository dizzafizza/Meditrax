/**
 * Hook to handle notification events from service worker
 * Integrates with medication store to sync notification actions
 */

import { useEffect } from 'react';
import { useMedicationStore } from '@/store';
import { notificationService } from '@/services/notificationService';
import toast from 'react-hot-toast';

export function useNotificationHandler() {
  const {
    markMedicationTaken,
    markMedicationMissed,
    snoozeReminder,
    reminders,
    medications
  } = useMedicationStore();

  useEffect(() => {
    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data;

      switch (type) {
        case 'MEDICATION_TAKEN':
          handleMedicationTaken(data);
          break;
        case 'MEDICATION_SNOOZED':
          handleMedicationSnoozed(data);
          break;
        case 'MEDICATION_SKIPPED':
          handleMedicationSkipped(data);
          break;
        case 'SYNC_MEDICATION_ACTION':
          handleSyncMedicationAction(data);
          break;
        case 'SYNC_REMINDERS_REQUEST':
          handleSyncRemindersRequest();
          break;
        default:
          break;
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Listen for window messages (fallback)
    window.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleMedicationTaken = (data: any) => {
    try {
      const { medicationId, reminderId, timestamp } = data;
      const medication = medications.find(m => m.id === medicationId);
      
      if (medication) {
        markMedicationTaken(medicationId, medication.dosage);
        toast.success(`✓ ${medication.name} marked as taken`);
      }
    } catch (error) {
      console.error('Failed to handle medication taken:', error);
      toast.error('Failed to mark medication as taken');
    }
  };

  const handleMedicationSnoozed = (data: any) => {
    try {
      const { medicationId, reminderId, snoozeMinutes } = data;
      const reminder = reminders.find(r => r.id === reminderId);
      const medication = medications.find(m => m.id === medicationId);
      
      if (reminder && medication) {
        snoozeReminder(reminderId, snoozeMinutes);
        toast.success(`⏰ ${medication.name} reminder snoozed for ${snoozeMinutes} minutes`);
      }
    } catch (error) {
      console.error('Failed to handle medication snoozed:', error);
      toast.error('Failed to snooze medication reminder');
    }
  };

  const handleMedicationSkipped = (data: any) => {
    try {
      const { medicationId, reminderId } = data;
      const medication = medications.find(m => m.id === medicationId);
      
      if (medication) {
        markMedicationMissed(medicationId);
        toast.info(`⏸️ ${medication.name} marked as skipped`);
      }
    } catch (error) {
      console.error('Failed to handle medication skipped:', error);
      toast.error('Failed to mark medication as skipped');
    }
  };

  const handleSyncMedicationAction = (actionData: any) => {
    try {
      const { action, medicationId, reminderId, timestamp, snoozeMinutes } = actionData;
      
      switch (action) {
        case 'taken':
          handleMedicationTaken({ medicationId, reminderId, timestamp });
          break;
        case 'snoozed':
          handleMedicationSnoozed({ medicationId, reminderId, snoozeMinutes });
          break;
        case 'skipped':
          handleMedicationSkipped({ medicationId, reminderId });
          break;
        default:
          console.warn('Unknown medication action:', action);
      }
    } catch (error) {
      console.error('Failed to sync medication action:', error);
    }
  };

  const handleSyncRemindersRequest = () => {
    try {
      // Re-schedule all active reminders
      reminders
        .filter(reminder => reminder.isActive)
        .forEach(async (reminder) => {
          const medication = medications.find(m => m.id === reminder.medicationId);
          if (medication) {
            await notificationService.scheduleReminder(reminder, medication);
          }
        });
      
      console.log('Reminders synced with service worker');
    } catch (error) {
      console.error('Failed to sync reminders:', error);
    }
  };

  return {
    // Expose utility functions if needed
    scheduleAllReminders: async () => {
      try {
        const activeReminders = reminders.filter(reminder => reminder.isActive);
        
        for (const reminder of activeReminders) {
          const medication = medications.find(m => m.id === reminder.medicationId);
          if (medication) {
            await notificationService.scheduleReminder(reminder, medication);
          }
        }
        
        toast.success(`Scheduled ${activeReminders.length} reminder notifications`);
      } catch (error) {
        console.error('Failed to schedule reminders:', error);
        toast.error('Failed to schedule reminder notifications');
      }
    },
    
    testNotification: async () => {
      try {
        await notificationService.testNotification();
        toast.success('Test notification sent!');
      } catch (error) {
        console.error('Failed to send test notification:', error);
        toast.error('Failed to send test notification');
      }
    }
  };
}

export default useNotificationHandler;

