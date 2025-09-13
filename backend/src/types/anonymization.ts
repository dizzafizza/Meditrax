// Privacy-focused types for anonymous data reporting

export interface AnonymousDataPoint {
  // Time-based anonymization
  timeWindow: string; // Week/month aggregation, not exact timestamps
  weekday?: number; // 0-6, for temporal patterns
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  
  // Geographic anonymization (if needed)
  regionCode?: string; // Country/state level only, no cities
  timezoneOffset?: number; // For medication timing analysis
  
  // Anonymized user segment
  userSegmentHash: string; // One-way hash, changes periodically
  demographicGroup?: string; // Age range, not exact age
  
  // Data payload
  dataType: 'adherence' | 'side_effect' | 'medication_pattern' | 'risk_assessment';
  metrics: Record<string, number | string>;
  
  // Privacy metadata
  noiseLevel: number; // Amount of differential privacy noise added
  kAnonymityLevel: number; // Minimum group size for this data point
  submissionWindow: string; // When data was submitted (weekly intervals)
}

export interface AdherenceMetrics {
  medicationCategory: string; // General category, not specific medication
  dosageFrequency: string; // Daily pattern
  adherenceRate: number; // Percentage (with noise)
  missedDosePattern?: 'random' | 'weekend' | 'evening' | 'consistent';
  streakLength?: number; // Perfect adherence streak (capped and noised)
}

export interface SideEffectMetrics {
  medicationCategory: string;
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high';
  sideEffectCategory: string; // Grouped, not specific effects
  severityLevel: 'mild' | 'moderate' | 'severe';
  onsetPattern: 'immediate' | 'gradual' | 'delayed';
  resolutionTime?: 'hours' | 'days' | 'weeks' | 'ongoing';
}

export interface MedicationPatternMetrics {
  primaryCategory: string;
  secondaryCategories?: string[];
  polypharmacyLevel: number; // Number of concurrent medications (bucketed)
  complexityScore: number; // Dosing complexity (normalized)
  durationCategory: 'short-term' | 'medium-term' | 'long-term' | 'chronic';
  cyclicPatterns?: boolean;
}

export interface RiskAssessmentMetrics {
  dependencyRiskCategory: string;
  behaviorRiskScore: number; // 0-100, with noise
  interventionTriggers?: string[]; // General categories
  adherenceRiskFactors?: string[];
  positiveOutcomes?: string[];
}

// Anonymization configuration
export interface AnonymizationConfig {
  kAnonymityMinSize: number; // Minimum group size (default: 5)
  differentialPrivacyEpsilon: number; // Privacy budget (default: 1.0)
  aggregationWindow: 'weekly' | 'monthly'; // Time window for aggregation
  geographicGranularity: 'country' | 'region' | 'none';
  demographicGranularity: 'age_decade' | 'age_range' | 'none';
  dataRetentionDays: number; // How long to keep anonymized data
  noiseScale: number; // Amount of random noise to add
}

// Privacy validation result
export interface PrivacyValidationResult {
  isAnonymous: boolean;
  riskScore: number; // 0-100, lower is better
  warnings: string[];
  kAnonymityPassed: boolean;
  differentialPrivacyPassed: boolean;
  dataMinimizationPassed: boolean;
}

// User consent and preferences
export interface AnonymousReportingConsent {
  userId: string; // This gets hashed before storage
  consentGiven: boolean;
  consentDate: Date;
  dataTypesAllowed: string[];
  granularityPreferences: {
    includeAdherence: boolean;
    includeSideEffects: boolean;
    includeMedicationPatterns: boolean;
    includeRiskAssessments: boolean;
    allowTemporalAnalysis: boolean;
    allowDemographicAnalysis: boolean;
  };
  privacyLevel: 'minimal' | 'standard' | 'detailed'; // How much data to share
  canRevoke: boolean;
  revokeDate?: Date;
}

// Aggregated reporting output (what researchers see)
export interface AggregatedReport {
  reportId: string;
  generatedAt: Date;
  timeRange: {
    start: string; // Week/month identifier
    end: string;
  };
  sampleSize: number; // Number of users in aggregate
  confidenceInterval: number;
  
  // Medication adherence insights
  adherencePatterns?: {
    overallRate: number;
    byCategory: Record<string, number>;
    byFrequency: Record<string, number>;
    temporalTrends: Array<{
      period: string;
      rate: number;
      confidence: number;
    }>;
  };
  
  // Side effect trends
  sideEffectPatterns?: {
    prevalenceByCategory: Record<string, number>;
    severityDistribution: Record<string, number>;
    onsetPatterns: Record<string, number>;
  };
  
  // Medication usage patterns
  medicationPatterns?: {
    categoryPopularity: Record<string, number>;
    polypharmacyTrends: Array<{
      level: string;
      percentage: number;
    }>;
    durationTrends: Record<string, number>;
  };
  
  // Risk and safety insights
  riskAssessments?: {
    riskDistribution: Record<string, number>;
    interventionEffectiveness: Record<string, number>;
    warningSignals: string[];
  };
}
