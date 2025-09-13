import express from 'express';
import { body, validationResult } from 'express-validator';
import { AnonymizationService } from '../services/anonymizationService';
import { AnonymousData, Consent, PrivacyAudit } from '../models/anonymousData';
import { AnonymizationConfig } from '../types/anonymization';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/anonymization.log' })
  ]
});

// Default anonymization configuration
const defaultConfig: AnonymizationConfig = {
  kAnonymityMinSize: 5,
  differentialPrivacyEpsilon: 1.0,
  aggregationWindow: 'weekly',
  geographicGranularity: 'region',
  demographicGranularity: 'age_range',
  dataRetentionDays: 730, // 2 years
  noiseScale: 0.1
};

const anonymizationService = new AnonymizationService(
  defaultConfig,
  process.env.ANONYMIZATION_SECRET || 'default-secret-change-in-production'
);

/**
 * Submit anonymous adherence data
 */
router.post('/adherence', [
  body('userId').isString().isLength({ min: 1, max: 100 }),
  body('medicationName').isString().isLength({ min: 1, max: 200 }),
  body('adherenceRate').isFloat({ min: 0, max: 100 }),
  body('frequency').isIn(['once-daily', 'twice-daily', 'three-times-daily', 'four-times-daily', 'as-needed', 'weekly', 'monthly']),
  body('userAge').optional().isInt({ min: 0, max: 120 }),
  body('missedDoses').optional().isArray(),
  body('streakLength').optional().isInt({ min: 0 })
], async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { userId, ...adherenceData } = req.body;

    // Check user consent
    const userIdHash = anonymizationService.generateUserSegmentHash(userId, 'consent-check');
    const consent = await Consent.findOne({ userIdHash, consentGiven: true, revokeDate: null });
    
    if (!consent || !consent.granularityPreferences.includeAdherence) {
      return res.status(403).json({
        success: false,
        message: 'User consent required for adherence data submission'
      });
    }

    // Anonymize the data
    const anonymizedData = await anonymizationService.anonymizeAdherenceData(
      userId,
      adherenceData,
      new Date()
    );

    // Validate privacy requirements
    const privacyValidation = await anonymizationService.validatePrivacy(anonymizedData);
    
    if (!privacyValidation.isAnonymous) {
      logger.warn('Privacy validation failed', {
        riskScore: privacyValidation.riskScore,
        warnings: privacyValidation.warnings
      });

      // Log privacy violation for audit
      await PrivacyAudit.create({
        action: 'privacy_violation',
        timestamp: new Date(),
        details: {
          dataType: 'adherence',
          riskScore: privacyValidation.riskScore,
          warnings: privacyValidation.warnings
        },
        riskLevel: 'high',
        flagged: true,
        reviewRequired: true
      });

      return res.status(422).json({
        success: false,
        message: 'Data does not meet privacy requirements',
        warnings: privacyValidation.warnings
      });
    }

    // Store anonymized data
    const savedData = await AnonymousData.create({
      ...anonymizedData,
      privacyValidated: true,
      validationScore: 100 - privacyValidation.riskScore,
      processedAt: new Date()
    });

    // Log successful submission
    await PrivacyAudit.create({
      action: 'data_submission',
      timestamp: new Date(),
      details: {
        dataType: 'adherence',
        validationScore: 100 - privacyValidation.riskScore,
        kAnonymityLevel: anonymizedData.kAnonymityLevel
      },
      riskLevel: 'low'
    });

    logger.info('Adherence data successfully anonymized and stored', {
      dataId: savedData._id,
      validationScore: 100 - privacyValidation.riskScore,
      kAnonymityLevel: anonymizedData.kAnonymityLevel
    });

    res.json({
      success: true,
      message: 'Adherence data submitted successfully',
      metadata: {
        submissionId: savedData._id,
        privacyScore: 100 - privacyValidation.riskScore,
        anonymizationLevel: 'high'
      }
    });

  } catch (error) {
    logger.error('Error processing adherence data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Submit anonymous side effect data
 */
router.post('/side-effects', [
  body('userId').isString().isLength({ min: 1, max: 100 }),
  body('medicationName').isString().isLength({ min: 1, max: 200 }),
  body('sideEffect').isString().isLength({ min: 1, max: 500 }),
  body('severity').isIn(['mild', 'moderate', 'severe']),
  body('onsetTime').isFloat({ min: 0 }), // Hours since taking medication
  body('riskLevel').isIn(['minimal', 'low', 'moderate', 'high']),
  body('userAge').optional().isInt({ min: 0, max: 120 }),
  body('resolutionTime').optional().isFloat({ min: 0 })
], async (req: express.Request, res: express.Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId, ...sideEffectData } = req.body;

    // Check consent
    const userIdHash = anonymizationService.generateUserSegmentHash(userId, 'consent-check');
    const consent = await Consent.findOne({ userIdHash, consentGiven: true, revokeDate: null });
    
    if (!consent || !consent.granularityPreferences.includeSideEffects) {
      return res.status(403).json({
        success: false,
        message: 'User consent required for side effect data submission'
      });
    }

    // Anonymize data
    const anonymizedData = await anonymizationService.anonymizeSideEffectData(
      userId,
      sideEffectData,
      new Date()
    );

    // Validate privacy
    const privacyValidation = await anonymizationService.validatePrivacy(anonymizedData);
    
    if (!privacyValidation.isAnonymous) {
      await PrivacyAudit.create({
        action: 'privacy_violation',
        timestamp: new Date(),
        details: {
          dataType: 'side_effect',
          riskScore: privacyValidation.riskScore,
          warnings: privacyValidation.warnings
        },
        riskLevel: 'high',
        flagged: true,
        reviewRequired: true
      });

      return res.status(422).json({
        success: false,
        message: 'Data does not meet privacy requirements',
        warnings: privacyValidation.warnings
      });
    }

    // Store data
    const savedData = await AnonymousData.create({
      ...anonymizedData,
      privacyValidated: true,
      validationScore: 100 - privacyValidation.riskScore,
      processedAt: new Date()
    });

    await PrivacyAudit.create({
      action: 'data_submission',
      timestamp: new Date(),
      details: {
        dataType: 'side_effect',
        validationScore: 100 - privacyValidation.riskScore
      },
      riskLevel: 'low'
    });

    res.json({
      success: true,
      message: 'Side effect data submitted successfully',
      metadata: {
        submissionId: savedData._id,
        privacyScore: 100 - privacyValidation.riskScore,
        anonymizationLevel: 'high'
      }
    });

  } catch (error) {
    logger.error('Error processing side effect data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Submit anonymous medication pattern data
 */
router.post('/medication-patterns', [
  body('userId').isString().isLength({ min: 1, max: 100 }),
  body('primaryMedication').isString().isLength({ min: 1, max: 200 }),
  body('medicationCount').isInt({ min: 1, max: 50 }),
  body('complexityScore').isFloat({ min: 0, max: 100 }),
  body('durationDays').isInt({ min: 1 }),
  body('userAge').optional().isInt({ min: 0, max: 120 }),
  body('secondaryMedications').optional().isArray(),
  body('hasCyclicPatterns').optional().isBoolean()
], async (req: express.Request, res: express.Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId, ...patternData } = req.body;

    // Check consent
    const userIdHash = anonymizationService.generateUserSegmentHash(userId, 'consent-check');
    const consent = await Consent.findOne({ userIdHash, consentGiven: true, revokeDate: null });
    
    if (!consent || !consent.granularityPreferences.includeMedicationPatterns) {
      return res.status(403).json({
        success: false,
        message: 'User consent required for medication pattern data submission'
      });
    }

    // Anonymize data
    const anonymizedData = await anonymizationService.anonymizeMedicationPattern(
      userId,
      patternData,
      new Date()
    );

    // Validate privacy
    const privacyValidation = await anonymizationService.validatePrivacy(anonymizedData);
    
    if (!privacyValidation.isAnonymous) {
      await PrivacyAudit.create({
        action: 'privacy_violation',
        timestamp: new Date(),
        details: {
          dataType: 'medication_pattern',
          riskScore: privacyValidation.riskScore,
          warnings: privacyValidation.warnings
        },
        riskLevel: 'high',
        flagged: true,
        reviewRequired: true
      });

      return res.status(422).json({
        success: false,
        message: 'Data does not meet privacy requirements',
        warnings: privacyValidation.warnings
      });
    }

    // Store data
    const savedData = await AnonymousData.create({
      ...anonymizedData,
      privacyValidated: true,
      validationScore: 100 - privacyValidation.riskScore,
      processedAt: new Date()
    });

    await PrivacyAudit.create({
      action: 'data_submission',
      timestamp: new Date(),
      details: {
        dataType: 'medication_pattern',
        validationScore: 100 - privacyValidation.riskScore
      },
      riskLevel: 'low'
    });

    res.json({
      success: true,
      message: 'Medication pattern data submitted successfully',
      metadata: {
        submissionId: savedData._id,
        privacyScore: 100 - privacyValidation.riskScore,
        anonymizationLevel: 'high'
      }
    });

  } catch (error) {
    logger.error('Error processing medication pattern data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get anonymization statistics (for transparency)
 */
router.get('/stats', async (req: express.Request, res: express.Response) => {
  try {
    const stats = await AnonymousData.aggregate([
      {
        $group: {
          _id: '$dataType',
          count: { $sum: 1 },
          avgPrivacyScore: { $avg: '$validationScore' },
          avgKAnonymity: { $avg: '$kAnonymityLevel' }
        }
      }
    ]);

    const totalSubmissions = await AnonymousData.countDocuments();
    const validatedSubmissions = await AnonymousData.countDocuments({ privacyValidated: true });

    res.json({
      success: true,
      data: {
        totalSubmissions,
        validatedSubmissions,
        validationRate: (validatedSubmissions / totalSubmissions) * 100,
        byDataType: stats,
        privacyFeatures: {
          kAnonymityMinimum: defaultConfig.kAnonymityMinSize,
          differentialPrivacyEpsilon: defaultConfig.differentialPrivacyEpsilon,
          aggregationWindow: defaultConfig.aggregationWindow,
          dataRetentionDays: defaultConfig.dataRetentionDays
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching anonymization stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export { router as anonymousDataRouter };
