// Personal Medication Tracking Types

export interface PharmacyInfo {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  typicalRefillTime: number; // in days (for personal planning)
  isPreferred: boolean;
  notes?: string;
  lastUsed?: Date;
  // Delivery options
  deliveryOptions: {
    pickup: { enabled: boolean; avgTime: number; }; // days
    standardDelivery: { enabled: boolean; avgTime: number; cost?: number; }; // days
    expeditedDelivery: { enabled: boolean; avgTime: number; cost?: number; }; // days
    sameDay: { enabled: boolean; avgTime: number; cost?: number; cutoffTime?: string; }; // hours
  };
  deliveryReliability: 'excellent' | 'good' | 'fair' | 'poor'; // affects prediction confidence
}

export interface PersonalMedicationTracking {
  medicationId: string;
  preferredPharmacy?: string;
  backupPharmacy?: string;
  typicalRefillDays: number; // how many days it usually takes to get refill
  lastRefillDate?: Date;
  reminderDaysAdvance: number; // how many days before running out to remind
  minimumDaysSupply: number; // minimum days you want to keep on hand
  refillReminderEnabled: boolean;
  // Delivery preferences
  preferredDeliveryMethod: 'pickup' | 'standardDelivery' | 'expeditedDelivery' | 'sameDay';
  allowBackupDeliveryMethods: boolean; // use other delivery methods if preferred is unavailable
  emergencyDeliveryThreshold: number; // days remaining to trigger emergency delivery options
}

export interface PersonalUsagePattern {
  medicationId: string;
  averageDailyUse: number;
  usageConsistency: 'very-consistent' | 'mostly-consistent' | 'variable' | 'unpredictable';
  recentTrend: 'increasing' | 'decreasing' | 'stable';
  adherenceRate: number; // percentage
  lastAnalyzed: Date;
  typicalMonthlyUse: number;
}

export interface MedicationAlert {
  id: string;
  medicationId: string;
  type: 'running_low' | 'time_to_refill' | 'almost_out' | 'refill_overdue' | 'expired_pills';
  priority: 'info' | 'reminder' | 'important' | 'urgent';
  message: string;
  daysRemaining: number;
  suggestion: string;
  createdAt: Date;
  dismissedAt?: Date;
}

export interface RefillPrediction {
  medicationId: string;
  currentPillCount: number;
  averageDailyUse: number;
  estimatedEmptyDate: Date;
  suggestedRefillDate: Date;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  scenarios: {
    ifUsageIncreases: { emptyDate: Date; refillDate: Date };
    ifUsageDecreases: { emptyDate: Date; refillDate: Date };
  };
}

export interface StockChange {
  id: string;
  medicationId: string;
  type: 'refill' | 'took_dose' | 'manual_count' | 'expired' | 'lost';
  changeAmount: number; // positive for additions, negative for reductions
  previousCount: number;
  newCount: number;
  reason?: string;
  timestamp: Date;
  notes?: string;
}

export interface RefillTracking {
  id: string;
  medicationId: string;
  pharmacy: string;
  orderDate: Date;
  expectedDate: Date;
  actualDate?: Date;
  status: 'requested' | 'processing' | 'ready' | 'picked_up' | 'delivered' | 'delayed';
  pillCount: number;
  notes?: string;
}

export interface PersonalSupplyForecast {
  medicationId: string;
  timeframe: 'week' | 'month' | 'quarter';
  forecastedUse: number;
  basedOn: string; // explanation of what the forecast is based on
  lastUpdated: Date;
}

export interface PersonalStockRecommendation {
  medicationId: string;
  recommendedMinimumPills: number;
  reasonForRecommendation: string;
  currentLevel: 'too_low' | 'adequate' | 'good' | 'more_than_needed';
  suggestions: string[];
  lastCalculated: Date;
}
