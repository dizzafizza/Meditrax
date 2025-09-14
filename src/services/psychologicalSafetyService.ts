import { 
  Medication, 
  MedicationLog, 
  PsychologicalRiskFactor, 
  BehaviorPattern, 
  PsychologicalIntervention,
  SmartMessage,
  DependencePrevention,
  UsagePattern
} from '@/types';
import { generateId } from '@/utils/helpers';

/**
 * Enhanced Psychological Safety Alert Service
 * Implements comprehensive psychological safety monitoring with 7-day minimum requirement
 * and advanced pattern recognition for proactive intervention
 */
export class PsychologicalSafetyService {
  
  /**
   * Minimum days of medication usage before showing psychological safety alerts
   */
  private static readonly MINIMUM_USAGE_DAYS = 7;

  /**
   * Pattern detection thresholds and configurations
   */
  private static readonly PATTERN_THRESHOLDS = {
    // Behavioral patterns
    doseEscalationPattern: {
      minOccurrences: 3,
      timeWindowDays: 14,
      escalationThreshold: 0.15 // 15% increase
    },
    missedDosePattern: {
      minOccurrences: 3,
      timeWindowDays: 7,
      concerningFrequency: 0.3 // 30% missed doses
    },
    timingDriftPattern: {
      minOccurrences: 5,
      timeWindowDays: 10,
      maxDriftHours: 2
    },
    stressRelatedChanges: {
      minOccurrences: 2,
      timeWindowDays: 5,
      adherenceDropThreshold: 0.2 // 20% drop in adherence
    },
    // Tolerance indicators
    effectivenessDecline: {
      minReports: 4,
      timeWindowDays: 14,
      declineThreshold: 2 // 2-point drop on 1-10 scale
    },
    cravingIncrease: {
      minReports: 3,
      timeWindowDays: 7,
      cravingThreshold: 7 // 7+ on 1-10 scale
    },
    // Dependency warning signs
    earlyRefillRequests: {
      thresholdDays: 5, // Requesting refill >5 days early
      frequencyThreshold: 2 // More than 2 times
    },
    anxietyBeforeDose: {
      minReports: 3,
      timeWindowDays: 7,
      anxietyThreshold: 6 // 6+ on 1-10 scale
    }
  };

  /**
   * Generate comprehensive psychological safety alerts for a medication
   */
  static generatePsychologicalSafetyAlerts(
    medication: Medication, 
    logs: MedicationLog[], 
    allMedications: Medication[]
  ): {
    alerts: PsychologicalSafetyAlert[];
    riskFactors: PsychologicalRiskFactor[];
    behaviorPatterns: BehaviorPattern[];
    recommendations: string[];
  } {
    // Check if medication meets minimum usage requirement
    const usageDays = this.calculateUsageDays(medication.startDate);
    if (usageDays < this.MINIMUM_USAGE_DAYS) {
      return {
        alerts: [],
        riskFactors: [],
        behaviorPatterns: [],
        recommendations: []
      };
    }

    const medicationLogs = logs.filter(log => log.medicationId === medication.id);
    const recentLogs = this.getRecentLogs(medicationLogs, 30); // Last 30 days
    
    const alerts: PsychologicalSafetyAlert[] = [];
    const riskFactors: PsychologicalRiskFactor[] = [];
    const behaviorPatterns: BehaviorPattern[] = [];
    const recommendations: string[] = [];

    // 1. Detect dose escalation patterns
    const doseEscalation = this.detectDoseEscalationPattern(medication, recentLogs);
    if (doseEscalation.detected) {
      alerts.push(this.createDoseEscalationAlert(medication, doseEscalation));
      riskFactors.push(this.createRiskFactor('dose-escalation', 'high', doseEscalation.firstDetected));
      recommendations.push('Consider discussing current effectiveness with your healthcare provider');
    }

    // 2. Detect tolerance indicators
    const toleranceIndicators = this.detectToleranceIndicators(recentLogs);
    if (toleranceIndicators.effectivenessDecline) {
      alerts.push(this.createToleranceAlert(medication, 'effectiveness-decline'));
      riskFactors.push(this.createRiskFactor('emotional-dependency', 'medium', new Date()));
    }
    if (toleranceIndicators.increasedCravings) {
      alerts.push(this.createToleranceAlert(medication, 'increased-cravings'));
      riskFactors.push(this.createRiskFactor('emotional-dependency', 'high', new Date()));
    }

    // 3. Detect behavioral dependency patterns
    const dependencyPatterns = this.detectDependencyPatterns(medication, recentLogs);
    dependencyPatterns.forEach(pattern => {
      alerts.push(this.createDependencyPatternAlert(medication, pattern));
      behaviorPatterns.push(pattern.behaviorPattern);
    });

    // 4. Detect missed dose anxiety patterns
    const anxietyPattern = this.detectAnxietyBeforeDosePattern(recentLogs);
    if (anxietyPattern.detected) {
      alerts.push(this.createAnxietyAlert(medication, anxietyPattern));
      riskFactors.push(this.createRiskFactor('emotional-dependency', 'high', anxietyPattern.firstDetected));
    }

    // 5. Detect timing irregularities and drift
    const timingPatterns = this.detectTimingPatterns(recentLogs);
    if (timingPatterns.significantDrift) {
      alerts.push(this.createTimingDriftAlert(medication, timingPatterns));
      behaviorPatterns.push(timingPatterns.behaviorPattern);
    }

    // 6. Detect stress-related adherence changes
    const stressPatterns = this.detectStressRelatedChanges(recentLogs);
    if (stressPatterns.detected) {
      alerts.push(this.createStressRelatedAlert(medication, stressPatterns));
      behaviorPatterns.push(stressPatterns.behaviorPattern);
    }

    // 7. Cross-medication interaction concerns
    const interactionConcerns = this.detectCrossMedicationConcerns(medication, allMedications, logs);
    interactionConcerns.forEach(concern => {
      alerts.push(concern);
    });

    // 8. Generate priority-based recommendations
    recommendations.push(...this.generatePersonalizedRecommendations(
      medication, 
      alerts, 
      riskFactors, 
      behaviorPatterns
    ));

    return {
      alerts: alerts.sort((a, b) => this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority)),
      riskFactors,
      behaviorPatterns,
      recommendations
    };
  }

  /**
   * Calculate days since medication started
   */
  private static calculateUsageDays(startDate: Date): number {
    const now = new Date();
    const start = new Date(startDate);
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get recent logs within specified days
   */
  private static getRecentLogs(logs: MedicationLog[], days: number): MedicationLog[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return logs.filter(log => new Date(log.timestamp) >= cutoffDate);
  }

  /**
   * Detect dose escalation patterns
   */
  private static detectDoseEscalationPattern(
    medication: Medication, 
    logs: MedicationLog[]
  ): { detected: boolean; escalationCount: number; averageIncrease: number; firstDetected: Date } {
    const { minOccurrences, timeWindowDays, escalationThreshold } = this.PATTERN_THRESHOLDS.doseEscalationPattern;
    const windowDate = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(log => new Date(log.timestamp) >= windowDate && log.adherence === 'taken');

    if (recentLogs.length < minOccurrences) {
      return { detected: false, escalationCount: 0, averageIncrease: 0, firstDetected: new Date() };
    }

    // Sort logs by timestamp
    recentLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const expectedDose = parseFloat(medication.dosage);
    let escalationCount = 0;
    let totalIncrease = 0;
    let firstEscalationDate = new Date();

    for (let i = 1; i < recentLogs.length; i++) {
      const currentDose = recentLogs[i].dosageTaken || expectedDose;
      const previousDose = recentLogs[i - 1].dosageTaken || expectedDose;
      
      if (currentDose > previousDose * (1 + escalationThreshold)) {
        if (escalationCount === 0) {
          firstEscalationDate = new Date(recentLogs[i].timestamp);
        }
        escalationCount++;
        totalIncrease += (currentDose - previousDose) / previousDose;
      }
    }

    return {
      detected: escalationCount >= minOccurrences,
      escalationCount,
      averageIncrease: escalationCount > 0 ? totalIncrease / escalationCount : 0,
      firstDetected: firstEscalationDate
    };
  }

  /**
   * Detect tolerance indicators
   */
  private static detectToleranceIndicators(logs: MedicationLog[]): {
    effectivenessDecline: boolean;
    increasedCravings: boolean;
  } {
    const { effectivenessDecline, cravingIncrease } = this.PATTERN_THRESHOLDS;
    
    // Check effectiveness decline
    const effectivenessLogs = logs
      .filter(log => log.effectivenessRating !== undefined)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let effectivenessDeclineDetected = false;
    if (effectivenessLogs.length >= effectivenessDecline.minReports) {
      const recentEffectiveness = effectivenessLogs.slice(-effectivenessDecline.minReports);
      const firstRating = recentEffectiveness[0].effectivenessRating!;
      const lastRating = recentEffectiveness[recentEffectiveness.length - 1].effectivenessRating!;
      effectivenessDeclineDetected = (firstRating - lastRating) >= effectivenessDecline.declineThreshold;
    }

    // Check increased cravings
    const cravingLogs = logs
      .filter(log => log.adherenceDetails?.cravingLevel !== undefined)
      .slice(-cravingIncrease.minReports);

    const increasedCravingsDetected = cravingLogs.length >= cravingIncrease.minReports &&
      cravingLogs.every(log => (log.adherenceDetails?.cravingLevel || 0) >= cravingIncrease.cravingThreshold);

    return {
      effectivenessDecline: effectivenessDeclineDetected,
      increasedCravings: increasedCravingsDetected
    };
  }

  /**
   * Detect dependency behavioral patterns
   */
  private static detectDependencyPatterns(
    medication: Medication, 
    logs: MedicationLog[]
  ): Array<{ type: string; severity: 'low' | 'medium' | 'high'; behaviorPattern: BehaviorPattern }> {
    const patterns: Array<{ type: string; severity: 'low' | 'medium' | 'high'; behaviorPattern: BehaviorPattern }> = [];

    // Early refill pattern
    const refillLogs = logs.filter(log => log.notes?.toLowerCase().includes('refill') || log.notes?.toLowerCase().includes('pickup'));
    if (refillLogs.length >= 2) {
      // Check if refills are happening too early
      const { thresholdDays } = this.PATTERN_THRESHOLDS.earlyRefillRequests;
      // This would need integration with inventory tracking for full implementation
      patterns.push({
        type: 'early-refill-pattern',
        severity: 'medium',
        behaviorPattern: {
          type: 'stress-related-changes',
          detectedDate: new Date(),
          confidence: 0.7,
          description: 'Potential early refill requests detected',
          recommendedAction: 'Monitor medication supply and discuss with healthcare provider'
        }
      });
    }

    return patterns;
  }

  /**
   * Detect anxiety before dose patterns
   */
  private static detectAnxietyBeforeDosePattern(logs: MedicationLog[]): {
    detected: boolean;
    averageAnxiety: number;
    firstDetected: Date;
  } {
    const { minReports, anxietyThreshold } = this.PATTERN_THRESHOLDS.anxietyBeforeDose;
    
    const anxietyLogs = logs
      .filter(log => log.adherenceDetails?.anxietyBeforeDose !== undefined)
      .slice(-minReports);

    if (anxietyLogs.length < minReports) {
      return { detected: false, averageAnxiety: 0, firstDetected: new Date() };
    }

    const highAnxietyLogs = anxietyLogs.filter(log => 
      (log.adherenceDetails?.anxietyBeforeDose || 0) >= anxietyThreshold
    );

    const averageAnxiety = anxietyLogs.reduce((sum, log) => 
      sum + (log.adherenceDetails?.anxietyBeforeDose || 0), 0
    ) / anxietyLogs.length;

    return {
      detected: highAnxietyLogs.length >= Math.ceil(minReports * 0.6), // 60% of reports show high anxiety
      averageAnxiety,
      firstDetected: highAnxietyLogs.length > 0 ? new Date(highAnxietyLogs[0].timestamp) : new Date()
    };
  }

  /**
   * Detect timing patterns and drift
   */
  private static detectTimingPatterns(logs: MedicationLog[]): {
    significantDrift: boolean;
    averageDrift: number;
    behaviorPattern: BehaviorPattern;
  } {
    // This would analyze timing patterns in medication logs
    // For now, return a placeholder implementation
    return {
      significantDrift: false,
      averageDrift: 0,
      behaviorPattern: {
        type: 'dose-timing-drift',
        detectedDate: new Date(),
        confidence: 0,
        description: 'No significant timing drift detected'
      }
    };
  }

  /**
   * Detect stress-related adherence changes
   */
  private static detectStressRelatedChanges(logs: MedicationLog[]): {
    detected: boolean;
    behaviorPattern: BehaviorPattern;
  } {
    // Placeholder for stress-related pattern detection
    return {
      detected: false,
      behaviorPattern: {
        type: 'stress-related-changes',
        detectedDate: new Date(),
        confidence: 0,
        description: 'No stress-related changes detected'
      }
    };
  }

  /**
   * Detect cross-medication interaction concerns
   */
  private static detectCrossMedicationConcerns(
    medication: Medication,
    allMedications: Medication[],
    logs: MedicationLog[]
  ): PsychologicalSafetyAlert[] {
    const alerts: PsychologicalSafetyAlert[] = [];
    
    // Check for multiple high-risk medications
    const highRiskMeds = allMedications.filter(med => 
      med.isActive && 
      med.riskLevel === 'high' && 
      this.calculateUsageDays(med.startDate) >= this.MINIMUM_USAGE_DAYS
    );

    if (highRiskMeds.length > 1 && medication.riskLevel === 'high') {
      alerts.push({
        id: generateId(),
        medicationId: medication.id,
        type: 'multi-substance-concern',
        priority: 'high',
        title: 'Multiple High-Risk Medications',
        message: `You're currently taking ${highRiskMeds.length} high-risk medications simultaneously. Extra monitoring and coordination with healthcare providers is recommended.`,
        detectedAt: new Date(),
        psychologicalImpact: 'increased dependency risk',
        recommendedActions: [
          'Schedule comprehensive medication review with healthcare provider',
          'Consider medication interactions and cumulative effects',
          'Implement enhanced monitoring protocols'
        ]
      });
    }

    return alerts;
  }

  /**
   * Generate personalized recommendations
   */
  private static generatePersonalizedRecommendations(
    medication: Medication,
    alerts: PsychologicalSafetyAlert[],
    riskFactors: PsychologicalRiskFactor[],
    behaviorPatterns: BehaviorPattern[]
  ): string[] {
    const recommendations: string[] = [];

    if (alerts.length > 0) {
      recommendations.push('Consider keeping a detailed medication journal to track patterns');
    }

    if (riskFactors.some(rf => rf.severity === 'high')) {
      recommendations.push('Schedule an appointment with your healthcare provider to discuss recent patterns');
    }

    if (behaviorPatterns.length > 0) {
      recommendations.push('Implement structured reminder and tracking systems');
    }

    // Add medication-specific recommendations
    if (medication.riskLevel === 'high') {
      recommendations.push('Consider non-pharmacological alternatives or adjunct therapies');
    }

    // Cyclic dosing specific recommendations
    if (medication.cyclicDosing?.isActive) {
      recommendations.push('Follow your cyclic dosing schedule to maintain effectiveness and reduce tolerance');
      recommendations.push('Track how you feel during different phases to optimize your pattern');
      recommendations.push('Consider adjusting cycle length if experiencing tolerance or withdrawal');
    }

    // Tapering specific recommendations
    if (medication.tapering?.isActive) {
      recommendations.push('Go slow with tapering - your comfort and safety are more important than timeline');
      recommendations.push('Keep a withdrawal symptom diary to track your progress');
      recommendations.push('Have support systems in place during challenging phases');
      recommendations.push('Consider non-pharmacological coping strategies during reduction');
    }

    return recommendations;
  }

  /**
   * Generate cyclic dosing specific alerts
   */
  static generateCyclicDosingAlerts(
    medication: Medication,
    logs: MedicationLog[]
  ): PsychologicalSafetyAlert[] {
    const alerts: PsychologicalSafetyAlert[] = [];
    
    if (!medication.cyclicDosing?.isActive) return alerts;

    const recentLogs = this.getRecentLogs(logs.filter(log => log.medicationId === medication.id), 14);
    
    // Check for pattern violations
    const patternViolations = recentLogs.filter(log => {
      // This would need more complex logic to detect when user took medication on "off" days
      return false; // Placeholder
    });

    if (patternViolations.length > 2) {
      alerts.push({
        id: generateId(),
        medicationId: medication.id,
        type: 'dependency-pattern',
        priority: 'medium',
        title: 'Cyclic Pattern Deviation',
        message: `You've taken ${medication.name} on scheduled break days multiple times recently. This may reduce the effectiveness of your cycling strategy.`,
        detectedAt: new Date(),
        psychologicalImpact: 'reduced cycling effectiveness',
        recommendedActions: [
          'Review your cyclic dosing schedule and adjust if needed',
          'Consider if your current pattern is realistic for your lifestyle',
          'Discuss pattern modifications with your healthcare provider'
        ]
      });
    }

    return alerts;
  }

  /**
   * Generate tapering specific alerts
   */
  static generateTaperingAlerts(
    medication: Medication,
    logs: MedicationLog[]
  ): PsychologicalSafetyAlert[] {
    const alerts: PsychologicalSafetyAlert[] = [];
    
    if (!medication.tapering?.isActive) return alerts;

    const recentLogs = this.getRecentLogs(logs.filter(log => log.medicationId === medication.id), 7);
    
    // Check for dose increases during tapering
    const doseIncreases = recentLogs.filter(log => {
      const expectedDose = medication.tapering ? 
        this.calculateExpectedTaperingDose(medication.tapering, new Date(log.timestamp)) :
        parseFloat(medication.dosage);
      return (log.dosageTaken || 0) > expectedDose * 1.2; // 20% above expected
    });

    if (doseIncreases.length > 0) {
      alerts.push({
        id: generateId(),
        medicationId: medication.id,
        type: 'dose-escalation',
        priority: 'high',
        title: 'Tapering Schedule Deviation',
        message: `You've taken higher doses than your tapering schedule recently. This can make future reductions more difficult and may indicate withdrawal distress.`,
        detectedAt: new Date(),
        psychologicalImpact: 'tapering plan disruption',
        recommendedActions: [
          'Consider pausing your taper if experiencing severe withdrawal',
          'Discuss dose adjustments with your healthcare provider',
          'Implement additional withdrawal comfort measures'
        ]
      });
    }

    return alerts;
  }

  /**
   * Calculate expected tapering dose for a given date
   */
  private static calculateExpectedTaperingDose(tapering: any, date: Date): number {
    // Simplified calculation - would need full tapering calculation logic
    const daysSinceStart = Math.floor((date.getTime() - new Date(tapering.startDate).getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = Math.floor((new Date(tapering.endDate).getTime() - new Date(tapering.startDate).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceStart <= 0) return tapering.initialDose;
    if (daysSinceStart >= totalDays) return tapering.finalDose;
    
    const progress = daysSinceStart / totalDays;
    return tapering.initialDose + (tapering.finalDose - tapering.initialDose) * progress;
  }

  /**
   * Create alert objects
   */
  private static createDoseEscalationAlert(
    medication: Medication, 
    escalation: any
  ): PsychologicalSafetyAlert {
    return {
      id: generateId(),
      medicationId: medication.id,
      type: 'dose-escalation',
      priority: 'high',
      title: 'Dose Escalation Pattern Detected',
      message: `You've increased your ${medication.name} dose ${escalation.escalationCount} times recently. This may indicate developing tolerance.`,
      detectedAt: new Date(),
      psychologicalImpact: 'tolerance development',
      recommendedActions: [
        'Discuss with healthcare provider before further dose increases',
        'Consider alternative treatment approaches',
        'Track effectiveness and side effects carefully'
      ]
    };
  }

  private static createToleranceAlert(
    medication: Medication, 
    type: 'effectiveness-decline' | 'increased-cravings'
  ): PsychologicalSafetyAlert {
    const messages = {
      'effectiveness-decline': 'Your reported effectiveness ratings for this medication have declined recently.',
      'increased-cravings': 'You\'ve reported increased cravings or urges related to this medication.'
    };

    return {
      id: generateId(),
      medicationId: medication.id,
      type: 'tolerance-indicator',
      priority: 'high',
      title: 'Tolerance Indicator Detected',
      message: messages[type],
      detectedAt: new Date(),
      psychologicalImpact: 'potential tolerance development',
      recommendedActions: [
        'Schedule medication review with healthcare provider',
        'Consider dose stabilization or alternative treatments',
        'Implement non-pharmacological coping strategies'
      ]
    };
  }

  private static createDependencyPatternAlert(
    medication: Medication, 
    pattern: any
  ): PsychologicalSafetyAlert {
    return {
      id: generateId(),
      medicationId: medication.id,
      type: 'dependency-pattern',
      priority: 'medium',
      title: 'Dependency Pattern Detected',
      message: pattern.behaviorPattern.description,
      detectedAt: new Date(),
      psychologicalImpact: 'dependency risk',
      recommendedActions: [pattern.behaviorPattern.recommendedAction || 'Monitor usage patterns closely']
    };
  }

  private static createAnxietyAlert(
    medication: Medication, 
    anxiety: any
  ): PsychologicalSafetyAlert {
    return {
      id: generateId(),
      medicationId: medication.id,
      type: 'anxiety-pattern',
      priority: 'medium',
      title: 'Pre-Dose Anxiety Pattern',
      message: `You've reported anxiety before taking ${medication.name} multiple times recently.`,
      detectedAt: new Date(),
      psychologicalImpact: 'psychological dependence',
      recommendedActions: [
        'Practice relaxation techniques before medication times',
        'Discuss anxiety patterns with healthcare provider',
        'Consider psychological support if needed'
      ]
    };
  }

  private static createTimingDriftAlert(
    medication: Medication, 
    timing: any
  ): PsychologicalSafetyAlert {
    return {
      id: generateId(),
      medicationId: medication.id,
      type: 'timing-drift',
      priority: 'low',
      title: 'Medication Timing Drift',
      message: 'Your medication timing has been drifting from the prescribed schedule.',
      detectedAt: new Date(),
      psychologicalImpact: 'adherence concern',
      recommendedActions: [
        'Set consistent reminder times',
        'Use medication timing apps or alarms',
        'Establish routine anchor points for medication times'
      ]
    };
  }

  private static createStressRelatedAlert(
    medication: Medication, 
    stress: any
  ): PsychologicalSafetyAlert {
    return {
      id: generateId(),
      medicationId: medication.id,
      type: 'stress-related',
      priority: 'medium',
      title: 'Stress-Related Adherence Changes',
      message: 'Your medication adherence appears to change during stressful periods.',
      detectedAt: new Date(),
      psychologicalImpact: 'stress-related dependency',
      recommendedActions: [
        'Develop stress management strategies',
        'Consider additional support during stressful periods',
        'Discuss stress-medication relationship with healthcare provider'
      ]
    };
  }

  private static createRiskFactor(
    type: PsychologicalRiskFactor['type'], 
    severity: 'low' | 'medium' | 'high', 
    firstDetected: Date
  ): PsychologicalRiskFactor {
    return {
      type,
      severity,
      firstDetected,
      lastOccurrence: new Date(),
      interventionsTriggered: 0
    };
  }

  private static getPriorityScore(priority: string): number {
    const scores = { urgent: 4, high: 3, medium: 2, low: 1 };
    return scores[priority as keyof typeof scores] || 0;
  }
}

/**
 * Enhanced Psychological Safety Alert interface
 */
export interface PsychologicalSafetyAlert {
  id: string;
  medicationId: string;
  type: 'dose-escalation' | 'tolerance-indicator' | 'dependency-pattern' | 'anxiety-pattern' | 
        'timing-drift' | 'stress-related' | 'multi-substance-concern';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  detectedAt: Date;
  psychologicalImpact: string;
  recommendedActions: string[];
  acknowledged?: boolean;
  userResponse?: 'helpful' | 'not-helpful' | 'dismissed';
}
