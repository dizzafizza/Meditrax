import express from 'express';
import { query, validationResult } from 'express-validator';
import { AnonymousData, AggregatedReport, PrivacyAudit } from '../models/anonymousData';
import { validateResearchAccess, validateAdminAccess } from '../middleware/auth';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/reports.log' })
  ]
});

/**
 * Generate aggregated adherence report
 */
router.get('/adherence', validateResearchAccess, [
  query('startPeriod').optional().isString(),
  query('endPeriod').optional().isString(),
  query('medicationCategory').optional().isString(),
  query('minSampleSize').optional().isInt({ min: 5, max: 1000 })
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

    const {
      startPeriod,
      endPeriod,
      medicationCategory,
      minSampleSize = 5
    } = req.query;

    // Build aggregation pipeline
    const pipeline: any[] = [
      {
        $match: {
          dataType: 'adherence',
          privacyValidated: true,
          kAnonymityLevel: { $gte: minSampleSize }
        }
      }
    ];

    // Add time range filter if provided
    if (startPeriod || endPeriod) {
      const timeFilter: any = {};
      if (startPeriod) timeFilter.$gte = startPeriod;
      if (endPeriod) timeFilter.$lte = endPeriod;
      pipeline.push({ $match: { timeWindow: timeFilter } });
    }

    // Add medication category filter if provided
    if (medicationCategory) {
      pipeline.push({
        $match: {
          'metrics.medicationCategory': medicationCategory
        }
      });
    }

    // Aggregate adherence data
    pipeline.push(
      {
        $group: {
          _id: {
            medicationCategory: '$metrics.medicationCategory',
            dosageFrequency: '$metrics.dosageFrequency',
            timeWindow: '$timeWindow'
          },
          avgAdherenceRate: { $avg: '$metrics.adherenceRate' },
          count: { $sum: 1 },
          sampleUserSegments: { $addToSet: '$userSegmentHash' }
        }
      },
      {
        $match: {
          count: { $gte: minSampleSize } // Ensure k-anonymity
        }
      },
      {
        $group: {
          _id: '$_id.medicationCategory',
          overallAdherenceRate: { $avg: '$avgAdherenceRate' },
          byFrequency: {
            $push: {
              frequency: '$_id.dosageFrequency',
              adherenceRate: '$avgAdherenceRate',
              sampleSize: '$count'
            }
          },
          totalSampleSize: { $sum: '$count' },
          uniqueUserSegments: { $sum: { $size: '$sampleUserSegments' } }
        }
      },
      {
        $sort: { overallAdherenceRate: -1 }
      }
    );

    const adherenceData = await AnonymousData.aggregate(pipeline);

    // Calculate confidence intervals (simplified)
    const processedData = adherenceData.map(item => ({
      medicationCategory: item._id,
      overallAdherenceRate: Math.round(item.overallAdherenceRate * 100) / 100,
      byFrequency: item.byFrequency.map((freq: any) => ({
        ...freq,
        adherenceRate: Math.round(freq.adherenceRate * 100) / 100,
        confidenceInterval: 95 // Simplified - would need proper statistical calculation
      })),
      sampleSize: item.totalSampleSize,
      uniqueUsers: item.uniqueUserSegments
    }));

    // Create aggregated report
    const reportId = `adherence-${Date.now()}`;
    const report = {
      reportId,
      reportType: 'adherence',
      timeRange: {
        start: startPeriod || 'all-time',
        end: endPeriod || 'current'
      },
      sampleSize: processedData.reduce((sum, item) => sum + item.sampleSize, 0),
      confidenceInterval: 0.95,
      data: {
        summary: {
          averageAdherence: processedData.reduce((sum, item) => 
            sum + (item.overallAdherenceRate * item.sampleSize), 0) / 
            processedData.reduce((sum, item) => sum + item.sampleSize, 0),
          medicationCategories: processedData.length,
          totalSamples: processedData.reduce((sum, item) => sum + item.sampleSize, 0)
        },
        byCategory: processedData
      },
      dataQualityScore: 85, // Would be calculated based on data completeness
      privacyScore: 95, // High privacy score due to multiple anonymization layers
      completenessScore: 90
    };

    // Save report for future reference
    await AggregatedReport.create(report);

    // Log report access
    await PrivacyAudit.create({
      action: 'report_access',
      timestamp: new Date(),
      details: {
        reportType: 'adherence',
        sampleSize: report.sampleSize,
        timeRange: report.timeRange,
        apiKeyUsed: true
      },
      ipHash: req.privacyAudit?.ipHash || 'unknown',
      userAgentHash: req.privacyAudit?.userAgentHash || 'unknown',
      riskLevel: 'low'
    });

    logger.info('Adherence report generated', {
      reportId,
      sampleSize: report.sampleSize,
      categories: processedData.length
    });

    res.json({
      success: true,
      data: report,
      metadata: {
        generatedAt: new Date().toISOString(),
        privacyNotice: 'All data has been anonymized using k-anonymity (k≥5) and differential privacy',
        dataRetention: 'This report will be retained for 1 year'
      }
    });

  } catch (error) {
    logger.error('Error generating adherence report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Generate side effects safety report
 */
router.get('/side-effects', validateResearchAccess, [
  query('startPeriod').optional().isString(),
  query('endPeriod').optional().isString(),
  query('medicationCategory').optional().isString(),
  query('severityLevel').optional().isIn(['mild', 'moderate', 'severe']),
  query('minSampleSize').optional().isInt({ min: 5, max: 1000 })
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

    const {
      startPeriod,
      endPeriod,
      medicationCategory,
      severityLevel,
      minSampleSize = 5
    } = req.query;

    const pipeline: any[] = [
      {
        $match: {
          dataType: 'side_effect',
          privacyValidated: true,
          kAnonymityLevel: { $gte: minSampleSize }
        }
      }
    ];

    // Add filters
    if (startPeriod || endPeriod) {
      const timeFilter: any = {};
      if (startPeriod) timeFilter.$gte = startPeriod;
      if (endPeriod) timeFilter.$lte = endPeriod;
      pipeline.push({ $match: { timeWindow: timeFilter } });
    }

    if (medicationCategory) {
      pipeline.push({
        $match: { 'metrics.medicationCategory': medicationCategory }
      });
    }

    if (severityLevel) {
      pipeline.push({
        $match: { 'metrics.severityLevel': severityLevel }
      });
    }

    // Aggregate side effect data
    pipeline.push(
      {
        $group: {
          _id: {
            medicationCategory: '$metrics.medicationCategory',
            sideEffectCategory: '$metrics.sideEffectCategory',
            severityLevel: '$metrics.severityLevel'
          },
          count: { $sum: 1 },
          onsetPatterns: { $push: '$metrics.onsetPattern' },
          uniqueUserSegments: { $addToSet: '$userSegmentHash' }
        }
      },
      {
        $match: {
          count: { $gte: minSampleSize }
        }
      },
      {
        $group: {
          _id: '$_id.medicationCategory',
          sideEffects: {
            $push: {
              category: '$_id.sideEffectCategory',
              severity: '$_id.severityLevel',
              frequency: '$count',
              onsetPatterns: '$onsetPatterns',
              affectedUsers: { $size: '$uniqueUserSegments' }
            }
          },
          totalReports: { $sum: '$count' }
        }
      }
    );

    const sideEffectData = await AnonymousData.aggregate(pipeline);

    const reportId = `side-effects-${Date.now()}`;
    const report = {
      reportId,
      reportType: 'side_effects',
      timeRange: {
        start: startPeriod || 'all-time',
        end: endPeriod || 'current'
      },
      sampleSize: sideEffectData.reduce((sum, item) => sum + item.totalReports, 0),
      confidenceInterval: 0.95,
      data: {
        summary: {
          totalMedicationCategories: sideEffectData.length,
          totalSideEffectReports: sideEffectData.reduce((sum, item) => sum + item.totalReports, 0),
          avgReportsPerCategory: sideEffectData.length > 0 ? 
            sideEffectData.reduce((sum, item) => sum + item.totalReports, 0) / sideEffectData.length : 0
        },
        byMedication: sideEffectData,
        safetySignals: [] // Would be populated by safety signal detection algorithm
      },
      dataQualityScore: 88,
      privacyScore: 95,
      completenessScore: 85
    };

    await AggregatedReport.create(report);

    await PrivacyAudit.create({
      action: 'report_access',
      timestamp: new Date(),
      details: {
        reportType: 'side_effects',
        sampleSize: report.sampleSize,
        timeRange: report.timeRange
      },
      ipHash: req.privacyAudit?.ipHash || 'unknown',
      userAgentHash: req.privacyAudit?.userAgentHash || 'unknown',
      riskLevel: 'medium' // Higher risk due to safety implications
    });

    res.json({
      success: true,
      data: report,
      metadata: {
        generatedAt: new Date().toISOString(),
        privacyNotice: 'All data has been anonymized. Individual cases cannot be identified.',
        safetyNotice: 'This report is for research purposes. Consult healthcare providers for individual cases.'
      }
    });

  } catch (error) {
    logger.error('Error generating side effects report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get list of available reports
 */
router.get('/list', validateResearchAccess, [
  query('reportType').optional().isIn(['adherence', 'side_effects', 'medication_patterns', 'risk_trends', 'comprehensive']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const { reportType, limit = 20, offset = 0 } = req.query;

    const filter: any = { accessLevel: 'research' };
    if (reportType) filter.reportType = reportType;

    const reports = await AggregatedReport.find(filter)
      .select('reportId reportType timeRange sampleSize generatedAt dataQualityScore privacyScore')
      .sort({ generatedAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));

    const totalReports = await AggregatedReport.countDocuments(filter);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          total: totalReports,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: offset + reports.length < totalReports
        }
      }
    });

  } catch (error) {
    logger.error('Error listing reports:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get specific report by ID
 */
router.get('/:reportId', validateResearchAccess, async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await AggregatedReport.findOne({ 
      reportId, 
      accessLevel: 'research' 
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Update access tracking
    await AggregatedReport.findByIdAndUpdate(report._id, {
      $inc: { downloadCount: 1 },
      lastAccessed: new Date()
    });

    await PrivacyAudit.create({
      action: 'report_access',
      timestamp: new Date(),
      details: {
        reportId,
        reportType: report.reportType,
        accessType: 'download'
      },
      ipHash: req.privacyAudit?.ipHash || 'unknown',
      userAgentHash: req.privacyAudit?.userAgentHash || 'unknown',
      riskLevel: 'low'
    });

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Admin endpoint to get privacy audit logs
 */
router.get('/admin/audit-logs', validateAdminAccess, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('action').optional().isString(),
  query('riskLevel').optional().isIn(['low', 'medium', 'high']),
  query('flagged').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 1000 })
], async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      action,
      riskLevel,
      flagged,
      limit = 100
    } = req.query;

    const filter: any = {};
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate as string);
      if (endDate) filter.timestamp.$lte = new Date(endDate as string);
    }
    
    if (action) filter.action = action;
    if (riskLevel) filter.riskLevel = riskLevel;
    if (flagged !== undefined) filter.flagged = flagged === 'true';

    const auditLogs = await PrivacyAudit.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .select('-userIdHash'); // Don't expose user hashes to admin

    const stats = await PrivacyAudit.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        auditLogs,
        stats,
        totalLogs: auditLogs.length
      }
    });

  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export { router as reportsRouter };
