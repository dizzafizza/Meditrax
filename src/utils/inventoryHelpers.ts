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
  if (medication.useMultiplePills && medication.pillInventory && medication.pillInventory.length > 0) {
    // For multiple pill medications, sum up all pill configurations
    return medication.pillInventory.reduce((total, item) => total + item.currentCount, 0);
  }
  // For legacy single pill medications
  return medication.pillsRemaining || 0;
}

/**
 * Get current inventory count for a specific pill configuration
 */
export function getPillConfigurationCount(medication: Medication, pillConfigurationId: string): number {
  if (!medication.useMultiplePills || !medication.pillInventory) {
    return 0;
  }
  
  const pillInventoryItem = medication.pillInventory.find(
    item => item.pillConfigurationId === pillConfigurationId
  );
  
  return pillInventoryItem ? pillInventoryItem.currentCount : 0;
}

/**
 * Check if any pill configuration is running low
 */
export function isAnyPillConfigurationLow(medication: Medication, logs: MedicationLog[]): boolean {
  if (!medication.useMultiplePills || !medication.pillInventory) {
    return isInventoryLow(medication, logs);
  }

  return medication.pillInventory.some(item => {
    const count = item.currentCount;
    const safetyStock = item.safetyStock || 7; // Default 7 day safety stock
    return count <= safetyStock;
  });
}

/**
 * Format inventory display with proper units
 */
export function formatInventoryDisplay(medication: Medication): string {
  if (medication.useMultiplePills && medication.pillInventory && medication.pillInventory.length > 0) {
    // For multiple pill medications, show breakdown by pill configuration
    const pillBreakdown = medication.pillInventory
      .filter(item => item.currentCount > 0)
      .map(item => {
        const pillConfig = medication.pillConfigurations?.find(
          config => config.id === item.pillConfigurationId
        );
        if (!pillConfig) return null;
        
        const strength = pillConfig.strength;
        const unit = pillConfig.unit;
        const color = pillConfig.color ? ` ${pillConfig.color}` : '';
        const count = item.currentCount;
        const inventoryUnit = medication.inventoryUnit || 'pill';
        
        return count === 1 
          ? `1 × ${strength}${unit}${color} ${inventoryUnit}`
          : `${count} × ${strength}${unit}${color} ${inventoryUnit}s`;
      })
      .filter(Boolean);

    if (pillBreakdown.length === 0) {
      return 'Out of stock';
    } else if (pillBreakdown.length === 1) {
      return `${pillBreakdown[0]} remaining`;
    } else {
      return `${pillBreakdown.join(', ')} remaining`;
    }
  }
  
  // For legacy single pill medications
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
  // Check if using multiple pills system and if any configuration is low
  if (medication.useMultiplePills && isAnyPillConfigurationLow(medication, logs)) {
    return true;
  }
  
  // For legacy single pill system or as fallback
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
  
  // Handle multiple pill medications
  if (medication.useMultiplePills && medication.pillInventory && medication.pillInventory.length > 0) {
    // Check if any pill configuration is out of stock
    const outOfStockPills = medication.pillInventory.filter(item => item.currentCount === 0);
    if (outOfStockPills.length > 0) {
      const outOfStockCount = outOfStockPills.length;
      return {
        status: 'out',
        message: outOfStockCount === medication.pillInventory.length 
          ? 'Out of stock' 
          : `${outOfStockCount} pill configuration${outOfStockCount === 1 ? '' : 's'} out of stock`,
        daysRemaining: 0
      };
    }

    // Check if any pill configuration is critically low
    const criticallyLowPills = medication.pillInventory.filter(item => {
      const safetyStock = item.safetyStock || 3;
      return item.currentCount <= safetyStock && item.currentCount > 0;
    });

    if (criticallyLowPills.length > 0) {
      return {
        status: 'critical',
        message: `Critical: ${criticallyLowPills.length} pill configuration${criticallyLowPills.length === 1 ? '' : 's'} running low`,
        daysRemaining: Math.min(...criticallyLowPills.map(item => 
          Math.floor(item.currentCount / (item.safetyStock || 3))
        ))
      };
    }

    // Check if any pill configuration is low
    if (isAnyPillConfigurationLow(medication, logs)) {
      return {
        status: 'low',
        message: `Low stock: Some pill configurations need refilling`,
        daysRemaining: daysRemaining
      };
    }

    // All good
    return {
      status: 'adequate',
      message: `${formatInventoryDisplay(medication)} (${daysRemaining > 999 ? '999+' : daysRemaining} days)`,
      daysRemaining
    };
  }
  
  // Legacy single pill medication handling
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
    message: `${formatInventoryDisplay(medication)} (${daysRemaining > 999 ? '999+' : daysRemaining} days)`,
    daysRemaining
  };
}
