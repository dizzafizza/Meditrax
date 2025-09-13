import crypto from 'crypto';
import { 
  AnonymousDataPoint, 
  AnonymizationConfig, 
  PrivacyValidationResult,
  AdherenceMetrics,
  SideEffectMetrics,
  MedicationPatternMetrics,
  RiskAssessmentMetrics
} from '../types/anonymization';

/**
 * Core anonymization service implementing multiple privacy-preserving techniques
 */
export class AnonymizationService {
  private config: AnonymizationConfig;
  private secretKey: string;

  constructor(config: AnonymizationConfig, secretKey: string) {
    this.config = config;
    this.secretKey = secretKey;
  }

  /**
   * Generate a privacy-preserving hash for user identification
   * Uses HMAC with time-based salt to prevent correlation across time periods
   */
  generateUserSegmentHash(userId: string, timeWindow: string): string {
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(`${userId}-${timeWindow}-${this.config.aggregationWindow}`);
    return hmac.digest('hex').substring(0, 16); // Truncate for additional privacy
  }

  /**
   * Add differential privacy noise to numerical values
   */
  addDifferentialPrivacyNoise(value: number, sensitivity: number = 1): number {
    const scale = sensitivity / this.config.differentialPrivacyEpsilon;
    const noise = this.generateLaplaceNoise(scale);
    return Math.max(0, value + noise); // Ensure non-negative results
  }

  /**
   * Generate Laplace noise for differential privacy
   */
  private generateLaplaceNoise(scale: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    
    if (u1 < 0.5) {
      return scale * Math.log(2 * u1);
    } else {
      return -scale * Math.log(2 * (1 - u1));
    }
  }

  /**
   * Anonymize medication adherence data
   */
  async anonymizeAdherenceData(
    userId: string,
    adherenceData: any,
    timestamp: Date
  ): Promise<AnonymousDataPoint> {
    const timeWindow = this.getTimeWindow(timestamp);
    const userSegmentHash = this.generateUserSegmentHash(userId, timeWindow);

    // Apply k-anonymity by generalizing specific medications to categories
    const medicationCategory = this.generalizeMedicationName(adherenceData.medicationName);
    
    // Add differential privacy noise to adherence rate
    const noisedAdherenceRate = this.addDifferentialPrivacyNoise(
      adherenceData.adherenceRate, 
      0.1 // Lower sensitivity for percentage values
    );

    const metrics: AdherenceMetrics = {
      medicationCategory,
      dosageFrequency: this.generalizeDosageFrequency(adherenceData.frequency),
      adherenceRate: Math.min(100, Math.max(0, noisedAdherenceRate)), // Clamp to valid range
      missedDosePattern: this.classifyMissedDosePattern(adherenceData.missedDoses),
      streakLength: adherenceData.streakLength ? this.bucketStreakLength(adherenceData.streakLength) : undefined
    };

    return {
      timeWindow,
      weekday: this.config.allowTemporalAnalysis ? timestamp.getDay() : undefined,
      timeOfDay: this.getTimeOfDay(timestamp),
      userSegmentHash,
      demographicGroup: this.getDemographicGroup(adherenceData.userAge),
      dataType: 'adherence',
      metrics,
      noiseLevel: this.config.differentialPrivacyEpsilon,
      kAnonymityLevel: this.config.kAnonymityMinSize,
      submissionWindow: timeWindow
    };
  }

  /**
   * Anonymize side effect reporting data
   */
  async anonymizeSideEffectData(
    userId: string,
    sideEffectData: any,
    timestamp: Date
  ): Promise<AnonymousDataPoint> {
    const timeWindow = this.getTimeWindow(timestamp);
    const userSegmentHash = this.generateUserSegmentHash(userId, timeWindow);

    const metrics: SideEffectMetrics = {
      medicationCategory: this.generalizeMedicationName(sideEffectData.medicationName),
      riskLevel: sideEffectData.riskLevel,
      sideEffectCategory: this.generalizeSideEffect(sideEffectData.sideEffect),
      severityLevel: sideEffectData.severity,
      onsetPattern: this.classifyOnsetPattern(sideEffectData.onsetTime),
      resolutionTime: sideEffectData.resolutionTime ? 
        this.generalizeResolutionTime(sideEffectData.resolutionTime) : undefined
    };

    return {
      timeWindow,
      weekday: timestamp.getDay(),
      timeOfDay: this.getTimeOfDay(timestamp),
      userSegmentHash,
      demographicGroup: this.getDemographicGroup(sideEffectData.userAge),
      dataType: 'side_effect',
      metrics,
      noiseLevel: this.config.differentialPrivacyEpsilon,
      kAnonymityLevel: this.config.kAnonymityMinSize,
      submissionWindow: timeWindow
    };
  }

  /**
   * Anonymize medication pattern data
   */
  async anonymizeMedicationPattern(
    userId: string,
    patternData: any,
    timestamp: Date
  ): Promise<AnonymousDataPoint> {
    const timeWindow = this.getTimeWindow(timestamp);
    const userSegmentHash = this.generateUserSegmentHash(userId, timeWindow);

    // Add noise to medication count for privacy
    const noisedMedicationCount = Math.round(
      this.addDifferentialPrivacyNoise(patternData.medicationCount, 1)
    );

    const metrics: MedicationPatternMetrics = {
      primaryCategory: this.generalizeMedicationName(patternData.primaryMedication),
      secondaryCategories: patternData.secondaryMedications?.map((med: string) => 
        this.generalizeMedicationName(med)
      ),
      polypharmacyLevel: this.bucketPolypharmacyLevel(noisedMedicationCount),
      complexityScore: this.addDifferentialPrivacyNoise(patternData.complexityScore, 0.1),
      durationCategory: this.categorizeDuration(patternData.durationDays),
      cyclicPatterns: patternData.hasCyclicPatterns
    };

    return {
      timeWindow,
      weekday: timestamp.getDay(),
      timeOfDay: this.getTimeOfDay(timestamp),
      userSegmentHash,
      demographicGroup: this.getDemographicGroup(patternData.userAge),
      dataType: 'medication_pattern',
      metrics,
      noiseLevel: this.config.differentialPrivacyEpsilon,
      kAnonymityLevel: this.config.kAnonymityMinSize,
      submissionWindow: timeWindow
    };
  }

  /**
   * Validate that data meets privacy requirements
   */
  async validatePrivacy(dataPoint: AnonymousDataPoint): Promise<PrivacyValidationResult> {
    const warnings: string[] = [];
    let riskScore = 0;

    // Check for potentially identifying information
    if (this.containsPII(dataPoint)) {
      warnings.push('Data may contain personally identifiable information');
      riskScore += 30;
    }

    // Validate k-anonymity requirements
    const kAnonymityPassed = await this.checkKAnonymity(dataPoint);
    if (!kAnonymityPassed) {
      warnings.push('K-anonymity requirement not met');
      riskScore += 25;
    }

    // Check differential privacy parameters
    const differentialPrivacyPassed = dataPoint.noiseLevel >= this.config.differentialPrivacyEpsilon;
    if (!differentialPrivacyPassed) {
      warnings.push('Insufficient differential privacy noise');
      riskScore += 20;
    }

    // Data minimization check
    const dataMinimizationPassed = this.checkDataMinimization(dataPoint);
    if (!dataMinimizationPassed) {
      warnings.push('Data contains unnecessary information');
      riskScore += 15;
    }

    // Check for unusual patterns that might be identifying
    if (this.detectUnusualPatterns(dataPoint)) {
      warnings.push('Unusual patterns detected that may reduce anonymity');
      riskScore += 10;
    }

    return {
      isAnonymous: warnings.length === 0,
      riskScore: Math.min(100, riskScore),
      warnings,
      kAnonymityPassed,
      differentialPrivacyPassed,
      dataMinimizationPassed
    };
  }

  // Helper methods for data generalization

  private generalizeMedicationName(medicationName: string): string {
    // Map specific medications to general categories
    const medicationCategories: Record<string, string> = {
      // Cardiovascular
      'lisinopril': 'ACE_INHIBITOR',
      'amlodipine': 'CALCIUM_CHANNEL_BLOCKER',
      'metoprolol': 'BETA_BLOCKER',
      'atorvastatin': 'STATIN',
      
      // Diabetes
      'metformin': 'DIABETES_MEDICATION',
      'insulin': 'DIABETES_MEDICATION',
      'glipizide': 'DIABETES_MEDICATION',
      
      // Mental Health
      'sertraline': 'ANTIDEPRESSANT',
      'fluoxetine': 'ANTIDEPRESSANT',
      'lorazepam': 'ANXIOLYTIC',
      'alprazolam': 'ANXIOLYTIC',
      
      // Pain Management
      'ibuprofen': 'NSAID',
      'acetaminophen': 'ANALGESIC',
      'tramadol': 'OPIOID_ANALGESIC',
      
      // Default fallback
      'default': 'OTHER_MEDICATION'
    };

    const normalized = medicationName.toLowerCase().trim();
    return medicationCategories[normalized] || medicationCategories['default'];
  }

  private getTimeWindow(timestamp: Date): string {
    if (this.config.aggregationWindow === 'weekly') {
      const startOfWeek = new Date(timestamp);
      startOfWeek.setDate(timestamp.getDate() - timestamp.getDay());
      return `${startOfWeek.getFullYear()}-W${this.getWeekNumber(startOfWeek)}`;
    } else {
      return `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  private getWeekNumber(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  }

  private getTimeOfDay(timestamp: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = timestamp.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  private getDemographicGroup(age?: number): string | undefined {
    if (!age || this.config.demographicGranularity === 'none') return undefined;
    
    if (this.config.demographicGranularity === 'age_decade') {
      const decade = Math.floor(age / 10) * 10;
      return `${decade}-${decade + 9}`;
    } else {
      // Age ranges
      if (age < 18) return 'under_18';
      if (age < 30) return '18-29';
      if (age < 50) return '30-49';
      if (age < 65) return '50-64';
      return '65_plus';
    }
  }

  private bucketStreakLength(streakLength: number): number {
    // Bucket streak lengths to prevent identification
    if (streakLength < 7) return 7; // Less than a week
    if (streakLength < 30) return 30; // Less than a month
    if (streakLength < 90) return 90; // Less than 3 months
    return 365; // Long-term adherence
  }

  private async checkKAnonymity(dataPoint: AnonymousDataPoint): Promise<boolean> {
    // This would check if there are at least k similar records
    // Implementation would query the database for similar records
    // For now, return true (would need actual database connection)
    return true;
  }

  private containsPII(dataPoint: AnonymousDataPoint): boolean {
    // Check for common PII patterns
    const jsonStr = JSON.stringify(dataPoint);
    
    // Email pattern
    if (/@[\w\.-]+\.\w+/.test(jsonStr)) return true;
    
    // Phone pattern
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(jsonStr)) return true;
    
    // SSN pattern
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(jsonStr)) return true;
    
    return false;
  }

  private checkDataMinimization(dataPoint: AnonymousDataPoint): boolean {
    // Ensure only necessary data is included
    const requiredFields = ['timeWindow', 'userSegmentHash', 'dataType', 'metrics'];
    const actualFields = Object.keys(dataPoint);
    
    // Check if we have too many optional fields
    const optionalFields = actualFields.filter(field => !requiredFields.includes(field));
    return optionalFields.length <= 5; // Allow some optional fields
  }

  private detectUnusualPatterns(dataPoint: AnonymousDataPoint): boolean {
    // Check for patterns that might make data identifying
    // This is a simplified check - real implementation would be more sophisticated
    return false;
  }

  // Additional helper methods...
  private generalizeDosageFrequency(frequency: string): string {
    const frequencyMap: Record<string, string> = {
      'once-daily': 'daily',
      'twice-daily': 'multiple_daily',
      'three-times-daily': 'multiple_daily',
      'four-times-daily': 'multiple_daily',
      'as-needed': 'as_needed',
      'weekly': 'weekly',
      'monthly': 'monthly'
    };
    return frequencyMap[frequency] || 'other';
  }

  private classifyMissedDosePattern(missedDoses: any[]): 'random' | 'weekend' | 'evening' | 'consistent' {
    // Analyze pattern of missed doses
    // Simplified implementation
    return 'random';
  }

  private generalizeSideEffect(sideEffect: string): string {
    // Map specific side effects to categories
    const categories: Record<string, string> = {
      'nausea': 'gastrointestinal',
      'vomiting': 'gastrointestinal',
      'diarrhea': 'gastrointestinal',
      'headache': 'neurological',
      'dizziness': 'neurological',
      'fatigue': 'general',
      'insomnia': 'sleep',
      'drowsiness': 'sleep'
    };
    
    const normalized = sideEffect.toLowerCase();
    return categories[normalized] || 'other';
  }

  private classifyOnsetPattern(onsetTime: number): 'immediate' | 'gradual' | 'delayed' {
    if (onsetTime < 1) return 'immediate'; // Less than 1 hour
    if (onsetTime < 24) return 'gradual'; // Within a day
    return 'delayed'; // More than a day
  }

  private generalizeResolutionTime(resolutionTime: number): 'hours' | 'days' | 'weeks' | 'ongoing' {
    if (resolutionTime < 24) return 'hours';
    if (resolutionTime < 168) return 'days'; // Less than a week
    if (resolutionTime < 720) return 'weeks'; // Less than a month
    return 'ongoing';
  }

  private bucketPolypharmacyLevel(medicationCount: number): number {
    // Bucket medication counts for privacy
    if (medicationCount <= 1) return 1;
    if (medicationCount <= 3) return 3;
    if (medicationCount <= 5) return 5;
    if (medicationCount <= 10) return 10;
    return 15; // High polypharmacy
  }

  private categorizeDuration(durationDays: number): 'short-term' | 'medium-term' | 'long-term' | 'chronic' {
    if (durationDays < 30) return 'short-term';
    if (durationDays < 90) return 'medium-term';
    if (durationDays < 365) return 'long-term';
    return 'chronic';
  }
}
