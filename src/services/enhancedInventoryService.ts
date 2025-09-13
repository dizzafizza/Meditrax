import { 
  PersonalMedicationTracking,
  PersonalUsagePattern,
  MedicationAlert,
  RefillPrediction,
  RefillTracking,
  PersonalStockRecommendation
} from '@/types/enhanced-inventory';
import { Medication, MedicationLog } from '@/types';

export class PersonalMedicationTracker {
  
  /**
   * Analyzes your personal usage patterns from medication logs
   */
  static analyzePersonalUsage(
    medication: Medication,
    logs: MedicationLog[],
    timeframeDays: number = 30
  ): PersonalUsagePattern {
    const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(log => 
      log.medicationId === medication.id && 
      new Date(log.timestamp) >= cutoffDate &&
      log.adherence === 'taken'
    );

    if (recentLogs.length < 3) {
      // Use scheduled frequency as baseline for new medications
      const scheduledFrequency = this.getScheduledFrequency(medication);
      return {
        medicationId: medication.id,
        averageDailyUse: scheduledFrequency,
        usageConsistency: 'unpredictable',
        recentTrend: 'stable',
        adherenceRate: recentLogs.length > 0 ? 75 : 0, // Conservative estimate
        lastAnalyzed: new Date(),
        typicalMonthlyUse: scheduledFrequency * 30
      };
    }

    // Calculate daily usage
    const dailyUsages = this.calculateDailyUsages(recentLogs, timeframeDays);
    const averageDailyUse = dailyUsages.reduce((sum, val) => sum + val, 0) / dailyUsages.length;
    
    // Calculate consistency 
    const variance = dailyUsages.reduce((sum, val) => sum + Math.pow(val - averageDailyUse, 2), 0) / dailyUsages.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / averageDailyUse;
    
    let usageConsistency: 'very-consistent' | 'mostly-consistent' | 'variable' | 'unpredictable';
    if (coefficientOfVariation < 0.1) usageConsistency = 'very-consistent';
    else if (coefficientOfVariation < 0.25) usageConsistency = 'mostly-consistent';
    else if (coefficientOfVariation < 0.5) usageConsistency = 'variable';
    else usageConsistency = 'unpredictable';

    // Determine trend
    const firstHalf = dailyUsages.slice(0, Math.floor(dailyUsages.length / 2));
    const secondHalf = dailyUsages.slice(Math.floor(dailyUsages.length / 2));
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    let recentTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const trendThreshold = averageDailyUse * 0.15; // 15% threshold
    if (secondAvg > firstAvg + trendThreshold) recentTrend = 'increasing';
    else if (secondAvg < firstAvg - trendThreshold) recentTrend = 'decreasing';

    // Calculate adherence rate
    const totalExpectedDoses = this.calculateExpectedDoses(medication, timeframeDays);
    const adherenceRate = totalExpectedDoses > 0 ? Math.min(100, (recentLogs.length / totalExpectedDoses) * 100) : 100;

    return {
      medicationId: medication.id,
      averageDailyUse,
      usageConsistency,
      recentTrend,
      adherenceRate,
      lastAnalyzed: new Date(),
      typicalMonthlyUse: averageDailyUse * 30
    };
  }

  /**
   * Predicts when you'll need to refill based on your usage
   */
  static predictRefillNeeds(
    medication: Medication,
    currentPillCount: number,
    usagePattern: PersonalUsagePattern,
    tracking: PersonalMedicationTracking
  ): RefillPrediction {
    const baseUsage = usagePattern.averageDailyUse;
    const adherenceAdjustedUsage = baseUsage * (usagePattern.adherenceRate / 100);
    
    // Account for trend
    let adjustedUsage = adherenceAdjustedUsage;
    if (usagePattern.recentTrend === 'increasing') {
      adjustedUsage *= 1.1; // 10% increase
    } else if (usagePattern.recentTrend === 'decreasing') {
      adjustedUsage *= 0.9; // 10% decrease
    }

    // Calculate when you'll run out
    const daysUntilEmpty = currentPillCount / adjustedUsage;
    const estimatedEmptyDate = new Date(Date.now() + daysUntilEmpty * 24 * 60 * 60 * 1000);
    
    // Calculate when you should refill (considering refill time and buffer)
    const bufferDays = tracking.reminderDaysAdvance + tracking.typicalRefillDays;
    const suggestedRefillDate = new Date(estimatedEmptyDate.getTime() - bufferDays * 24 * 60 * 60 * 1000);
    
    // Calculate confidence based on usage consistency
    let confidence: 'high' | 'medium' | 'low';
    if (usagePattern.usageConsistency === 'very-consistent') confidence = 'high';
    else if (usagePattern.usageConsistency === 'mostly-consistent') confidence = 'medium';
    else confidence = 'low';

    // Generate reasoning
    let reasoning = `Based on your ${usagePattern.usageConsistency.replace('-', ' ')} usage`;
    if (usagePattern.recentTrend !== 'stable') {
      reasoning += ` and ${usagePattern.recentTrend} trend`;
    }

    // Generate alternative scenarios
    const optimisticUsage = adjustedUsage * 0.8; // 20% less usage
    const pessimisticUsage = adjustedUsage * 1.2; // 20% more usage
    
    const optimisticEmpty = new Date(Date.now() + (currentPillCount / optimisticUsage) * 24 * 60 * 60 * 1000);
    const pessimisticEmpty = new Date(Date.now() + (currentPillCount / pessimisticUsage) * 24 * 60 * 60 * 1000);
    
    const optimisticRefill = new Date(optimisticEmpty.getTime() - bufferDays * 24 * 60 * 60 * 1000);
    const pessimisticRefill = new Date(pessimisticEmpty.getTime() - bufferDays * 24 * 60 * 60 * 1000);

    return {
      medicationId: medication.id,
      currentPillCount,
      averageDailyUse: adjustedUsage,
      estimatedEmptyDate,
      suggestedRefillDate,
      confidence,
      reasoning,
      scenarios: {
        ifUsageIncreases: { emptyDate: pessimisticEmpty, refillDate: pessimisticRefill },
        ifUsageDecreases: { emptyDate: optimisticEmpty, refillDate: optimisticRefill }
      }
    };
  }

  /**
   * Generates realistic alerts about your medication supply (prevents false positives)
   */
  static generateMedicationAlerts(
    medication: Medication,
    currentPillCount: number,
    prediction: RefillPrediction,
    tracking: PersonalMedicationTracking,
    activeRefills: RefillTracking[]
  ): MedicationAlert[] {
    const alerts: MedicationAlert[] = [];
    const now = new Date();
    const daysUntilEmpty = (prediction.estimatedEmptyDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    
    // Don't generate alerts for medications with unrealistic supply (prevents false positives)
    if (currentPillCount <= 0 || daysUntilEmpty > 365) {
      return alerts; // No alerts for empty inventory or >1 year supply
    }

    // Check for active refills
    const hasActiveRefill = activeRefills.some(refill => 
      refill.medicationId === medication.id && 
      ['requested', 'processing', 'ready'].includes(refill.status)
    );

    // Only alert if there's a meaningful shortage with realistic thresholds
    const urgentThreshold = Math.max(2, tracking.emergencyDeliveryThreshold || 2);
    const lowThreshold = Math.max(tracking.minimumDaysSupply, urgentThreshold + 1);
    const refillThreshold = Math.max(lowThreshold + tracking.reminderDaysAdvance, 7);

    // Almost out (urgent - within emergency threshold)
    if (daysUntilEmpty <= urgentThreshold && currentPillCount < prediction.averageDailyUse * urgentThreshold && !hasActiveRefill) {
      alerts.push({
        id: `almost-out-${medication.id}-${Date.now()}`,
        medicationId: medication.id,
        type: 'almost_out',
        priority: 'urgent',
        message: `You're almost out of ${medication.name}! Only ${Math.ceil(daysUntilEmpty)} days left.`,
        daysRemaining: daysUntilEmpty,
        suggestion: 'Contact your pharmacy immediately or visit urgent care',
        createdAt: now
      });
    }
    
    // Running low (but not urgent)
    else if (daysUntilEmpty <= lowThreshold && daysUntilEmpty > urgentThreshold && !hasActiveRefill) {
      alerts.push({
        id: `running-low-${medication.id}-${Date.now()}`,
        medicationId: medication.id,
        type: 'running_low',
        priority: 'important',
        message: `Running low on ${medication.name} - ${Math.ceil(daysUntilEmpty)} days remaining`,
        daysRemaining: daysUntilEmpty,
        suggestion: 'Time to request a refill',
        createdAt: now
      });
    }
    
    // Time to refill (proactive reminder)
    else if (daysUntilEmpty <= refillThreshold && daysUntilEmpty > lowThreshold && !hasActiveRefill) {
      // Only suggest refill if prediction confidence is reasonable
      if (prediction.confidence !== 'low') {
        alerts.push({
          id: `time-to-refill-${medication.id}-${Date.now()}`,
          medicationId: medication.id,
          type: 'time_to_refill',
          priority: 'reminder',
          message: `Good time to refill ${medication.name}`,
          daysRemaining: daysUntilEmpty,
          suggestion: `Request refill (you have about ${Math.ceil(daysUntilEmpty)} days left)`,
          createdAt: now
        });
      }
    }

    // Check for overdue refills
    const overdueRefills = activeRefills.filter(refill =>
      refill.medicationId === medication.id &&
      refill.expectedDate < now &&
      !refill.actualDate &&
      refill.status !== 'ready'
    );

    if (overdueRefills.length > 0) {
      const oldestOverdue = overdueRefills.sort((a, b) => 
        a.expectedDate.getTime() - b.expectedDate.getTime()
      )[0];
      
      const delayDays = Math.ceil((now.getTime() - oldestOverdue.expectedDate.getTime()) / (24 * 60 * 60 * 1000));
      
      alerts.push({
        id: `overdue-${medication.id}-${Date.now()}`,
        medicationId: medication.id,
        type: 'refill_overdue',
        priority: delayDays > 3 ? 'important' : 'reminder',
        message: `Your ${medication.name} refill is ${delayDays} days overdue`,
        daysRemaining: daysUntilEmpty,
        suggestion: 'Check with your pharmacy about the status',
        createdAt: now
      });
    }

    return alerts;
  }

  /**
   * Provides simple recommendations for your medication supply
   */
  static getPersonalStockRecommendation(
    medication: Medication,
    usagePattern: PersonalUsagePattern,
    tracking: PersonalMedicationTracking,
    currentPillCount: number
  ): PersonalStockRecommendation {
    const dailyUse = usagePattern.averageDailyUse;
    const daysSupply = currentPillCount / dailyUse;
    
    // Calculate recommended minimum based on usage consistency and refill time
    let recommendedMinimumPills = Math.ceil(dailyUse * (tracking.minimumDaysSupply + tracking.typicalRefillDays));
    
    // Adjust based on usage consistency
    if (usagePattern.usageConsistency === 'unpredictable') {
      recommendedMinimumPills *= 1.2; // 20% more for unpredictable usage
    } else if (usagePattern.usageConsistency === 'variable') {
      recommendedMinimumPills *= 1.1; // 10% more for variable usage
    }
    
    // Determine current level
    let currentLevel: 'too_low' | 'adequate' | 'good' | 'more_than_needed';
    if (daysSupply < tracking.minimumDaysSupply) currentLevel = 'too_low';
    else if (daysSupply < recommendedMinimumPills / dailyUse) currentLevel = 'adequate';
    else if (daysSupply < 90) currentLevel = 'good';
    else currentLevel = 'more_than_needed';
    
    // Generate suggestions
    const suggestions: string[] = [];
    if (currentLevel === 'too_low') {
      suggestions.push('Refill as soon as possible');
      suggestions.push('Consider asking for a larger supply next time');
    } else if (currentLevel === 'adequate') {
      suggestions.push('You have enough for now, but plan your next refill');
    } else if (currentLevel === 'good') {
      suggestions.push('Good supply level - you can refill when convenient');
    } else {
      suggestions.push('You have more than needed - no rush to refill');
      suggestions.push('Check expiration dates on older pills');
    }
    
    // Add consistency-based suggestions
    if (usagePattern.usageConsistency === 'unpredictable') {
      suggestions.push('Consider keeping extra supply due to variable usage');
    }
    
    let reasonForRecommendation = `Based on your ${usagePattern.usageConsistency.replace('-', ' ')} usage pattern`;
    if (usagePattern.recentTrend !== 'stable') {
      reasonForRecommendation += ` and ${usagePattern.recentTrend} trend`;
    }

    return {
      medicationId: medication.id,
      recommendedMinimumPills: Math.ceil(recommendedMinimumPills),
      reasonForRecommendation,
      currentLevel,
      suggestions,
      lastCalculated: new Date()
    };
  }

  // Helper methods
  private static calculateDailyUsages(logs: MedicationLog[], days: number): number[] {
    const dailyMap = new Map<string, number>();
    
    logs.forEach(log => {
      const date = new Date(log.timestamp).toDateString();
      dailyMap.set(date, (dailyMap.get(date) || 0) + (log.dosageTaken || 0));
    });
    
    return Array.from(dailyMap.values());
  }

  private static calculateExpectedDoses(medication: Medication, days: number): number {
    // Simple calculation based on frequency
    const timesPerDay = medication.timesPerDay || 1;
    return days * timesPerDay;
  }

  private static getScheduledFrequency(medication: Medication): number {
    // Calculate expected daily pill usage based on medication schedule
    const timesPerDay = medication.timesPerDay || 1;
    
    // For multiple pill medications, calculate based on dose configurations
    if (medication.useMultiplePills && medication.doseConfigurations) {
      const defaultDose = medication.doseConfigurations.find(dose => dose.isDefault) || medication.doseConfigurations[0];
      if (defaultDose) {
        const pillsPerDose = defaultDose.pillComponents.reduce((sum, comp) => sum + comp.quantity, 0);
        return pillsPerDose * timesPerDay;
      }
    }
    
    // For traditional dosage medications
    const dosageAmount = parseFloat(medication.dosage) || 1;
    const unitStrength = 1; // Assume 1 pill per dose for traditional medications
    return (dosageAmount / unitStrength) * timesPerDay;
  }
}
