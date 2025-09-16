import { Medication, MedicationLog } from '@/types';
import { isWeightBasedUnit, convertToBaseWeight, convertFromBaseWeight } from './helpers';

/**
 * Calculate daily usage rate for a medication
 */
export function calculateDailyUsageRate(medication: Medication, logs: MedicationLog[]): number {
  const medicationLogs = logs.filter(log => log.medicationId === medication.id);
  
  if (medicationLogs.length === 0) {
    // Fallback to scheduled dosage
    const scheduledDose = parseFloat(medication.dosage) || 1;
    const frequency = medication.frequency;
    
    switch (frequency) {
      case 'once-daily': return scheduledDose;
      case 'twice-daily': return scheduledDose * 2;
      case 'three-times-daily': return scheduledDose * 3;
      case 'four-times-daily': return scheduledDose * 4;
      default: return scheduledDose;
    }
  }

  // Calculate actual usage from logs
  const recentLogs = medicationLogs.slice(-30); // Last 30 logs
  const totalDaysLogged = Math.max(1, recentLogs.length);
  
  if (isWeightBasedUnit(medication.unit)) {
    // For weight-based units, sum actual dosages
    const totalDosage = recentLogs.reduce((sum, log) => {
      return sum + (log.dosageTaken || parseFloat(medication.dosage) || 0);
    }, 0);
    return totalDosage / totalDaysLogged;
  } else {
    // For discrete units, count doses taken
    return recentLogs.length / totalDaysLogged;
  }
}

/**
 * Calculate how many days the current inventory will last
 */
export function calculateDaysRemaining(medication: Medication, logs: MedicationLog[]): number {
  const currentCount = getCurrentInventoryCount(medication);
  const dailyUsage = calculateDailyUsageRate(medication, logs);
  
  if (dailyUsage === 0) return Infinity;
  
  return Math.floor(currentCount / dailyUsage);
}

/**
 * Get current inventory count for a medication
 */
export function getCurrentInventoryCount(medication: Medication): number {
  if (medication.pillInventory && medication.pillInventory.length > 0) {
    return medication.pillInventory.reduce((total, item) => total + item.currentCount, 0);
  }
  return medication.pillsRemaining || 0;
}

/**
 * Format inventory display with proper units
 */
export function formatInventoryDisplay(medication: Medication): string {
  const currentCount = getCurrentInventoryCount(medication);
  const unit = medication.inventoryUnit || medication.unit || 'units';
  
  if (currentCount === 0) {
    return 'Out of stock';
  }
  
  if (isWeightBasedUnit(unit)) {
    // For weight-based units, format with proper precision
    if (currentCount >= 1000 && (unit === 'mg' || unit === 'mcg')) {
      if (unit === 'mg') {
        return `${(currentCount / 1000).toFixed(1)}g remaining`;
      } else {
        return `${(currentCount / 1000).toFixed(1)}mg remaining`;
      }
    }
    return `${currentCount}${unit} remaining`;
  } else {
    // For discrete units
    return `${currentCount} ${unit} remaining`;
  }
}

/**
 * Check if inventory is running low
 */
export function isInventoryLow(medication: Medication, logs: MedicationLog[]): boolean {
  const daysRemaining = calculateDaysRemaining(medication, logs);
  return daysRemaining <= 7; // Less than a week
}

/**
 * Get inventory status with proper messaging
 */
export function getInventoryStatus(medication: Medication, logs: MedicationLog[]): {
  status: 'adequate' | 'low' | 'critical' | 'out';
  message: string;
  daysRemaining: number;
} {
  const currentCount = getCurrentInventoryCount(medication);
  const daysRemaining = calculateDaysRemaining(medication, logs);
  const unit = medication.inventoryUnit || medication.unit || 'units';
  
  if (currentCount === 0) {
    return {
      status: 'out',
      message: 'Out of stock',
      daysRemaining: 0
    };
  }
  
  if (daysRemaining <= 3) {
    return {
      status: 'critical',
      message: `Critical: Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`,
      daysRemaining
    };
  }
  
  if (daysRemaining <= 7) {
    return {
      status: 'low',
      message: `Low stock: ${daysRemaining} days remaining`,
      daysRemaining
    };
  }
  
  return {
    status: 'adequate',
    message: `${formatInventoryDisplay(medication)} (${daysRemaining} days)`,
    daysRemaining
  };
}
