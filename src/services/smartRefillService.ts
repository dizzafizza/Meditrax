import { 
  PersonalMedicationTracking,
  PersonalUsagePattern,
  MedicationAlert,
  RefillPrediction
} from '@/types/enhanced-inventory';
import { Medication, MedicationLog } from '@/types';
import { PersonalMedicationTracker } from './enhancedInventoryService';

export class PersonalRefillService {
  
  /**
   * Analyzes your medication usage and provides helpful insights
   */
  static analyzePersonalMedicationNeeds(
    medications: Medication[],
    logs: MedicationLog[],
    trackingSettings: PersonalMedicationTracking[]
  ): {
    usagePatterns: PersonalUsagePattern[];
    refillPredictions: RefillPrediction[];
    alerts: MedicationAlert[];
    recommendations: string[];
  } {
    const usagePatterns: PersonalUsagePattern[] = [];
    const refillPredictions: RefillPrediction[] = [];
    const alerts: MedicationAlert[] = [];
    const recommendations: string[] = [];

    for (const medication of medications.filter(med => med.isActive)) {
      // Analyze your usage pattern
      const pattern = PersonalMedicationTracker.analyzePersonalUsage(medication, logs);
      usagePatterns.push(pattern);

      // Get your tracking settings
      const tracking = trackingSettings.find(ts => ts.medicationId === medication.id) || 
        this.createDefaultTracking(medication);

      // Calculate current pill count
      const currentInventoryCount = this.calculateCurrentInventoryCount(medication);

      // Generate refill prediction
      const prediction = PersonalMedicationTracker.predictRefillNeeds(
        medication, currentInventoryCount, pattern, tracking
      );
      refillPredictions.push(prediction);

      // Generate alerts
      const medicationAlerts = PersonalMedicationTracker.generateMedicationAlerts(
        medication, currentInventoryCount, prediction, tracking, []
      );
      alerts.push(...medicationAlerts);

      // Generate recommendations based on your usage
      const medRecommendations = this.generatePersonalRecommendations(
        medication, pattern, prediction, tracking
      );
      recommendations.push(...medRecommendations);
    }

    // Add general recommendations
    recommendations.push(...this.generateGeneralRecommendations(usagePatterns, refillPredictions));

    return { usagePatterns, refillPredictions, alerts, recommendations };
  }

  /**
   * Helps you plan when to refill your medications
   */
  static generatePersonalRefillSchedule(
    medications: Medication[],
    predictions: RefillPrediction[]
  ): {
    urgentRefills: { medication: Medication; refillBy: Date; reason: string }[];
    upcomingRefills: { medication: Medication; suggestedDate: Date; confidence: string }[];
    coordinationOpportunities: { medications: Medication[]; bestDate: Date; reason: string }[];
  } {
    const urgentRefills: { medication: Medication; refillBy: Date; reason: string }[] = [];
    const upcomingRefills: { medication: Medication; suggestedDate: Date; confidence: string }[] = [];
    const coordinationOpportunities: { medications: Medication[]; bestDate: Date; reason: string }[] = [];

    const now = new Date();

    for (const prediction of predictions) {
      const medication = medications.find(med => med.id === prediction.medicationId);
      if (!medication) continue;

      const daysUntilRefill = (prediction.suggestedRefillDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);

      if (daysUntilRefill <= 0) {
        urgentRefills.push({
          medication,
          refillBy: prediction.suggestedRefillDate,
          reason: daysUntilRefill <= -3 ? 'Overdue for refill' : 'Should refill now'
        });
      } else if (daysUntilRefill <= 14) {
        upcomingRefills.push({
          medication,
          suggestedDate: prediction.suggestedRefillDate,
          confidence: prediction.confidence
        });
      }
    }

    // Find coordination opportunities (medications from same pharmacy)
    const pharmacyGroups = this.groupMedicationsByPharmacy(medications);
    for (const [pharmacy, meds] of pharmacyGroups.entries()) {
      if (meds.length > 1) {
        const medsNeedingRefill = meds.filter(med => {
          const pred = predictions.find(p => p.medicationId === med.id);
          return pred && (pred.suggestedRefillDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000) <= 30;
        });

        if (medsNeedingRefill.length > 1) {
          const latestRefillDate = new Date(Math.max(...medsNeedingRefill.map(med => {
            const pred = predictions.find(p => p.medicationId === med.id);
            return pred ? pred.suggestedRefillDate.getTime() : 0;
          })));

          coordinationOpportunities.push({
            medications: medsNeedingRefill,
            bestDate: latestRefillDate,
            reason: 'Coordinate refills to save trips to pharmacy'
          });
        }
      }
    }

    return { urgentRefills, upcomingRefills, coordinationOpportunities };
  }

  /**
   * Predicts when user will need to refill based on usage patterns
   */
  static predictOptimalRefillTiming(
    medication: Medication,
    logs: MedicationLog[],
    currentStock: number,
    userPreferences: {
      preferredDaysOfAdvance: number;
      allowAutoRefill: boolean;
      pharmacyPreference: string;
    }
  ): {
    optimalOrderDate: Date;
    alternatives: { date: Date; pros: string[]; cons: string[] }[];
    riskFactors: string[];
    confidence: number;
  } {
    // Analyze recent consumption
    const recentLogs = logs.filter(log => 
      log.medicationId === medication.id &&
      new Date(log.timestamp).getTime() > Date.now() - (30 * 24 * 60 * 60 * 1000)
    );

    const averageDailyConsumption = this.calculateAverageDailyConsumption(recentLogs);
    const consumptionVariability = this.calculateConsumptionVariability(recentLogs);
    
    // Calculate basic run-out date
    const daysUntilRunOut = currentStock / averageDailyConsumption;
    const baseRunOutDate = new Date(Date.now() + daysUntilRunOut * 24 * 60 * 60 * 1000);
    
    // Account for user preferences
    const optimalOrderDate = new Date(
      baseRunOutDate.getTime() - userPreferences.preferredDaysOfAdvance * 24 * 60 * 60 * 1000
    );

    // Generate alternatives
    const alternatives = [
      {
        date: new Date(optimalOrderDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        pros: ['Extra safety buffer', 'Avoid weekend delays'],
        cons: ['Earlier expense', 'More inventory to manage']
      },
      {
        date: new Date(optimalOrderDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        pros: ['Delayed expense', 'Less inventory'],
        cons: ['Higher stockout risk', 'Less flexibility']
      }
    ];

    // Identify risk factors
    const riskFactors: string[] = [];
    if (consumptionVariability > 0.3) {
      riskFactors.push('High consumption variability detected');
    }
    if (medication.frequency === 'as-needed') {
      riskFactors.push('PRN medication - unpredictable usage');
    }
    if (medication.riskLevel === 'high') {
      riskFactors.push('High-risk medication - stockouts could be serious');
    }

    // Calculate confidence based on data quality and variability
    const confidence = Math.max(30, Math.min(95, 
      100 - (consumptionVariability * 50) - (recentLogs.length < 10 ? 20 : 0)
    ));

    return {
      optimalOrderDate,
      alternatives,
      riskFactors,
      confidence
    };
  }

  // Helper methods
  private static createDefaultTracking(medication: Medication): PersonalMedicationTracking {
    return {
      medicationId: medication.id,
      typicalRefillDays: 2, // 2 days to get refill
      reminderDaysAdvance: 7, // remind 7 days before running out
      minimumDaysSupply: 5, // keep at least 5 days on hand
      refillReminderEnabled: true,
      preferredPharmacy: medication.pharmacy,
      preferredDeliveryMethod: 'pickup',
      allowBackupDeliveryMethods: true,
      emergencyDeliveryThreshold: 2
    };
  }

  private static calculateCurrentInventoryCount(medication: Medication): number {
    if (medication.pillInventory && medication.pillInventory.length > 0) {
      return medication.pillInventory.reduce((total, item) => total + item.currentCount, 0);
    }
    return medication.pillsRemaining || 30; // Default fallback
  }

  private static generatePersonalRecommendations(
    medication: Medication,
    pattern: PersonalUsagePattern,
    prediction: RefillPrediction,
    tracking: PersonalMedicationTracking
  ): string[] {
    const recommendations: string[] = [];

    // Adherence suggestions
    if (pattern.adherenceRate < 80) {
      recommendations.push(
        `Consider setting more reminders for ${medication.name} - you're taking it ${Math.round(pattern.adherenceRate)}% of the time`
      );
    }

    // Usage pattern suggestions
    if (pattern.usageConsistency === 'unpredictable') {
      recommendations.push(
        `Your ${medication.name} usage varies a lot - consider keeping extra supply on hand`
      );
    }

    // Timing recommendations
    const daysUntilRefill = (prediction.suggestedRefillDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysUntilRefill <= 3 && daysUntilRefill >= 0) {
      recommendations.push(
        `Good time to refill ${medication.name} in the next ${Math.ceil(daysUntilRefill)} days`
      );
    }

    // Supply suggestions
    if (tracking.minimumDaysSupply < 7) {
      recommendations.push(
        `Consider keeping at least a week's supply of ${medication.name} to avoid running out`
      );
    }

    return recommendations;
  }

  private static generateGeneralRecommendations(
    patterns: PersonalUsagePattern[],
    predictions: RefillPrediction[]
  ): string[] {
    const recommendations: string[] = [];

    // Overall adherence
    const avgAdherence = patterns.reduce((sum, p) => sum + p.adherenceRate, 0) / patterns.length;
    if (avgAdherence < 85) {
      recommendations.push(
        'Overall medication adherence could be improved - consider using more reminders or a pill organizer'
      );
    }

    // Coordination opportunities
    const refillsThisWeek = predictions.filter(p => {
      const daysUntil = (p.suggestedRefillDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      return daysUntil >= 0 && daysUntil <= 7;
    });

    if (refillsThisWeek.length > 2) {
      recommendations.push(
        `You have ${refillsThisWeek.length} refills due this week - consider getting them all at once`
      );
    }

    return recommendations;
  }

  private static groupMedicationsByPharmacy(
    medications: Medication[]
  ): Map<string, Medication[]> {
    const groups = new Map<string, Medication[]>();

    for (const medication of medications) {
      const pharmacy = medication.pharmacy || 'Unknown';
      if (!groups.has(pharmacy)) {
        groups.set(pharmacy, []);
      }
      groups.get(pharmacy)!.push(medication);
    }

    return groups;
  }

  private static calculateAverageDailyConsumption(logs: MedicationLog[]): number {
    if (logs.length === 0) return 1;

    const takenLogs = logs.filter(log => log.adherence === 'taken');
    const totalConsumption = takenLogs.reduce((sum, log) => sum + (log.dosageTaken || 0), 0);
    const daysCovered = Math.max(1, logs.length / 2); // Rough estimate

    return totalConsumption / daysCovered;
  }

  private static calculateConsumptionVariability(logs: MedicationLog[]): number {
    if (logs.length < 3) return 0;

    const dailyConsumptions = this.getDailyConsumptions(logs);
    const average = dailyConsumptions.reduce((sum, val) => sum + val, 0) / dailyConsumptions.length;
    const variance = dailyConsumptions.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / dailyConsumptions.length;
    
    return Math.sqrt(variance) / average; // Coefficient of variation
  }

  private static getDailyConsumptions(logs: MedicationLog[]): number[] {
    const dailyMap = new Map<string, number>();
    
    logs.filter(log => log.adherence === 'taken').forEach(log => {
      const date = new Date(log.timestamp).toDateString();
      dailyMap.set(date, (dailyMap.get(date) || 0) + (log.dosageTaken || 0));
    });
    
    return Array.from(dailyMap.values());
  }
}
