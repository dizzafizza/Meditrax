import { Medication, DependencePrevention, UsagePattern, ToleranceIndicator, DependenceAlert, DependenceIntervention } from '@/types';
import { generateIntelligentTaperingRecommendation } from '@/services/medicationDatabase';
import { generateId } from '@/utils/helpers';

/**
 * Comprehensive Dependence Prevention Service
 * Based on medical research and evidence-based practices
 */
export class DependencePreventionService {
  
  /**
   * Cooldown windows to prevent alert spam
   */
  private static readonly URGENT_ALERT_COOLDOWN_DAYS = 7; // only one urgent alert per week
  private static readonly PATTERN_ALERT_COOLDOWN_DAYS = 3; // pattern alerts at most every 3 days
  
  /**
   * Risk assessment timelines based on medication class and medical literature
   */
  private static readonly RISK_TIMELINES = {
    // Benzodiazepines: Physical dependence can develop in 2-4 weeks
    'benzodiazepine': {
      maxSafeDuration: 14, // days
      warningDuration: 21,
      urgentDuration: 30,
      reviewFrequency: 7
    },
    // Opioids: Physical dependence can develop within days to weeks
    'opioid': {
      maxSafeDuration: 7,
      warningDuration: 14,
      urgentDuration: 21,
      reviewFrequency: 3
    },
    // Z-drugs (sleep aids): Dependence risk similar to benzodiazepines
    'sleep-aid': {
      maxSafeDuration: 14,
      warningDuration: 28,
      urgentDuration: 42,
      reviewFrequency: 7
    },
    // Antidepressants: Withdrawal syndrome, not true dependence
    'antidepressant': {
      maxSafeDuration: 180, // 6 months minimum treatment
      warningDuration: 365,
      urgentDuration: 730,
      reviewFrequency: 30
    },
    // Stimulants: Psychological dependence risk
    'stimulant': {
      maxSafeDuration: 30,
      warningDuration: 90,
      urgentDuration: 180,
      reviewFrequency: 14
    },
    // Default for other medications
    'low-risk': {
      maxSafeDuration: 90,
      warningDuration: 180,
      urgentDuration: 365,
      reviewFrequency: 30
    }
  };

  /**
   * Initialize dependence prevention for a medication
   */
  static initializePrevention(medication: Medication): DependencePrevention {
    const riskCategory = medication.dependencyRiskCategory;
    const timeline = this.RISK_TIMELINES[riskCategory] || this.RISK_TIMELINES['low-risk'];
    
    return {
      medicationId: medication.id,
      isEnabled: true,
      riskLevel: this.calculateInitialRiskLevel(medication),
      dependenceType: this.getDependenceType(riskCategory),
      usagePatterns: [],
      toleranceIndicators: [],
      withdrawalHistory: [],
      recommendedMaxDuration: timeline.maxSafeDuration,
      currentDuration: 0,
      taperingRecommended: false,
      taperingUrgency: 'none',
      alerts: [],
      interventions: [],
      educationalResources: this.getEducationalResources(riskCategory),
      doctorReviewRequired: false,
      reviewFrequency: timeline.reviewFrequency
    };
  }

  /**
   * Assess current dependence risk based on usage patterns
   */
  static assessCurrentRisk(medication: Medication, usagePatterns: UsagePattern[]): DependencePrevention {
    const prevention = medication.dependencePrevention || this.initializePrevention(medication);
    const currentDuration = this.calculateCurrentDuration(medication.startDate);
    const riskCategory = medication.dependencyRiskCategory;
    const timeline = this.RISK_TIMELINES[riskCategory] || this.RISK_TIMELINES['low-risk'];

    // Update current duration
    prevention.currentDuration = currentDuration;

    // Assess risk level based on multiple factors
    prevention.riskLevel = this.calculateRiskLevel(medication, usagePatterns, currentDuration);

    // Check if tapering is recommended
    const taperingAssessment = this.assessTaperingNeed(medication, usagePatterns, currentDuration);
    prevention.taperingRecommended = taperingAssessment.recommended;
    prevention.taperingUrgency = taperingAssessment.urgency;

    // Generate alerts based on risk factors and merge with anti-spam safeguards
    const newAlerts = this.generateRiskAlerts(medication, usagePatterns, currentDuration);
    prevention.alerts = this.mergeAlerts(prevention.alerts, newAlerts);

    // Check if doctor review is needed
    prevention.doctorReviewRequired = this.shouldReviewWithDoctor(medication, usagePatterns, currentDuration);

    return prevention;
  }

  /**
   * Calculate initial risk level based on medication properties
   */
  private static calculateInitialRiskLevel(medication: Medication): 'low' | 'moderate' | 'high' | 'very-high' {
    const category = medication.dependencyRiskCategory;
    
    // Base risk by category
    const baseRisk = {
      'opioid': 'very-high',
      'benzodiazepine': 'high',
      'stimulant': 'high',
      'sleep-aid': 'moderate',
      'muscle-relaxant': 'moderate',
      'antidepressant': 'low',
      'anticonvulsant': 'low',
      'antipsychotic': 'low',
      'low-risk': 'low'
    } as const;

    return baseRisk[category] || 'low';
  }

  /**
   * Determine dependence type based on medication category
   */
  private static getDependenceType(category: string): 'physical' | 'psychological' | 'both' | 'none' {
    switch (category) {
      case 'opioid':
      case 'benzodiazepine':
      case 'sleep-aid':
        return 'both';
      case 'stimulant':
        return 'psychological';
      case 'antidepressant':
      case 'anticonvulsant':
        return 'physical'; // Withdrawal syndrome, not true dependence
      default:
        return 'none';
    }
  }

  /**
   * Calculate current medication duration in days
   */
  private static calculateCurrentDuration(startDate: Date): number {
    const now = new Date();
    const start = new Date(startDate);
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate dynamic risk level based on usage patterns
   */
  private static calculateRiskLevel(
    medication: Medication, 
    usagePatterns: UsagePattern[], 
    currentDuration: number
  ): 'low' | 'moderate' | 'high' | 'very-high' {
    let riskScore = 0;
    const category = medication.dependencyRiskCategory;
    const timeline = this.RISK_TIMELINES[category] || this.RISK_TIMELINES['low-risk'];

    // Duration-based risk
    if (currentDuration > timeline.urgentDuration) riskScore += 40;
    else if (currentDuration > timeline.warningDuration) riskScore += 25;
    else if (currentDuration > timeline.maxSafeDuration) riskScore += 15;

    // Usage pattern analysis
    if (usagePatterns.length > 0) {
      const recentPatterns = usagePatterns.slice(-14); // Last 14 entries
      
      // Dose escalation
      const doseEscalation = this.detectDoseEscalation(recentPatterns);
      if (doseEscalation.isEscalating) riskScore += 20;
      
      // Self-adjustment frequency
      const selfAdjustments = recentPatterns.filter(p => p.selfAdjustment).length;
      const adjustmentRate = selfAdjustments / recentPatterns.length;
      if (adjustmentRate > 0.3) riskScore += 15;
      
      // Craving indicators
      const avgCraving = recentPatterns
        .filter(p => p.cravingLevel !== undefined)
        .reduce((sum, p) => sum + (p.cravingLevel || 0), 0) / recentPatterns.length;
      if (avgCraving > 7) riskScore += 25;
      else if (avgCraving > 5) riskScore += 15;
      
      // Anxiety before dose
      const avgAnxiety = recentPatterns
        .filter(p => p.anxietyBeforeDose !== undefined)
        .reduce((sum, p) => sum + (p.anxietyBeforeDose || 0), 0) / recentPatterns.length;
      if (avgAnxiety > 7) riskScore += 20;
      else if (avgAnxiety > 5) riskScore += 10;

      // Decreasing effectiveness
      const effectivenessDecline = this.detectEffectivenessDecline(recentPatterns);
      if (effectivenessDecline.isDeclineDetected) riskScore += 15;
    }

    // Convert score to risk level
    if (riskScore >= 60) return 'very-high';
    if (riskScore >= 40) return 'high';
    if (riskScore >= 20) return 'moderate';
    return 'low';
  }

  /**
   * Detect dose escalation patterns
   */
  private static detectDoseEscalation(patterns: UsagePattern[]): { isEscalating: boolean; rate: number } {
    if (patterns.length < 5) return { isEscalating: false, rate: 0 };

    const doses = patterns.map(p => p.doseTaken);
    const firstHalf = doses.slice(0, Math.floor(doses.length / 2));
    const secondHalf = doses.slice(Math.floor(doses.length / 2));

    const avgFirst = firstHalf.reduce((sum, dose) => sum + dose, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, dose) => sum + dose, 0) / secondHalf.length;

    const escalationRate = (avgSecond - avgFirst) / avgFirst;
    
    return {
      isEscalating: escalationRate > 0.1, // 10% increase
      rate: escalationRate
    };
  }

  /**
   * Detect effectiveness decline
   */
  private static detectEffectivenessDecline(patterns: UsagePattern[]): { isDeclineDetected: boolean; rate: number } {
    const effectivenessRatings = patterns
      .filter(p => p.effectivenessRating !== undefined)
      .map(p => p.effectivenessRating!);

    if (effectivenessRatings.length < 5) return { isDeclineDetected: false, rate: 0 };

    const firstHalf = effectivenessRatings.slice(0, Math.floor(effectivenessRatings.length / 2));
    const secondHalf = effectivenessRatings.slice(Math.floor(effectivenessRatings.length / 2));

    const avgFirst = firstHalf.reduce((sum, rating) => sum + rating, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, rating) => sum + rating, 0) / secondHalf.length;

    const declineRate = (avgFirst - avgSecond) / avgFirst;
    
    return {
      isDeclineDetected: declineRate > 0.15, // 15% decline
      rate: declineRate
    };
  }

  /**
   * Assess if tapering is needed
   */
  private static assessTaperingNeed(
    medication: Medication, 
    usagePatterns: UsagePattern[], 
    currentDuration: number
  ): { recommended: boolean; urgency: 'none' | 'consider' | 'recommended' | 'urgent' } {
    const category = medication.dependencyRiskCategory;
    const timeline = this.RISK_TIMELINES[category] || this.RISK_TIMELINES['low-risk'];

    // For antidepressants, don't recommend tapering until minimum treatment duration
    if (category === 'antidepressant' && currentDuration < 180) {
      return { recommended: false, urgency: 'none' };
    }

    // Duration-based recommendations
    if (currentDuration > timeline.urgentDuration) {
      return { recommended: true, urgency: 'urgent' };
    } else if (currentDuration > timeline.warningDuration) {
      return { recommended: true, urgency: 'recommended' };
    } else if (currentDuration > timeline.maxSafeDuration) {
      return { recommended: true, urgency: 'consider' };
    }

    // Pattern-based recommendations
    if (usagePatterns.length > 0) {
      const recentPatterns = usagePatterns.slice(-7);
      const doseEscalation = this.detectDoseEscalation(recentPatterns);
      
      if (doseEscalation.isEscalating && doseEscalation.rate > 0.25) {
        return { recommended: true, urgency: 'recommended' };
      }
    }

    return { recommended: false, urgency: 'none' };
  }

  /**
   * Generate risk alerts based on current assessment
   */
  private static generateRiskAlerts(
    medication: Medication, 
    usagePatterns: UsagePattern[], 
    currentDuration: number
  ): DependenceAlert[] {
    const alerts: DependenceAlert[] = [];
    const category = medication.dependencyRiskCategory;
    const timeline = this.RISK_TIMELINES[category] || this.RISK_TIMELINES['low-risk'];
    const now = new Date();

    // Duration-based alerts
    if (currentDuration === timeline.maxSafeDuration) {
      alerts.push({
        id: generateId(),
        type: 'early-warning',
        priority: 'medium',
        message: `You've been taking ${medication.name} for ${currentDuration} days. Consider discussing with your doctor about treatment goals.`,
        trigger: 'duration-milestone',
        timestamp: now,
        acknowledged: false
      });
    }

    if (currentDuration === timeline.warningDuration) {
      alerts.push({
        id: generateId(),
        type: 'intervention-needed',
        priority: 'high',
        message: `${medication.name} has been taken for ${currentDuration} days. Review with your healthcare provider is recommended.`,
        trigger: 'extended-duration',
        timestamp: now,
        acknowledged: false
      });
    }

    if (currentDuration >= timeline.urgentDuration) {
      alerts.push({
        id: generateId(),
        type: 'urgent-medical',
        priority: 'critical',
        message: `Long-term use of ${medication.name} (${currentDuration} days). Urgent medical review and tapering plan needed.`,
        trigger: 'long-term-use',
        timestamp: now,
        acknowledged: false
      });
    }

    // Pattern-based alerts
    if (usagePatterns.length > 0) {
      const recentPatterns = usagePatterns.slice(-7);
      const doseEscalation = this.detectDoseEscalation(recentPatterns);
      
      if (doseEscalation.isEscalating) {
        alerts.push({
          id: generateId(),
          type: 'intervention-needed',
          priority: 'high',
          message: `Dose escalation pattern detected for ${medication.name}. This may indicate developing tolerance.`,
          trigger: 'dose-escalation',
          timestamp: now,
          acknowledged: false
        });
      }

      // High craving levels
      const recentCravings = recentPatterns
        .filter(p => p.cravingLevel !== undefined && p.cravingLevel! > 7);
      
      if (recentCravings.length >= 3) {
        alerts.push({
          id: generateId(),
          type: 'intervention-needed',
          priority: 'high',
          message: `High craving levels reported for ${medication.name}. Consider discussing dependence prevention with your doctor.`,
          trigger: 'high-cravings',
          timestamp: now,
          acknowledged: false
        });
      }
    }

    return alerts;
  }

  /**
   * Merge new alerts with existing ones while preventing duplicates and throttling
   */
  private static mergeAlerts(
    existingAlerts: DependenceAlert[],
    incomingAlerts: DependenceAlert[]
  ): DependenceAlert[] {
    // Start with existing alerts and collapse any prior duplicates by keeping the most recent
    const initial: DependenceAlert[] = [...(existingAlerts || [])];
    const byKey = new Map<string, DependenceAlert>();
    for (const a of initial) {
      const key = `${a.type}|${a.trigger}|${a.message}`;
      const current = byKey.get(key);
      if (!current || new Date(a.timestamp).getTime() > new Date(current.timestamp).getTime()) {
        byKey.set(key, a);
      }
    }
    const merged: DependenceAlert[] = Array.from(byKey.values());
    const now = new Date();

    const msInDay = 24 * 60 * 60 * 1000;
    const withinDays = (a: Date, b: Date, days: number) =>
      Math.abs(new Date(a).getTime() - new Date(b).getTime()) < days * msInDay;

    for (const alert of incomingAlerts) {
      const sameTypeAndTrigger = merged.filter(
        (a) => a.type === alert.type && a.trigger === alert.trigger
      );

      // 1) Exact same message already exists -> skip
      const sameMessage = sameTypeAndTrigger.find((a) => a.message === alert.message);
      if (sameMessage) {
        continue;
      }

      // 2) Urgent alerts: allow only one per cooldown window; replace older to keep latest
      if (alert.type === 'urgent-medical') {
        const lastUrgent = sameTypeAndTrigger.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];

        if (lastUrgent && !lastUrgent.acknowledged && withinDays(lastUrgent.timestamp, alert.timestamp, this.URGENT_ALERT_COOLDOWN_DAYS)) {
          // Still within cooldown and not acknowledged; do not add a new one
          continue;
        }

        // Remove previous urgents of same trigger to avoid stacking
        for (let i = merged.length - 1; i >= 0; i--) {
          const a = merged[i];
          if (a.type === 'urgent-medical' && a.trigger === alert.trigger) {
            merged.splice(i, 1);
          }
        }

        merged.push(alert);
        continue;
      }

      // 3) Pattern alerts: throttle to once every PATTERN_ALERT_COOLDOWN_DAYS if an unacknowledged one exists
      if (['dose-escalation', 'high-cravings'].includes(alert.trigger)) {
        const recentUnacked = sameTypeAndTrigger.find(
          (a) => !a.acknowledged && withinDays(a.timestamp, alert.timestamp, this.PATTERN_ALERT_COOLDOWN_DAYS)
        );
        if (recentUnacked) {
          continue;
        }
      }

      // 4) Duration milestone alerts: allow only one per milestone (type+trigger)
      if (['duration-milestone', 'extended-duration'].includes(alert.trigger)) {
        const already = sameTypeAndTrigger.find((a) => a.type === alert.type && a.trigger === alert.trigger);
        if (already) {
          continue;
        }
      }

      merged.push(alert);
    }

    // Sort newest first and cap to last 50 alerts to prevent unbounded growth
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return merged.slice(0, 50);
  }

  /**
   * Determine if doctor review is needed
   */
  private static shouldReviewWithDoctor(
    medication: Medication, 
    usagePatterns: UsagePattern[], 
    currentDuration: number
  ): boolean {
    const category = medication.dependencyRiskCategory;
    const timeline = this.RISK_TIMELINES[category] || this.RISK_TIMELINES['low-risk'];
    const prevention = medication.dependencePrevention;

    // Regular review schedule
    if (prevention?.lastDoctorReview) {
      const daysSinceReview = Math.floor(
        (new Date().getTime() - new Date(prevention.lastDoctorReview).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceReview >= timeline.reviewFrequency) return true;
    } else {
      // Never reviewed
      if (currentDuration >= timeline.reviewFrequency) return true;
    }

    // Risk-based review
    if (currentDuration > timeline.warningDuration) return true;
    
    // Pattern-based review
    if (usagePatterns.length > 0) {
      const recentPatterns = usagePatterns.slice(-14);
      const doseEscalation = this.detectDoseEscalation(recentPatterns);
      if (doseEscalation.isEscalating && doseEscalation.rate > 0.2) return true;
    }

    return false;
  }

  /**
   * Get educational resources based on medication category
   */
  private static getEducationalResources(category: string): string[] {
    const resources = {
      'benzodiazepine': [
        'Understanding benzodiazepine dependence and withdrawal',
        'Safe tapering strategies for benzodiazepines',
        'Alternative treatments for anxiety and sleep',
        'Cognitive behavioral therapy for anxiety disorders'
      ],
      'opioid': [
        'Understanding opioid dependence and tolerance',
        'Pain management alternatives to opioids',
        'Safe opioid tapering protocols',
        'Naloxone (Narcan) administration and safety'
      ],
      'stimulant': [
        'ADHD medication management and monitoring',
        'Recognizing stimulant abuse and dependence',
        'Behavioral interventions for ADHD',
        'Managing stimulant side effects'
      ],
      'sleep-aid': [
        'Sleep hygiene and non-medication approaches',
        'Understanding sleep medication dependence',
        'Cognitive behavioral therapy for insomnia',
        'Safe discontinuation of sleep medications'
      ],
      'antidepressant': [
        'Understanding antidepressant discontinuation syndrome',
        'Safe tapering of antidepressant medications',
        'Depression relapse prevention strategies',
        'Therapy options for depression and anxiety'
      ]
    };

    return resources[category] || [
      'Safe medication use and monitoring',
      'When to consult your healthcare provider',
      'Understanding medication dependence vs. addiction',
      'Building healthy coping strategies'
    ];
  }

  /**
   * Generate tapering schedule recommendation
   */
  static generateTaperingRecommendation(medication: Medication): {
    recommended: boolean;
    schedule?: {
      totalDuration: number; // weeks
      reductionRate: number; // percentage per step
      steps: Array<{ week: number; dose: number; notes: string }>;
    };
    warnings: string[];
    monitoring: string[];
  } {
    const category = medication.dependencyRiskCategory;
    const currentDose = parseFloat(medication.dosage);

    // Try to use up-to-date database-backed recommendation first
    try {
      const dbRec = generateIntelligentTaperingRecommendation(
        medication.name,
        isNaN(currentDose) ? 0 : currentDose,
        medication.unit,
        medication
      );

      if (dbRec && dbRec.adjustedPlan) {
        // Build steps from adjusted plan
        const totalWeeks = dbRec.adjustedPlan.durationWeeks;
        const reductionPercent = dbRec.adjustedPlan.reductionPercent;
        let dose = isNaN(currentDose) ? 0 : currentDose;
        const steps: Array<{ week: number; dose: number; notes: string }> = [];
        for (let week = 1; week <= totalWeeks; week++) {
          dose = dose * (1 - reductionPercent / 100);
          const rounded = Math.round(dose * 100) / 100;
          steps.push({ week, dose: rounded, notes: `Reduce to ${rounded}${medication.unit}` });
        }

        return {
          recommended: true,
          schedule: {
            totalDuration: totalWeeks,
            reductionRate: reductionPercent,
            steps
          },
          warnings: this.getTaperingWarnings(category),
          monitoring: this.getTaperingMonitoring(category)
        };
      }
    } catch {
      // Fall through to category-based plan
    }

    // Category defaults fallback
    if (category === 'low-risk' || !this.requiresTapering(category)) {
      return {
        recommended: false,
        warnings: ['Tapering may not be necessary for this medication type'],
        monitoring: ['Monitor for any unusual symptoms if discontinuing']
      };
    }

    const schedule = this.generateTaperingSchedule(category, currentDose, medication.unit);
    return {
      recommended: true,
      schedule,
      warnings: this.getTaperingWarnings(category),
      monitoring: this.getTaperingMonitoring(category)
    };
  }

  /**
   * Check if medication requires tapering
   */
  private static requiresTapering(category: string): boolean {
    return ['benzodiazepine', 'opioid', 'sleep-aid', 'antidepressant', 'anticonvulsant'].includes(category);
  }

  /**
   * Generate specific tapering schedule
   */
  private static generateTaperingSchedule(category: string, currentDose: number, unit: string) {
    const schedules = {
      'benzodiazepine': {
        totalDuration: 8, // weeks
        reductionRate: 12.5, // 12.5% per week
        stabilizationWeeks: [2, 4, 6] // weeks to pause reduction
      },
      'opioid': {
        totalDuration: 4,
        reductionRate: 25, // 25% per week
        stabilizationWeeks: [2]
      },
      'sleep-aid': {
        totalDuration: 6,
        reductionRate: 15,
        stabilizationWeeks: [2, 4]
      },
      'antidepressant': {
        totalDuration: 12,
        reductionRate: 8.3, // 8.3% per week
        stabilizationWeeks: [4, 8]
      }
    };

    const config = schedules[category] || schedules['benzodiazepine'];
    const steps = [];
    let dose = currentDose;

    for (let week = 1; week <= config.totalDuration; week++) {
      if (config.stabilizationWeeks.includes(week)) {
        steps.push({
          week,
          dose,
          notes: 'Stabilization week - maintain current dose'
        });
      } else {
        dose = dose * (1 - config.reductionRate / 100);
        steps.push({
          week,
          dose: Math.round(dose * 100) / 100,
          notes: `Reduce to ${Math.round(dose * 100) / 100}${unit}`
        });
      }
    }

    return {
      totalDuration: config.totalDuration,
      reductionRate: config.reductionRate,
      steps
    };
  }

  /**
   * Get tapering warnings by category
   */
  private static getTaperingWarnings(category: string): string[] {
    const warnings = {
      'benzodiazepine': [
        'Never stop abruptly - can cause dangerous withdrawal symptoms',
        'Seizures are a risk with rapid discontinuation',
        'Withdrawal can be life-threatening - medical supervision required'
      ],
      'opioid': [
        'Withdrawal can be very uncomfortable but not life-threatening',
        'Consider medication-assisted treatment options',
        'Monitor for depression and suicidal thoughts'
      ],
      'antidepressant': [
        'Discontinuation syndrome can mimic depression relapse',
        'Brain zaps and dizziness are common withdrawal symptoms',
        'Monitor closely for depression relapse'
      ]
    };

    return warnings[category] || ['Consult healthcare provider before making changes'];
  }

  /**
   * Get tapering monitoring recommendations
   */
  private static getTaperingMonitoring(category: string): string[] {
    const monitoring = {
      'benzodiazepine': [
        'Daily mood and anxiety levels',
        'Sleep quality and patterns',
        'Any seizure activity',
        'Blood pressure and heart rate'
      ],
      'opioid': [
        'Pain levels and management',
        'Mood and mental health',
        'Sleep and appetite',
        'Withdrawal symptom severity'
      ],
      'antidepressant': [
        'Depression and anxiety symptoms',
        'Suicidal thoughts or behaviors',
        'Sleep and energy levels',
        'Social and work functioning'
      ]
    };

    return monitoring[category] || ['General wellbeing and symptom monitoring'];
  }
}
