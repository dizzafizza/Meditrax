/**
 * Alert Notification Service
 * Centralized service for scheduling alert notifications
 * Integrates with inventory, dependency, psychological, and adherence tracking
 */

import { Medication, MedicationLog } from '@/types';
import { notificationService } from './notificationService';
import { PersonalRefillService, PersonalMedicationTracker } from './enhancedInventoryService';

class AlertNotificationService {
  /**
   * Check and schedule inventory alert notifications for a medication
   */
  async checkAndScheduleInventoryAlerts(medication: Medication, logs: MedicationLog[], alertPrefs?: any): Promise<void> {
    if (!alertPrefs?.enableInventoryAlerts) return;

    try {
      // Get current pill count
      let currentPillCount = medication.pillsRemaining || 0;
      
      // For multiple pill medications, sum up total count
      if (medication.useMultiplePills && medication.pillInventory) {
        currentPillCount = medication.pillInventory.reduce((total, item) => total + item.currentCount, 0);
      }

      // Don't check if no inventory tracked
      if (currentPillCount <= 0) return;

      // Analyze usage patterns
      const usagePattern = PersonalMedicationTracker.analyzeUsagePattern(medication, logs);
      
      // Predict refill needs
      const prediction = PersonalMedicationTracker.predictRefillNeeds(
        medication,
        currentPillCount,
        usagePattern,
        {
          medicationId: medication.id,
          medicationName: medication.name,
          trackInventory: true,
          minimumDaysSupply: 7,
          emergencyDeliveryThreshold: 3,
          reminderDaysAdvance: 7,
        }
      );

      // Generate alerts
      const alerts = PersonalMedicationTracker.generateMedicationAlerts(
        medication,
        currentPillCount,
        prediction,
        {
          medicationId: medication.id,
          medicationName: medication.name,
          trackInventory: true,
          minimumDaysSupply: 7,
          emergencyDeliveryThreshold: 3,
          reminderDaysAdvance: 7,
        },
        []
      );

      // Schedule notifications for each alert
      for (const alert of alerts) {
        if (notificationService.shouldSendAlert('inventory', alert.priority, alertPrefs)) {
          await notificationService.scheduleInventoryAlert(alert, medication);
        }
      }
    } catch (error) {
      console.error('Failed to check and schedule inventory alerts:', error);
    }
  }

  /**
   * Check inventory alerts for all active medications
   */
  async checkAllInventoryAlerts(medications: Medication[], logs: MedicationLog[], alertPrefs?: any): Promise<void> {
    const activeMedications = medications.filter(m => m.isActive);
    
    for (const medication of activeMedications) {
      const medicationLogs = logs.filter(l => l.medicationId === medication.id);
      await this.checkAndScheduleInventoryAlerts(medication, medicationLogs, alertPrefs);
    }
  }

  /**
   * Schedule daily inventory check
   * This should be called once per day to check all medications
   */
  async scheduleDailyInventoryCheck(medications: Medication[], logs: MedicationLog[], alertPrefs?: any): Promise<void> {
    // Check once immediately
    await this.checkAllInventoryAlerts(medications, logs, alertPrefs);

    // Schedule next check for tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    // Use setInterval in a production app or a background task scheduler
    // For now, we'll rely on app opening to trigger checks
  }
}

export const alertNotificationService = new AlertNotificationService();
export default alertNotificationService;

