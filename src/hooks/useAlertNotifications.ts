/**
 * useAlertNotifications Hook
 * Checks for alerts and schedules notifications on app startup and medication updates
 */

import { useEffect } from 'react';
import { useMedicationStore } from '@/store';
import { alertNotificationService } from '@/services/alertNotificationService';

export const useAlertNotifications = () => {
  const { medications, logs, userProfile } = useMedicationStore();

  useEffect(() => {
    const checkAlerts = async () => {
      const alertPrefs = userProfile?.preferences?.alertNotifications;
      
      // Check inventory alerts for all medications
      if (alertPrefs?.enableInventoryAlerts) {
        await alertNotificationService.checkAllInventoryAlerts(medications, logs, alertPrefs);
      }

      // Generate and schedule psychological safety alerts
      if (alertPrefs?.enablePsychologicalAlerts) {
        const { generatePsychologicalSafetyAlerts } = useMedicationStore.getState();
        const alerts = generatePsychologicalSafetyAlerts();
        // Notifications are already scheduled in the store action
      }

      // Update risk assessments for high-risk medications
      if (alertPrefs?.enableDependencyAlerts) {
        const { updateRiskAssessment, getHighRiskMedications } = useMedicationStore.getState();
        const highRiskMeds = getHighRiskMedications();
        highRiskMeds.forEach(med => {
          updateRiskAssessment(med.id);
        });
      }
    };

    // Run check on mount and when medications/logs change
    const timer = setTimeout(checkAlerts, 2000); // Delay to avoid blocking initial render

    return () => clearTimeout(timer);
  }, [medications.length, logs.length, userProfile?.preferences?.alertNotifications]);

  // Periodic inventory check (once per day)
  useEffect(() => {
    const checkInventoryDaily = () => {
      const alertPrefs = userProfile?.preferences?.alertNotifications;
      if (alertPrefs?.enableInventoryAlerts) {
        alertNotificationService.checkAllInventoryAlerts(medications, logs, alertPrefs);
      }
    };

    // Check once per day (24 hours)
    const interval = setInterval(checkInventoryDaily, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
};

