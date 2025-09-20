import { Medication, MedicationLog } from '@/types';
import { isWeightBasedUnit, convertToBaseWeight, convertFromBaseWeight, calculateCyclicDose, calculateTaperingDose } from './helpers';

// Compute average dosage multiplier across an entire cyclic pattern
function getCycleAverageMultiplier(cyclicPattern: any): number {
  if (!cyclicPattern?.pattern || !Array.isArray(cyclicPattern.pattern) || cyclicPattern.pattern.length === 0) {
    return 1;
  }
  const totalDuration = cyclicPattern.pattern.reduce((sum: number, step: any) => sum + (Number(step.duration) || 0), 0);
  if (totalDuration <= 0) return 1;
  const weightedSum = cyclicPattern.pattern.reduce((sum: number, step: any) => {
    const duration = Number(step.duration) || 0;
    const multiplier = Number(step.dosageMultiplier) || 0;
    return sum + duration * multiplier;
  }, 0);
  return weightedSum / totalDuration;
}

/**
 * Calculate daily usage rate for a medication
 */
export function calculateDailyUsageRate(medication: Medication, logs: MedicationLog[]): number {
  const medicationLogs = logs.filter(log => log.medicationId === medication.id);

  // Frequency multiplier helper
  const perDayFromFrequency = (frequency: any) => {
    switch (frequency) {
      case 'once-daily': return 1;
      case 'twice-daily': return 2;
      case 'three-times-daily': return 3;
      case 'four-times-daily': return 4;
      default: return 1;
    }
  };

  // No logs yet → estimate from schedule
  if (medicationLogs.length === 0) {
    const cycleAvg = medication.cyclicDosing?.isActive ? getCycleAverageMultiplier(medication.cyclicDosing) : 1;
    if (medication.useMultiplePills) {
      const defaultConfig = medication.doseConfigurations?.find(
        c => c.id === medication.defaultDoseConfigurationId
      ) || medication.doseConfigurations?.[0];

      const perDosePillCount = defaultConfig
        ? defaultConfig.pillComponents.reduce((sum, c) => sum + c.quantity, 0)
        : 1;
      return perDosePillCount * perDayFromFrequency(medication.frequency) * cycleAvg;
    }

    const scheduledDose = parseFloat(medication.dosage) || 1;
    if (isWeightBasedUnit(medication.unit)) {
      return scheduledDose * perDayFromFrequency(medication.frequency) * cycleAvg;
    } else {
      const unitsPerDose = Number.isFinite(scheduledDose) ? scheduledDose : 1;
      return unitsPerDose * perDayFromFrequency(medication.frequency) * cycleAvg;
    }
  }

  // With logs → compute average per calendar day across a fixed window (includes skipped days)
  const WINDOW_DAYS = 30;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1));

  const recentLogs = medicationLogs.filter(l => new Date(l.timestamp) >= windowStart);
  const byDay = new Map<string, number>();

  for (const log of recentLogs) {
    const dayKey = new Date(log.timestamp).toDateString();
    let amount = 0;

    if (medication.useMultiplePills && (log as any).pillsLogged) {
      amount = (log as any).pillsLogged.reduce(
        (sum: number, pl: any) => sum + (Number(pl.quantityTaken) || 0),
        0
      );
    } else if (isWeightBasedUnit(medication.unit)) {
      amount = Number(log.dosageTaken) || parseFloat(medication.dosage) || 0;
    } else {
      amount = Number(log.dosageTaken) || parseFloat(medication.dosage) || 1;
    }

    byDay.set(dayKey, (byDay.get(dayKey) || 0) + amount);
  }

  const totalDays = WINDOW_DAYS; // include skipped days as zeros
  const total = Array.from(byDay.values()).reduce((a, b) => a + b, 0);
  return total / totalDays;
}

/**
 * Calculate how many days the current inventory will last
 */
export function calculateDaysRemaining(medication: Medication, logs: MedicationLog[]): number {
  // Helper: determine frequency per day (approximate for weekly/monthly)
  const frequencyPerDayMap: Record<string, number> = {
    'as-needed': 0,
    'once-daily': 1,
    'twice-daily': 2,
    'three-times-daily': 3,
    'four-times-daily': 4,
    'every-other-day': 0.5,
    'weekly': 1 / 7,
    'monthly': 1 / 30,
    'custom': 1,
  };

  // Prefer multiple-pill mg-based calculation when data is available
  const hasMulti = medication.useMultiplePills && Array.isArray(medication.pillConfigurations) && Array.isArray(medication.pillInventory) && medication.pillConfigurations.length > 0 && medication.pillInventory.length > 0;

  if (hasMulti) {
    // Total inventory in mg
    const totalInventoryMg = medication.pillInventory!.reduce((sum, item) => {
      const cfg = medication.pillConfigurations!.find(c => c.id === item.pillConfigurationId);
      if (!cfg) return sum;
      const perUnitMg = convertToBaseWeight(cfg.strength, cfg.unit);
      return sum + (perUnitMg * (Number(item.currentCount) || 0));
    }, 0);

    // Base daily dose (mg) from default dose configuration
    const defaultConfig = medication.doseConfigurations?.find(c => c.id === medication.defaultDoseConfigurationId) || medication.doseConfigurations?.[0];
    let doseMg = 0;
    if (defaultConfig) {
      doseMg = convertToBaseWeight(defaultConfig.totalDoseAmount, defaultConfig.totalDoseUnit);
    } else {
      // Legacy fallback: parse medication.dosage in medication.unit
      const baseDose = Number.parseFloat(medication.dosage) || 0;
      doseMg = convertToBaseWeight(baseDose, medication.unit);
    }

    // Apply tapering adjustment for today (base dose per dose)
    if (medication.tapering?.isActive) {
      doseMg = calculateTaperingDose({ ...medication.tapering, initialDose: doseMg, finalDose: Math.min(doseMg, medication.tapering.finalDose ?? 0) }, new Date(), medication);
    }

    const perDay = frequencyPerDayMap[medication.frequency] ?? 1;
    // Incorporate cyclic average multiplier across the full cycle
    const cycleAvg = medication.cyclicDosing?.isActive ? getCycleAverageMultiplier(medication.cyclicDosing) : 1;
    const dailyUsageMg = perDay === 0
      ? // As-needed: estimate mg/day over a fixed window (includes skipped days)
        (() => {
          const WINDOW_DAYS = 30;
          const windowStart = new Date();
          windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1));
          const medLogs = logs.filter(l => l.medicationId === medication.id && new Date(l.timestamp) >= windowStart);
          const totalMg = medLogs.reduce((s, l) => s + convertToBaseWeight(l.dosageTaken || 0, l.unit), 0);
          return totalMg / WINDOW_DAYS;
        })()
      : doseMg * perDay * cycleAvg;

    if (dailyUsageMg <= 0) return Infinity;
    return Math.floor(totalInventoryMg / dailyUsageMg);
  }

  // Legacy single-inventory path
  const inventoryUnits = Number(medication.pillsRemaining) || 0;
  if (inventoryUnits <= 0) return 0;

  // If we can infer per-unit strength from a single pill config, use mg-based math
  if (Array.isArray(medication.pillConfigurations) && medication.pillConfigurations.length === 1) {
    const cfg = medication.pillConfigurations[0];
    const perUnitMg = convertToBaseWeight(cfg.strength, cfg.unit);

    // Determine dose mg per dose
    let doseMg = convertToBaseWeight(Number.parseFloat(medication.dosage) || 0, medication.unit);
    if (medication.tapering?.isActive) {
      doseMg = calculateTaperingDose({ ...medication.tapering, initialDose: doseMg, finalDose: Math.min(doseMg, medication.tapering.finalDose ?? 0) }, new Date(), medication);
    }

    const perDay = frequencyPerDayMap[medication.frequency] ?? 1;
    const cycleAvg = medication.cyclicDosing?.isActive ? getCycleAverageMultiplier(medication.cyclicDosing) : 1;
    const dailyUnits = perUnitMg > 0 ? (doseMg / perUnitMg) * perDay * cycleAvg : perDay * cycleAvg;
    if (dailyUnits <= 0) return Infinity;
    return Math.floor(inventoryUnits / dailyUnits);
  }

  // Final fallback: use logs-per-day against counted units
  const dailyUsage = calculateDailyUsageRate(medication, logs); // doses/day
  if (dailyUsage === 0) return Infinity;
  return Math.floor(inventoryUnits / dailyUsage);
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
