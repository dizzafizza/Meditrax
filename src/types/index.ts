// Multiple pills support types
export interface PillConfiguration {
  id: string;
  strength: number;          // e.g., 5, 10, 25
  unit: MedicationUnit;      // e.g., 'mg', 'mcg'
  shape?: string;            // e.g., 'round', 'oval'
  color?: string;            // e.g., 'blue', 'white'
  markings?: string;         // e.g., 'A5', 'round scored'
  isActive: boolean;         // for discontinued strengths
}

export interface DoseConfiguration {
  id: string;
  name?: string;             // e.g., "Morning dose", "Standard dose"
  pillComponents: PillDoseComponent[];
  totalDoseAmount: number;   // calculated total
  totalDoseUnit: MedicationUnit;
  instructions?: string;     // e.g., "Take with food"
  isDefault: boolean;        // primary dose configuration
}

export interface PillDoseComponent {
  pillConfigurationId: string;
  quantity: number;          // e.g., 1.5 (for split pills)
  timing?: 'together' | 'split'; // all at once or split throughout day
}

export interface PillInventoryItem {
  pillConfigurationId: string;
  currentCount: number;
  expirationDate?: Date;
  batchNumber?: string;
  lastUpdated: Date;
  // Enhanced inventory fields
  costPerPill?: number;
  supplier?: string;
  lotNumber?: string;
  reorderPoint?: number;
  safetyStock?: number;
}

// Core medication types
export interface Medication {
  id: string;
  name: string;
  dosage: string;              // @deprecated - kept for backward compatibility
  unit: MedicationUnit;        // @deprecated - kept for backward compatibility
  frequency: MedicationFrequency;
  category: MedicationCategory;
  color: string;
  notes?: string;
  sideEffects?: string[];
  interactions?: string[];
  imageUrl?: string;
  isCustom: boolean;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  prescribedBy?: string;
  pharmacy?: string;
  refillReminder?: boolean;
  pillsRemaining?: number;     // @deprecated - use pillInventory instead
  totalPills?: number;         // @deprecated - use pillInventory instead
  
  // Enhanced inventory management
  supplyChainId?: string;      // Reference to MedicationSupplyChain
  consumptionPatternId?: string; // Reference to ConsumptionPattern
  createdAt: Date;
  updatedAt: Date;
  // Advanced features
  riskLevel: RiskLevel;
  dependencyRiskCategory: DependencyRiskCategory;
  cyclicDosing?: CyclicDosingPattern;
  maxDailyDose?: number;
  tapering?: TaperingSchedule;
  psychologicalProfile?: PsychologicalProfile;
  
  // NEW: Multiple pills support
  pillConfigurations?: PillConfiguration[];
  doseConfigurations?: DoseConfiguration[];
  defaultDoseConfigurationId?: string;
  pillInventory?: PillInventoryItem[];
  useMultiplePills?: boolean;  // feature flag for migration
  
  // NEW: Dependence prevention and side effect monitoring
  dependencePrevention?: DependencePrevention;
  sideEffectReports?: SideEffectReport[];
  enhancedMonitoring?: boolean; // enables advanced tracking features
}

export interface PillLogEntry {
  pillConfigurationId: string;
  quantityTaken: number;
  quantityExpected: number;
  timeTaken?: Date;
  notes?: string;
}

export interface AdherenceDetails {
  totalExpectedPills: number;
  totalTakenPills: number;
  partialDose: boolean;
  splitDose?: boolean;
  adherencePercentage: number;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  timestamp: Date;
  dosageTaken: number;           // @deprecated - kept for backward compatibility
  unit: MedicationUnit;          // @deprecated - kept for backward compatibility
  notes?: string;
  sideEffectsReported?: string[];
  mood?: MoodRating;
  adherence: AdherenceStatus;
  createdAt: Date;
  
  // Enhanced logging
  pillLogs?: PillLogEntry[];     // Enhanced pill tracking
  location?: string;             // Where the medication was taken
  skipReason?: string;           // If missed, why?
  effectivenessRating?: number;  // 1-10 scale for PRN medications
  
  // NEW: Multiple pills support
  pillsLogged?: PillLogEntry[];
  doseConfigurationId?: string;
  adherenceDetails?: AdherenceDetails;
  useMultiplePills?: boolean;    // feature flag for this log entry
}

export interface Reminder {
  id: string;
  medicationId: string;
  time: string; // HH:MM format
  days: DayOfWeek[];
  isActive: boolean;
  lastNotified?: Date;
  snoozeUntil?: Date;
  notificationSound?: boolean;
  customMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  name: string;
  dateOfBirth?: Date;
  allergies?: string[];
  conditions?: string[];
  emergencyContact?: EmergencyContact;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    push: boolean;
    sound: boolean;
    vibration: boolean;
    reminderAdvance: number; // minutes before
  };
  privacy: {
    shareData: boolean;
    analytics: boolean;
    anonymousReporting: AnonymousReportingPreferences;
  };
  display: {
    timeFormat: '12h' | '24h';
    dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
    defaultView: 'dashboard' | 'medications' | 'calendar';
  };
}

// Enums and unions
export type MedicationUnit = 
  | 'mg' 
  | 'g' 
  | 'mcg' 
  | 'μg'
  | 'ng'
  | 'ml' 
  | 'L'
  | 'fl oz'
  | 'tsp'
  | 'tbsp'
  | 'tablets' 
  | 'capsules' 
  | 'pills'
  | 'drops' 
  | 'sprays' 
  | 'puffs'
  | 'patches' 
  | 'iu' 
  | 'IU'
  | 'units'
  | 'mEq'
  | 'mmol'
  | 'mg THC'
  | 'mg CBD'
  | 'grams'
  | 'ounces'
  | 'oz'
  | 'lbs'
  | 'kg'
  | 'drinks'
  | 'shots'
  | 'beers'
  | 'glasses'
  | 'hits'
  | 'puffs'
  | 'doses'
  | 'applications'
  | 'injections'
  | 'vials'
  | 'ampules'
  | 'sachets'
  | 'packets'
  | 'scoops'
  | 'cartridges'
  | 'inhalations'
  | 'billion CFU'
  | 'million CFU'
  | '%'
  // Enhanced Cannabis and substance units
  | 'mg THC/CBD'
  | 'g flower'
  | 'g concentrate'
  | 'g edible'
  | 'mg/ml'
  | 'drops (tincture)'
  | 'puffs (vape)'
  | 'bowls'
  | 'joints'
  | 'dabs'
  | 'edibles'
  // Additional medical units
  | 'cc'
  | 'mL/hr'
  | 'mcg/hr'
  | 'mg/hr'
  | 'units/hr'
  | 'metered doses'
  | 'actuations'
  | 'lozenges'
  | 'suppositories'
  | 'pessaries'
  | 'implants'
  | 'rings'
  | 'discs';

export type MedicationCategory = 
  | 'prescription'
  | 'over-the-counter'
  | 'supplement'
  | 'vitamin'
  | 'herbal'
  | 'injection'
  | 'topical'
  | 'emergency'
  | 'recreational';

export type RiskLevel = 'minimal' | 'low' | 'moderate' | 'high';

export type DependencyRiskCategory = 
  | 'opioid'
  | 'benzodiazepine' 
  | 'stimulant'
  | 'sleep-aid'
  | 'muscle-relaxant'
  | 'antidepressant'
  | 'anticonvulsant'
  | 'antipsychotic'
  | 'alcohol'
  | 'dissociative'
  | 'low-risk';

export type MedicationFrequency = 
  | 'as-needed'
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'four-times-daily'
  | 'every-other-day'
  | 'weekly'
  | 'monthly'
  | 'custom';

export type AdherenceStatus = 'taken' | 'missed' | 'skipped' | 'partial';

export type MoodRating = 1 | 2 | 3 | 4 | 5;

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Analytics and reporting types
export interface AdherenceReport {
  medicationId: string;
  medicationName: string;
  totalDoses: number;
  takenDoses: number;
  missedDoses: number;
  adherencePercentage: number;
  period: {
    start: Date;
    end: Date;
  };
}

// SideEffectReport interface moved to enhanced version below

// UI and component types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface TableColumn<T> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'time' | 'checkbox' | 'file';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | undefined;
  };
}

// API and data types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Storage types
export interface StorageData {
  medications: Medication[];
  logs: MedicationLog[];
  reminders: Reminder[];
  userProfile: UserProfile;
  version: string;
  lastSyncDate: Date;
}

// Calendar and scheduling types
export interface CalendarEvent {
  id: string;
  medicationId: string;
  medicationName: string;
  time: string;
  type: 'reminder' | 'taken' | 'missed' | 'refill';
  status: AdherenceStatus | 'upcoming';
  date: Date;
}

export interface ScheduleSlot {
  time: string;
  medications: {
    id: string;
    name: string;
    dosage: string;
    color: string;
    status: AdherenceStatus | 'upcoming';
  }[];
}

// Export and import types
export interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  dateRange: {
    start: Date;
    end: Date;
  };
  includePersonalInfo: boolean;
  includeLogs: boolean;
  includeMedications: boolean;
  includeReports: boolean;
}

export interface ImportData {
  medications?: Partial<Medication>[];
  logs?: Partial<MedicationLog>[];
  reminders?: Partial<Reminder>[];
  profile?: Partial<UserProfile>;
}

// Notification types
export interface NotificationPermission {
  granted: boolean;
  requested: boolean;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  timestamp: Date;
}

// Advanced features - Cyclic Dosing System
export interface CyclicDosingPattern {
  id: string;
  name: string;
  type: 'on-off-cycle' | 'tapering-cycle' | 'variable-dose' | 'holiday-schedule';
  pattern: DosingCycle[];
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  notes?: string;
}

export interface DosingCycle {
  phase: 'on' | 'off' | 'taper-up' | 'taper-down' | 'maintenance';
  duration: number; // in days
  dosageMultiplier: number; // 1.0 = normal dose, 0.5 = half dose, 0 = no dose
  customMessage?: string;
}

export interface TaperingSchedule {
  id: string;
  startDate: Date;
  endDate: Date;
  initialDose: number;
  finalDose: number;
  taperingMethod: 'linear' | 'exponential' | 'hyperbolic' | 'custom';
  customSteps?: TaperingStep[];
  isActive: boolean;
  canPause?: boolean;
  isPaused?: boolean;
  pausedAt?: Date;
  suggestedResumeDays?: number;
  flexibilityNotes?: string;
  intelligentRecommendations?: {
    originalPlan: any;
    adjustedPlan: any;
    adjustmentReasons: string[];
    monthsOnMedication: number;
    riskFactors: {
      longTermUse: boolean;
      highDose: boolean;
      highRiskMedication: boolean;
      benzodiazepine: boolean;
    };
  };
  customizationUsed?: boolean;
  includeStabilizationPeriods?: boolean;
}

export interface TaperingStep {
  day: number;
  dosageMultiplier: number;
  notes?: string;
}

// Psychological Messaging System
export interface PsychologicalProfile {
  adherenceLevel: 'excellent' | 'good' | 'concerning' | 'poor';
  riskFactors: PsychologicalRiskFactor[];
  messagingPreferences: MessagingPreferences;
  behaviorPatterns: BehaviorPattern[];
  interventionHistory: PsychologicalIntervention[];
}

export interface PsychologicalRiskFactor {
  type: 'missed-dose-pattern' | 'early-refill' | 'dose-escalation' | 'timing-irregularity' | 'emotional-dependency';
  severity: 'low' | 'medium' | 'high';
  firstDetected: Date;
  lastOccurrence: Date;
  interventionsTriggered: number;
}

export interface MessagingPreferences {
  motivationalStyle: 'encouraging' | 'factual' | 'gentle' | 'direct';
  frequencyPreference: 'minimal' | 'moderate' | 'frequent';
  enableDependencyWarnings: boolean;
  enableProgressCelebrations: boolean;
  customTriggers: MessageTrigger[];
}

export interface MessageTrigger {
  id: string;
  condition: 'missed-dose' | 'early-dose' | 'perfect-week' | 'risk-behavior' | 'milestone';
  threshold?: number;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  cooldownHours: number;
}

export interface BehaviorPattern {
  type: 'adherence-improvement' | 'adherence-decline' | 'dose-timing-drift' | 'weekend-gaps' | 'stress-related-changes';
  detectedDate: Date;
  confidence: number; // 0-1
  description: string;
  recommendedAction?: string;
}

export interface PsychologicalIntervention {
  id: string;
  medicationId: string;
  type: 'reminder-escalation' | 'dependency-warning' | 'motivation-boost' | 'habit-reinforcement' | 'crisis-intervention';
  trigger: string;
  message: string;
  timestamp: Date;
  userResponse?: 'acknowledged' | 'dismissed' | 'helpful' | 'not-helpful';
  followUpScheduled?: Date;
}

// Enhanced Side Effect Reporting System
export interface SideEffectReport {
  id: string;
  medicationId: string;
  medicationName: string; // Added for compatibility
  sideEffect: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  onset: 'immediate' | 'within-hours' | 'within-days' | 'gradual';
  frequency: 'once' | 'occasional' | 'frequent' | 'constant';
  duration: number; // hours
  interference: 'none' | 'mild' | 'moderate' | 'severe'; // daily life interference
  bodySystem: 'neurological' | 'cardiovascular' | 'gastrointestinal' | 'dermatological' | 'respiratory' | 'psychological' | 'other';
  description: string;
  timestamp: Date;
  resolved: boolean;
  resolvedDate?: Date;
  actionTaken?: 'continued' | 'reduced-dose' | 'stopped' | 'consulted-doctor' | 'added-medication';
  relatedMedications?: string[]; // other meds taken concurrently
  doctorNotified: boolean;
  reportedDates: Date[]; // Added for compatibility
  followUpRequired: boolean;
}

export interface SideEffectPattern {
  medicationId: string;
  commonSideEffects: SideEffectFrequency[];
  rareButSerious: SideEffectFrequency[];
  trends: SideEffectTrend[];
  recommendations: string[];
}

export interface SideEffectFrequency {
  effect: string;
  frequency: number; // percentage
  averageSeverity: number; // 1-4 scale
  averageOnset: number; // days
}

export interface SideEffectTrend {
  effect: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  timeframe: number; // days
  correlation?: string; // dose increase, other factors
}

// Comprehensive Dependence Prevention System
export interface DependencePrevention {
  medicationId: string;
  isEnabled: boolean;
  riskLevel: 'low' | 'moderate' | 'high' | 'very-high';
  dependenceType: 'physical' | 'psychological' | 'both' | 'none';
  
  // Usage monitoring
  usagePatterns: UsagePattern[];
  toleranceIndicators: ToleranceIndicator[];
  withdrawalHistory: WithdrawalEvent[];
  
  // Prevention strategies
  recommendedMaxDuration: number; // days
  currentDuration: number; // days on medication
  taperingRecommended: boolean;
  taperingUrgency: 'none' | 'consider' | 'recommended' | 'urgent';
  
  // Smart alerts
  alerts: DependenceAlert[];
  interventions: DependenceIntervention[];
  educationalResources: string[];
  
  // Medical oversight
  doctorReviewRequired: boolean;
  lastDoctorReview?: Date;
  reviewFrequency: number; // days
}

export interface UsagePattern {
  date: Date;
  doseTaken: number;
  prescribedDose: number;
  selfAdjustment: boolean;
  reasonForAdjustment?: string;
  timesBetweenDoses: number; // hours
  cravingLevel?: number; // 1-10 scale
  anxietyBeforeDose?: number; // 1-10 scale
  effectivenessRating?: number; // 1-10 scale
}

export interface ToleranceIndicator {
  indicator: 'increased-dose' | 'decreased-effect' | 'shorter-duration' | 'withdrawal-symptoms';
  severity: 'mild' | 'moderate' | 'severe';
  firstNoticed: Date;
  progression: 'worsening' | 'stable' | 'improving';
  notes: string;
}

export interface WithdrawalEvent {
  id: string;
  startDate: Date;
  endDate?: Date;
  severity: 'mild' | 'moderate' | 'severe' | 'dangerous';
  symptoms: WithdrawalSymptom[];
  interventions: string[];
  medicalSupervision: boolean;
  successfullyCompleted: boolean;
  relapsePrevention?: string[];
}

export interface WithdrawalSymptom {
  symptom: string;
  severity: number; // 1-10 scale
  duration: number; // hours
  peak: Date; // when symptom was worst
  managementStrategies: string[];
  resolved: boolean;
}

export interface DependenceAlert {
  id: string;
  type: 'early-warning' | 'intervention-needed' | 'urgent-medical' | 'tapering-due';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  trigger: string; // what caused the alert
  timestamp: Date;
  acknowledged: boolean;
  actionTaken?: string;
  followUp?: Date;
}

export interface DependenceIntervention {
  id: string;
  type: 'education' | 'dose-adjustment' | 'tapering-plan' | 'counseling' | 'medical-review' | 'alternative-treatment';
  description: string;
  timestamp: Date;
  effectiveness?: 'helpful' | 'somewhat-helpful' | 'not-helpful' | 'harmful';
  userFeedback?: string;
  completed: boolean;
  followUpRequired: boolean;
}

// Behavioral Analysis Types
export interface AdherencePattern {
  medicationId: string;
  weeklyAdherence: number[];
  monthlyTrend: 'improving' | 'declining' | 'stable' | 'erratic';
  riskScore: number; // 0-100
  concerningBehaviors: string[];
  positivePatterns: string[];
  
  // Enhanced with dependence monitoring
  dependenceRiskFactors: string[];
  protectiveFactors: string[];
}

export interface DependencyRiskAssessment {
  medicationId: string;
  riskScore: number; // 0-100
  riskFactors: DependencyRiskFactor[];
  lastAssessment: Date;
  recommendedActions: string[];
  escalationRequired: boolean;
}

export interface DependencyRiskFactor {
  factor: 'dose-escalation' | 'early-refills' | 'frequency-increase' | 'emotional-dependency' | 'tolerance-signs';
  weight: number;
  description: string;
  firstDetected: Date;
  currentSeverity: 'low' | 'medium' | 'high';
}

// Smart Messaging System
export interface SmartMessage {
  id: string;
  medicationId?: string;
  type: 'adherence-reminder' | 'dependency-warning' | 'motivation' | 'celebration' | 'risk-alert' | 'progress-update';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  actionButtons?: MessageAction[];
  scheduledTime?: Date;
  expiresAt?: Date;
  personalizedData?: Record<string, any>;
  psychologicalApproach: 'positive-reinforcement' | 'gentle-reminder' | 'factual-warning' | 'empathetic-support';
}

export interface MessageAction {
  label: string;
  action: 'mark-taken' | 'snooze' | 'contact-doctor' | 'view-resources' | 'adjust-schedule';
  style: 'primary' | 'secondary' | 'warning' | 'danger';
}

// Enhanced Psychological Safety Alert interface
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

// Anonymous Reporting Types
export interface AnonymousReportingPreferences {
  enabled: boolean;
  consentGiven: boolean;
  consentDate?: Date;
  dataTypesAllowed: AnonymousDataType[];
  privacyLevel: 'minimal' | 'standard' | 'detailed';
  granularControls: {
    includeAdherence: boolean;
    includeSideEffects: boolean;
    includeMedicationPatterns: boolean;
    includeRiskAssessments: boolean;
    allowTemporalAnalysis: boolean;
    allowDemographicAnalysis: boolean;
  };
  lastUpdated?: Date;
}

export type AnonymousDataType = 'adherence' | 'side_effects' | 'medication_patterns' | 'risk_assessments';

export interface AnonymousDataSubmission {
  userId: string;
  dataType: AnonymousDataType;
  payload: any;
  timestamp: Date;
  privacyValidated?: boolean;
}

export interface PrivacyDashboardData {
  consentStatus: 'granted' | 'revoked' | 'never_granted';
  dataShared: {
    totalSubmissions: number;
    byType: Record<AnonymousDataType, number>;
    lastSubmission?: Date;
  };
  privacyScore: number;
  protections: string[];
  userRights: string[];
}

export interface AnonymousReportingService {
  submitAdherenceData: (data: any) => Promise<boolean>;
  submitSideEffectData: (data: any) => Promise<boolean>;
  submitMedicationPatternData: (data: any) => Promise<boolean>;
  grantConsent: (preferences: AnonymousReportingPreferences) => Promise<boolean>;
  updateConsent: (preferences: Partial<AnonymousReportingPreferences>) => Promise<boolean>;
  revokeConsent: (reason?: string) => Promise<boolean>;
  getConsentStatus: () => Promise<AnonymousReportingPreferences | null>;
  getPrivacyDashboard: () => Promise<PrivacyDashboardData>;
}

export interface PrivacyAuditLog {
  id: string;
  action: string;
  timestamp: Date;
  details: Record<string, any>;
  privacyScore: number;
}

// Re-export enhanced inventory types
export * from './enhanced-inventory';
