import mongoose, { Schema, Document } from 'mongoose';
import { AnonymousDataPoint, AnonymousReportingConsent, AggregatedReport } from '../types/anonymization';

// MongoDB schema for anonymous data points
const AnonymousDataSchema = new Schema({
  // Time-based anonymization
  timeWindow: { type: String, required: true, index: true },
  weekday: { type: Number, min: 0, max: 6 },
  timeOfDay: { 
    type: String, 
    enum: ['morning', 'afternoon', 'evening', 'night'] 
  },
  
  // Geographic data (if enabled)
  regionCode: { type: String, maxlength: 10 },
  timezoneOffset: { type: Number, min: -12, max: 14 },
  
  // Anonymized user segment
  userSegmentHash: { type: String, required: true, index: true },
  demographicGroup: { type: String, maxlength: 50 },
  
  // Data payload
  dataType: { 
    type: String, 
    required: true,
    enum: ['adherence', 'side_effect', 'medication_pattern', 'risk_assessment'],
    index: true
  },
  metrics: { type: Map, of: Schema.Types.Mixed, required: true },
  
  // Privacy metadata
  noiseLevel: { type: Number, required: true, min: 0 },
  kAnonymityLevel: { type: Number, required: true, min: 1 },
  submissionWindow: { type: String, required: true, index: true },
  
  // Validation flags
  privacyValidated: { type: Boolean, default: false },
  validationScore: { type: Number, min: 0, max: 100 },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, expires: '2y' }, // Auto-delete after 2 years
  processedAt: { type: Date }
}, {
  // Disable version key for better anonymity
  versionKey: false,
  // Add indexes for common queries
  indexes: [
    { timeWindow: 1, dataType: 1 },
    { userSegmentHash: 1, submissionWindow: 1 },
    { createdAt: 1 }
  ]
});

// User consent tracking (separate collection for GDPR compliance)
const ConsentSchema = new Schema({
  userIdHash: { type: String, required: true, unique: true },
  consentGiven: { type: Boolean, required: true },
  consentDate: { type: Date, required: true },
  dataTypesAllowed: [{ type: String }],
  granularityPreferences: {
    includeAdherence: { type: Boolean, default: false },
    includeSideEffects: { type: Boolean, default: false },
    includeMedicationPatterns: { type: Boolean, default: false },
    includeRiskAssessments: { type: Boolean, default: false },
    allowTemporalAnalysis: { type: Boolean, default: false },
    allowDemographicAnalysis: { type: Boolean, default: false }
  },
  privacyLevel: { 
    type: String, 
    enum: ['minimal', 'standard', 'detailed'],
    default: 'minimal'
  },
  canRevoke: { type: Boolean, default: true },
  revokeDate: { type: Date },
  lastUpdated: { type: Date, default: Date.now },
  
  // Audit trail
  consentVersion: { type: String, default: '1.0' },
  ipHashAtConsent: { type: String }, // Hashed IP for abuse prevention
  userAgentHash: { type: String }   // Hashed for bot detection
}, {
  versionKey: false,
  indexes: [
    { userIdHash: 1 },
    { consentGiven: 1, revokeDate: 1 }
  ]
});

// Aggregated reports (what researchers access)
const AggregatedReportSchema = new Schema({
  reportId: { type: String, required: true, unique: true },
  reportType: { 
    type: String, 
    required: true,
    enum: ['adherence', 'side_effects', 'medication_patterns', 'risk_trends', 'comprehensive']
  },
  timeRange: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  sampleSize: { type: Number, required: true, min: 5 }, // Minimum for k-anonymity
  confidenceInterval: { type: Number, required: true, min: 0, max: 1 },
  
  // Report data (structure varies by type)
  data: { type: Map, of: Schema.Types.Mixed, required: true },
  
  // Quality metrics
  dataQualityScore: { type: Number, min: 0, max: 100 },
  privacyScore: { type: Number, min: 0, max: 100 },
  completenessScore: { type: Number, min: 0, max: 100 },
  
  // Generation metadata
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: String, default: 'automated' },
  algorithmVersion: { type: String, default: '1.0' },
  
  // Access control
  accessLevel: { 
    type: String, 
    enum: ['public', 'research', 'restricted'],
    default: 'research'
  },
  downloadCount: { type: Number, default: 0 },
  lastAccessed: { type: Date }
}, {
  versionKey: false,
  indexes: [
    { reportType: 1, 'timeRange.start': 1 },
    { generatedAt: 1 },
    { accessLevel: 1 }
  ]
});

// Privacy audit log
const PrivacyAuditSchema = new Schema({
  action: { 
    type: String, 
    required: true,
    enum: ['data_submission', 'consent_update', 'data_deletion', 'report_access', 'privacy_violation']
  },
  userIdHash: { type: String }, // Optional, not always user-specific
  timestamp: { type: Date, default: Date.now },
  details: { type: Map, of: Schema.Types.Mixed },
  ipHash: { type: String },
  userAgentHash: { type: String },
  
  // Risk assessment
  riskLevel: { 
    type: String, 
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  flagged: { type: Boolean, default: false },
  reviewRequired: { type: Boolean, default: false }
}, {
  versionKey: false,
  capped: { size: 100000000, max: 1000000 }, // Capped collection for performance
  indexes: [
    { timestamp: 1 },
    { action: 1, timestamp: 1 },
    { flagged: 1, reviewRequired: 1 }
  ]
});

// Create models
export const AnonymousData = mongoose.model<AnonymousDataPoint & Document>('AnonymousData', AnonymousDataSchema);
export const Consent = mongoose.model<AnonymousReportingConsent & Document>('Consent', ConsentSchema);
export const AggregatedReport = mongoose.model<AggregatedReport & Document>('AggregatedReport', AggregatedReportSchema);
export const PrivacyAudit = mongoose.model('PrivacyAudit', PrivacyAuditSchema);

// Index creation for better performance
export const createIndexes = async () => {
  try {
    // Compound indexes for common query patterns
    await AnonymousData.collection.createIndex(
      { dataType: 1, timeWindow: 1, userSegmentHash: 1 },
      { background: true }
    );
    
    await AnonymousData.collection.createIndex(
      { privacyValidated: 1, kAnonymityLevel: 1 },
      { background: true }
    );
    
    // TTL index for automatic data cleanup
    await AnonymousData.collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 63072000, background: true } // 2 years
    );
    
    // Consent management indexes
    await Consent.collection.createIndex(
      { consentGiven: 1, revokeDate: 1 },
      { background: true }
    );
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating database indexes:', error);
  }
};
