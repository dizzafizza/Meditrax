import express from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { Consent, PrivacyAudit } from '../models/anonymousData';
import { AnonymousReportingConsent } from '../types/anonymization';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/consent.log' })
  ]
});

// Hash user ID for privacy
const hashUserId = (userId: string, secret: string = process.env.CONSENT_SECRET || 'default-secret'): string => {
  return crypto.createHmac('sha256', secret).update(userId).digest('hex');
};

// Hash IP address for audit purposes
const hashIpAddress = (ip: string): string => {
  const secret = process.env.AUDIT_SECRET || 'audit-secret';
  return crypto.createHmac('sha256', secret).update(ip).digest('hex').substring(0, 16);
};

// Hash User Agent for bot detection
const hashUserAgent = (userAgent: string): string => {
  const secret = process.env.AUDIT_SECRET || 'audit-secret';
  return crypto.createHmac('sha256', secret).update(userAgent).digest('hex').substring(0, 16);
};

/**
 * Grant consent for anonymous data reporting
 */
router.post('/grant', [
  body('userId').isString().isLength({ min: 1, max: 100 }),
  body('dataTypesAllowed').isArray().custom((value) => {
    const validTypes = ['adherence', 'side_effects', 'medication_patterns', 'risk_assessments'];
    return value.every((type: string) => validTypes.includes(type));
  }),
  body('granularityPreferences').isObject(),
  body('granularityPreferences.includeAdherence').isBoolean(),
  body('granularityPreferences.includeSideEffects').isBoolean(),
  body('granularityPreferences.includeMedicationPatterns').isBoolean(),
  body('granularityPreferences.includeRiskAssessments').isBoolean(),
  body('granularityPreferences.allowTemporalAnalysis').isBoolean(),
  body('granularityPreferences.allowDemographicAnalysis').isBoolean(),
  body('privacyLevel').isIn(['minimal', 'standard', 'detailed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId, dataTypesAllowed, granularityPreferences, privacyLevel } = req.body;
    const userIdHash = hashUserId(userId);
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Check if consent already exists
    const existingConsent = await Consent.findOne({ userIdHash });
    
    if (existingConsent && existingConsent.consentGiven && !existingConsent.revokeDate) {
      return res.status(409).json({
        success: false,
        message: 'Consent already granted. Use update endpoint to modify preferences.'
      });
    }

    // Create or update consent record
    const consentData: Partial<AnonymousReportingConsent> = {
      userIdHash,
      consentGiven: true,
      consentDate: new Date(),
      dataTypesAllowed,
      granularityPreferences,
      privacyLevel,
      canRevoke: true,
      revokeDate: undefined,
      lastUpdated: new Date(),
      consentVersion: '1.0',
      ipHashAtConsent: hashIpAddress(clientIp),
      userAgentHash: hashUserAgent(userAgent)
    };

    let consent;
    if (existingConsent) {
      // Update existing consent (e.g., if previously revoked)
      consent = await Consent.findOneAndUpdate(
        { userIdHash },
        consentData,
        { new: true, upsert: true }
      );
    } else {
      // Create new consent
      consent = await Consent.create(consentData);
    }

    // Log consent action
    await PrivacyAudit.create({
      action: 'consent_update',
      userIdHash,
      timestamp: new Date(),
      details: {
        consentAction: 'grant',
        dataTypesAllowed,
        privacyLevel,
        granularityPreferences
      },
      ipHash: hashIpAddress(clientIp),
      userAgentHash: hashUserAgent(userAgent),
      riskLevel: 'low'
    });

    logger.info('User consent granted', {
      userIdHash: userIdHash.substring(0, 8) + '...',
      dataTypesAllowed,
      privacyLevel,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Consent granted successfully',
      data: {
        consentId: consent._id,
        consentDate: consent.consentDate,
        dataTypesAllowed: consent.dataTypesAllowed,
        privacyLevel: consent.privacyLevel,
        expirationNote: 'Consent can be revoked at any time'
      }
    });

  } catch (error) {
    logger.error('Error granting consent:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Update consent preferences
 */
router.put('/update', [
  body('userId').isString().isLength({ min: 1, max: 100 }),
  body('dataTypesAllowed').optional().isArray(),
  body('granularityPreferences').optional().isObject(),
  body('privacyLevel').optional().isIn(['minimal', 'standard', 'detailed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId, ...updates } = req.body;
    const userIdHash = hashUserId(userId);
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Find existing consent
    const existingConsent = await Consent.findOne({ userIdHash, consentGiven: true, revokeDate: null });
    
    if (!existingConsent) {
      return res.status(404).json({
        success: false,
        message: 'No active consent found. Please grant consent first.'
      });
    }

    // Update consent with provided fields
    const updatedConsent = await Consent.findOneAndUpdate(
      { userIdHash, consentGiven: true, revokeDate: null },
      {
        ...updates,
        lastUpdated: new Date()
      },
      { new: true }
    );

    // Log consent update
    await PrivacyAudit.create({
      action: 'consent_update',
      userIdHash,
      timestamp: new Date(),
      details: {
        consentAction: 'update',
        updatedFields: Object.keys(updates),
        updates
      },
      ipHash: hashIpAddress(clientIp),
      userAgentHash: hashUserAgent(userAgent),
      riskLevel: 'low'
    });

    logger.info('User consent updated', {
      userIdHash: userIdHash.substring(0, 8) + '...',
      updatedFields: Object.keys(updates),
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Consent updated successfully',
      data: {
        consentId: updatedConsent!._id,
        lastUpdated: updatedConsent!.lastUpdated,
        dataTypesAllowed: updatedConsent!.dataTypesAllowed,
        privacyLevel: updatedConsent!.privacyLevel
      }
    });

  } catch (error) {
    logger.error('Error updating consent:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Revoke consent (GDPR compliance)
 */
router.post('/revoke', [
  body('userId').isString().isLength({ min: 1, max: 100 }),
  body('confirmRevocation').isBoolean().equals(true),
  body('reason').optional().isString().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId, reason } = req.body;
    const userIdHash = hashUserId(userId);
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Find and revoke consent
    const consent = await Consent.findOneAndUpdate(
      { userIdHash, consentGiven: true, revokeDate: null },
      {
        consentGiven: false,
        revokeDate: new Date(),
        lastUpdated: new Date()
      },
      { new: true }
    );

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'No active consent found to revoke'
      });
    }

    // Log consent revocation
    await PrivacyAudit.create({
      action: 'consent_update',
      userIdHash,
      timestamp: new Date(),
      details: {
        consentAction: 'revoke',
        reason: reason || 'No reason provided',
        revokeDate: new Date()
      },
      ipHash: hashIpAddress(clientIp),
      userAgentHash: hashUserAgent(userAgent),
      riskLevel: 'medium' // Higher risk level for revocations for monitoring
    });

    logger.info('User consent revoked', {
      userIdHash: userIdHash.substring(0, 8) + '...',
      reason: reason || 'No reason provided',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Consent revoked successfully',
      data: {
        revokeDate: consent.revokeDate,
        note: 'Your data will no longer be collected. Existing anonymized data cannot be deleted due to its anonymous nature, but will expire according to retention policy (2 years maximum).'
      }
    });

  } catch (error) {
    logger.error('Error revoking consent:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get consent status
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId || userId.length < 1 || userId.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const userIdHash = hashUserId(userId);
    const consent = await Consent.findOne({ userIdHash }).select('-userIdHash -ipHashAtConsent -userAgentHash');

    if (!consent) {
      return res.json({
        success: true,
        data: {
          hasConsent: false,
          consentRequired: true,
          message: 'No consent record found'
        }
      });
    }

    const isActive = consent.consentGiven && !consent.revokeDate;

    res.json({
      success: true,
      data: {
        hasConsent: isActive,
        consentDate: consent.consentDate,
        revokeDate: consent.revokeDate,
        dataTypesAllowed: isActive ? consent.dataTypesAllowed : [],
        granularityPreferences: isActive ? consent.granularityPreferences : null,
        privacyLevel: isActive ? consent.privacyLevel : null,
        lastUpdated: consent.lastUpdated,
        canRevoke: consent.canRevoke && isActive
      }
    });

  } catch (error) {
    logger.error('Error fetching consent status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get privacy policy and consent information
 */
router.get('/privacy-info', (req, res) => {
  res.json({
    success: true,
    data: {
      consentVersion: '1.0',
      lastUpdated: '2024-01-01',
      dataTypes: {
        adherence: {
          description: 'Medication adherence patterns and timing',
          sensitivity: 'medium',
          purpose: 'Improve medication adherence research and interventions'
        },
        side_effects: {
          description: 'Reported side effects and their patterns',
          sensitivity: 'high',
          purpose: 'Drug safety monitoring and pharmacovigilance'
        },
        medication_patterns: {
          description: 'Medication usage patterns and polypharmacy data',
          sensitivity: 'medium',
          purpose: 'Understand medication usage trends and interactions'
        },
        risk_assessments: {
          description: 'Risk scores and behavioral patterns',
          sensitivity: 'high',
          purpose: 'Improve risk prediction and prevention strategies'
        }
      },
      privacyLevels: {
        minimal: {
          description: 'Only basic aggregated data, maximum anonymization',
          dataRetention: '1 year',
          granularity: 'Monthly aggregates only'
        },
        standard: {
          description: 'Standard anonymization with weekly aggregates',
          dataRetention: '2 years',
          granularity: 'Weekly aggregates with some demographic data'
        },
        detailed: {
          description: 'More detailed data for research, still anonymized',
          dataRetention: '2 years',
          granularity: 'Daily patterns with demographic and temporal analysis'
        }
      },
      protections: [
        'K-anonymity with minimum group size of 5',
        'Differential privacy with epsilon=1.0',
        'Data generalization and categorization',
        'Cryptographic hashing of identifiers',
        'Time-window aggregation',
        'Automatic data expiration'
      ],
      rights: [
        'Right to grant consent',
        'Right to update preferences',
        'Right to revoke consent at any time',
        'Right to information about data processing',
        'Note: Due to anonymization, individual data deletion is not possible'
      ]
    }
  });
});

export { router as consentRouter };
