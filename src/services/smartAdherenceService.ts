import { Medication, MedicationLog, Reminder } from '@/types';
import { generateId } from '@/utils/helpers';

interface AdherencePattern {
  medicationId: string;
  medicationName: string;
  adherencePercentage: number;
  consecutiveMissedDoses: number;
  frequentMissTimeSlots: string[];
  missedDosePattern: 'random' | 'morning' | 'evening' | 'weekend' | 'weekday' | 'daily';
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  predictedMissRisk: number; // Percentage likelihood of missing next dose
  recommendations: AdherenceRecommendation[];
}

interface AdherenceRecommendation {
  type: 'reminder-adjustment' | 'behavioral-intervention' | 'scheduling-change' | 'education' | 'medical-review';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  message: string;
  actionable: boolean;
  details?: string;
}

interface SmartNotification {
  id: string;
  medicationId: string;
  type: 'predictive-reminder' | 'adherence-support' | 'pattern-alert' | 'encouragement';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  scheduledTime: Date;
  triggered: boolean;
  context?: {
    missedCount?: number;
    pattern?: string;
    riskScore?: number;
  };
}

export class SmartAdherenceService {
  
  /**
   * Analyze adherence patterns for all medications
   */
  static analyzeAdherencePatterns(
    medications: Medication[], 
    logs: MedicationLog[], 
    daysToAnalyze: number = 30
  ): AdherencePattern[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);

    return medications
      .filter(med => med.isActive)
      .map(medication => {
        const medicationLogs = logs.filter(log => 
          log.medicationId === medication.id &&
          new Date(log.timestamp) >= cutoffDate
        );

        return this.analyzeMedicationPattern(medication, medicationLogs);
      })
      .filter(pattern => pattern.adherencePercentage < 100 || pattern.riskLevel !== 'low');
  }

  /**
   * Analyze patterns for a specific medication
   */
  private static analyzeMedicationPattern(medication: Medication, logs: MedicationLog[]): AdherencePattern {
    const takenLogs = logs.filter(log => log.adherence === 'taken');
    const missedLogs = logs.filter(log => log.adherence === 'missed');
    
    const adherencePercentage = logs.length > 0 
      ? Math.round((takenLogs.length / logs.length) * 100) 
      : 100;

    // Analyze consecutive missed doses
    const consecutiveMissedDoses = this.calculateConsecutiveMissedDoses(logs);

    // Analyze missed dose timing patterns
    const missedDosePattern = this.detectMissedDosePattern(missedLogs);
    const frequentMissTimeSlots = this.getFrequentMissTimeSlots(missedLogs);

    // Calculate risk level
    const riskLevel = this.calculateAdherenceRiskLevel(
      adherencePercentage, 
      consecutiveMissedDoses, 
      missedLogs.length,
      medication.riskLevel
    );

    // Predict likelihood of missing next dose
    const predictedMissRisk = this.predictMissRisk(logs, medication);

    // Generate personalized recommendations
    const recommendations = this.generateRecommendations(
      adherencePercentage,
      missedDosePattern,
      consecutiveMissedDoses,
      frequentMissTimeSlots,
      medication
    );

    return {
      medicationId: medication.id,
      medicationName: medication.name,
      adherencePercentage,
      consecutiveMissedDoses,
      frequentMissTimeSlots,
      missedDosePattern,
      riskLevel,
      predictedMissRisk,
      recommendations
    };
  }

  /**
   * Calculate consecutive missed doses
   */
  private static calculateConsecutiveMissedDoses(logs: MedicationLog[]): number {
    if (logs.length === 0) return 0;

    const sortedLogs = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    let consecutiveMissed = 0;

    for (const log of sortedLogs) {
      if (log.adherence === 'missed') {
        consecutiveMissed++;
      } else {
        break;
      }
    }

    return consecutiveMissed;
  }

  /**
   * Detect patterns in missed doses
   */
  private static detectMissedDosePattern(missedLogs: MedicationLog[]): AdherencePattern['missedDosePattern'] {
    if (missedLogs.length === 0) return 'random';

    const patterns = {
      morning: 0,
      evening: 0,
      weekend: 0,
      weekday: 0
    };

    missedLogs.forEach(log => {
      const logDate = new Date(log.timestamp);
      const hour = logDate.getHours();
      const dayOfWeek = logDate.getDay();

      // Morning/evening analysis
      if (hour >= 6 && hour < 12) patterns.morning++;
      if (hour >= 18 && hour < 24) patterns.evening++;

      // Weekend/weekday analysis
      if (dayOfWeek === 0 || dayOfWeek === 6) patterns.weekend++;
      else patterns.weekday++;
    });

    const total = missedLogs.length;
    
    // If 70% or more of misses fall into a category, it's a pattern
    if (patterns.morning / total >= 0.7) return 'morning';
    if (patterns.evening / total >= 0.7) return 'evening';
    if (patterns.weekend / total >= 0.7) return 'weekend';
    if (patterns.weekday / total >= 0.7) return 'weekday';
    if (total >= 3) return 'daily'; // High frequency of missing

    return 'random';
  }

  /**
   * Get time slots with frequent misses
   */
  private static getFrequentMissTimeSlots(missedLogs: MedicationLog[]): string[] {
    const timeSlots: Record<string, number> = {};

    missedLogs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      const timeSlot = 
        hour >= 6 && hour < 12 ? 'Morning (6AM-12PM)' :
        hour >= 12 && hour < 18 ? 'Afternoon (12PM-6PM)' :
        hour >= 18 && hour < 24 ? 'Evening (6PM-12AM)' :
        'Night (12AM-6AM)';
      
      timeSlots[timeSlot] = (timeSlots[timeSlot] || 0) + 1;
    });

    // Return time slots with more than 30% of missed doses
    const threshold = Math.max(1, Math.ceil(missedLogs.length * 0.3));
    return Object.entries(timeSlots)
      .filter(([, count]) => count >= threshold)
      .map(([slot]) => slot);
  }

  /**
   * Calculate adherence risk level
   */
  private static calculateAdherenceRiskLevel(
    adherencePercentage: number,
    consecutiveMissed: number,
    totalMissed: number,
    medicationRiskLevel: string
  ): AdherencePattern['riskLevel'] {
    let riskScore = 0;

    // Adherence percentage impact
    if (adherencePercentage < 50) riskScore += 40;
    else if (adherencePercentage < 70) riskScore += 25;
    else if (adherencePercentage < 85) riskScore += 15;

    // Consecutive missed doses impact
    if (consecutiveMissed >= 5) riskScore += 30;
    else if (consecutiveMissed >= 3) riskScore += 20;
    else if (consecutiveMissed >= 2) riskScore += 10;

    // Total missed doses impact
    if (totalMissed >= 10) riskScore += 20;
    else if (totalMissed >= 5) riskScore += 10;

    // Medication risk level multiplier
    if (medicationRiskLevel === 'high') riskScore *= 1.5;
    else if (medicationRiskLevel === 'moderate') riskScore *= 1.2;

    if (riskScore >= 70) return 'critical';
    if (riskScore >= 45) return 'high';
    if (riskScore >= 20) return 'moderate';
    return 'low';
  }

  /**
   * Predict risk of missing next dose
   */
  private static predictMissRisk(logs: MedicationLog[], medication: Medication): number {
    if (logs.length === 0) return 10; // Base risk for new medications

    const recentLogs = logs.slice(-14); // Last 14 logs
    const missedCount = recentLogs.filter(log => log.adherence === 'missed').length;
    const recentAdherence = recentLogs.length > 0 
      ? (recentLogs.length - missedCount) / recentLogs.length 
      : 1;

    // Base risk from recent adherence
    let riskPercentage = (1 - recentAdherence) * 100;

    // Adjust for consecutive missed doses
    const consecutiveMissed = this.calculateConsecutiveMissedDoses(logs);
    if (consecutiveMissed > 0) {
      riskPercentage += consecutiveMissed * 15; // 15% additional risk per consecutive miss
    }

    // Adjust for medication risk level
    if (medication.riskLevel === 'high') riskPercentage *= 1.3;
    else if (medication.riskLevel === 'moderate') riskPercentage *= 1.1;

    // Time since last dose
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      const hoursSinceLastDose = (Date.now() - new Date(lastLog.timestamp).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastDose > 48) riskPercentage += 20; // High risk if no recent logs
      else if (hoursSinceLastDose > 24) riskPercentage += 10;
    }

    return Math.min(95, Math.max(5, Math.round(riskPercentage)));
  }

  /**
   * Generate personalized recommendations
   */
  private static generateRecommendations(
    adherencePercentage: number,
    pattern: AdherencePattern['missedDosePattern'],
    consecutiveMissed: number,
    frequentMissTimeSlots: string[],
    medication: Medication
  ): AdherenceRecommendation[] {
    const recommendations: AdherenceRecommendation[] = [];

    // Critical adherence issues
    if (adherencePercentage < 50) {
      recommendations.push({
        type: 'medical-review',
        priority: 'urgent',
        message: 'Urgent: Schedule immediate appointment with healthcare provider',
        actionable: true,
        details: 'Adherence below 50% significantly reduces medication effectiveness and may pose health risks.'
      });
    }

    // Consecutive missed doses
    if (consecutiveMissed >= 3) {
      recommendations.push({
        type: 'behavioral-intervention',
        priority: 'high',
        message: 'Consider using a pill organizer or medication app with alarms',
        actionable: true,
        details: `You've missed ${consecutiveMissed} consecutive doses. Breaking this pattern is crucial.`
      });
    }

    // Pattern-specific recommendations
    switch (pattern) {
      case 'morning':
        recommendations.push({
          type: 'reminder-adjustment',
          priority: 'medium',
          message: 'Move morning reminders earlier or add an evening dose if approved by doctor',
          actionable: true,
          details: 'Morning doses are frequently missed. Consider adjusting your schedule.'
        });
        break;
      
      case 'evening':
        recommendations.push({
          type: 'reminder-adjustment',
          priority: 'medium',
          message: 'Set multiple evening reminders or take with dinner',
          actionable: true,
          details: 'Evening doses are often forgotten. Link to a consistent evening routine.'
        });
        break;
      
      case 'weekend':
        recommendations.push({
          type: 'scheduling-change',
          priority: 'medium',
          message: 'Set stronger weekend reminders and maintain weekday schedule',
          actionable: true,
          details: 'Weekend routine disruption affects medication adherence.'
        });
        break;
      
      case 'weekday':
        recommendations.push({
          type: 'scheduling-change',
          priority: 'medium',
          message: 'Consider taking medication at home before work or during lunch',
          actionable: true,
          details: 'Weekday schedule may be interfering with medication timing.'
        });
        break;
    }

    // Time-specific recommendations
    if (frequentMissTimeSlots.length > 0) {
      recommendations.push({
        type: 'reminder-adjustment',
        priority: 'medium',
        message: `Add extra reminders during ${frequentMissTimeSlots.join(' and ')}`,
        actionable: true,
        details: 'These time periods show frequent missed doses.'
      });
    }

    // High-risk medication specific
    if (medication.riskLevel === 'high' && adherencePercentage < 90) {
      recommendations.push({
        type: 'education',
        priority: 'high',
        message: 'Review importance of consistent dosing for this high-risk medication',
        actionable: true,
        details: 'This medication requires high adherence to prevent serious complications.'
      });
    }

    // General low adherence
    if (adherencePercentage < 80 && adherencePercentage >= 50) {
      recommendations.push({
        type: 'behavioral-intervention',
        priority: 'medium',
        message: 'Consider habit stacking - link medication to an existing daily routine',
        actionable: true,
        details: 'Connecting medication to established habits improves consistency.'
      });
    }

    return recommendations;
  }

  /**
   * Generate smart notifications based on patterns
   */
  static generateSmartNotifications(
    patterns: AdherencePattern[],
    medications: Medication[],
    reminders: Reminder[]
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const now = new Date();

    patterns.forEach(pattern => {
      const medication = medications.find(med => med.id === pattern.medicationId);
      if (!medication) return;

      // High miss risk prediction
      if (pattern.predictedMissRisk > 70) {
        notifications.push({
          id: generateId(),
          medicationId: pattern.medicationId,
          type: 'predictive-reminder',
          title: 'High Risk of Missing Dose',
          message: `${pattern.medicationName}: ${pattern.predictedMissRisk}% chance of missing next dose. Extra attention needed!`,
          priority: 'high',
          scheduledTime: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes from now
          triggered: false,
          context: {
            riskScore: pattern.predictedMissRisk,
            pattern: pattern.missedDosePattern
          }
        });
      }

      // Consecutive missed doses
      if (pattern.consecutiveMissedDoses >= 2) {
        notifications.push({
          id: generateId(),
          medicationId: pattern.medicationId,
          type: 'adherence-support',
          title: 'Missed Dose Pattern Detected',
          message: `You've missed ${pattern.consecutiveMissedDoses} doses of ${pattern.medicationName} in a row. Let's get back on track!`,
          priority: pattern.consecutiveMissedDoses >= 3 ? 'high' : 'medium',
          scheduledTime: now,
          triggered: false,
          context: {
            missedCount: pattern.consecutiveMissedDoses
          }
        });
      }

      // Pattern alerts
      if (pattern.missedDosePattern !== 'random') {
        notifications.push({
          id: generateId(),
          medicationId: pattern.medicationId,
          type: 'pattern-alert',
          title: 'Medication Pattern Identified',
          message: `You tend to miss ${pattern.medicationName} doses in the ${pattern.missedDosePattern}. Would you like to adjust your reminders?`,
          priority: 'medium',
          scheduledTime: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
          triggered: false,
          context: {
            pattern: pattern.missedDosePattern
          }
        });
      }

      // Encouragement for good adherence
      if (pattern.adherencePercentage >= 90 && pattern.adherencePercentage < 100) {
        notifications.push({
          id: generateId(),
          medicationId: pattern.medicationId,
          type: 'encouragement',
          title: 'Great Adherence!',
          message: `${pattern.adherencePercentage}% adherence for ${pattern.medicationName}. You're doing excellent - keep it up!`,
          priority: 'low',
          scheduledTime: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 hours from now
          triggered: false
        });
      }
    });

    return notifications;
  }

  /**
   * Get adherence insights summary
   */
  static getAdherenceInsights(patterns: AdherencePattern[]): {
    overallRisk: 'low' | 'moderate' | 'high' | 'critical';
    totalMedications: number;
    medicationsAtRisk: number;
    avgAdherence: number;
    topRecommendations: AdherenceRecommendation[];
    urgentActions: number;
  } {
    if (patterns.length === 0) {
      return {
        overallRisk: 'low',
        totalMedications: 0,
        medicationsAtRisk: 0,
        avgAdherence: 100,
        topRecommendations: [],
        urgentActions: 0
      };
    }

    const avgAdherence = Math.round(
      patterns.reduce((sum, p) => sum + p.adherencePercentage, 0) / patterns.length
    );

    const medicationsAtRisk = patterns.filter(p => p.riskLevel !== 'low').length;
    
    const riskCounts = patterns.reduce((acc, p) => {
      acc[p.riskLevel]++;
      return acc;
    }, { low: 0, moderate: 0, high: 0, critical: 0 });

    let overallRisk: 'low' | 'moderate' | 'high' | 'critical' = 'low';
    if (riskCounts.critical > 0) overallRisk = 'critical';
    else if (riskCounts.high > 0) overallRisk = 'high';
    else if (riskCounts.moderate > 0) overallRisk = 'moderate';

    // Collect all recommendations and prioritize
    const allRecommendations = patterns.flatMap(p => p.recommendations);
    const topRecommendations = allRecommendations
      .filter(r => r.priority === 'urgent' || r.priority === 'high')
      .slice(0, 5);

    const urgentActions = allRecommendations.filter(r => r.priority === 'urgent').length;

    return {
      overallRisk,
      totalMedications: patterns.length,
      medicationsAtRisk,
      avgAdherence,
      topRecommendations,
      urgentActions
    };
  }
}
