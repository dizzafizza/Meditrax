import express from 'express';
import { query, body, validationResult } from 'express-validator';
import { secretAuthService } from '../services/secretAuthService';
import { AnonymousData, AggregatedReport, PrivacyAudit, Consent, AdminUser } from '../models/anonymousData';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/admin-panel.log' })
  ]
});

// Middleware to verify admin token
const verifyAdminToken = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Admin token required'
      });
    }

    const verification = await secretAuthService.verifyAdminToken(token);
    
    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: verification.message || 'Invalid admin token'
      });
    }

    req.admin = verification.decoded;
    next();
  } catch (error) {
    logger.error('Admin token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication service error'
    });
  }
};

/**
 * Admin authentication via UI sequence
 */
router.post('/auth/sequence', [
  body('sequence').isArray().isLength({ min: 3, max: 12 }),
  body('sequence.*').isString().isLength({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sequence format',
        errors: errors.array()
      });
    }

    const { sequence } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    const authResult = await secretAuthService.validateSequence(sequence, clientIP);

    // Log authentication attempt
    await PrivacyAudit.create({
      action: 'admin_auth_attempt',
      timestamp: new Date(),
      details: {
        success: authResult.valid,
        sequenceLength: sequence.length,
        clientIP: clientIP.substring(0, 8) + '***' // Partial IP for privacy
      },
      ipHash: require('crypto').createHash('sha256').update(clientIP).digest('hex').substring(0, 16),
      userAgentHash: require('crypto').createHash('sha256').update(req.get('User-Agent') || '').digest('hex').substring(0, 16),
      riskLevel: authResult.valid ? 'low' : 'high',
      flagged: !authResult.valid
    });

    if (authResult.valid) {
      res.json({
        success: true,
        token: authResult.token,
        message: authResult.message
      });
    } else {
      res.status(401).json({
        success: false,
        message: authResult.message
      });
    }

  } catch (error) {
    logger.error('Admin authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication service error'
    });
  }
});

/**
 * Get comprehensive system dashboard data
 */
router.get('/dashboard', verifyAdminToken, async (req: any, res) => {
  try {
    const admin = req.admin;

    // System overview statistics
    const totalAnonymousRecords = await AnonymousData.countDocuments();
    const totalConsents = await Consent.countDocuments({ consentGiven: true });
    const totalReports = await AggregatedReport.countDocuments();
    const totalAuditLogs = await PrivacyAudit.countDocuments();

    // Data quality metrics
    const privacyValidatedRecords = await AnonymousData.countDocuments({ privacyValidated: true });
    const avgPrivacyScore = await AnonymousData.aggregate([
      { $match: { privacyValidated: true } },
      { $group: { _id: null, avgScore: { $avg: '$validationScore' } } }
    ]);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = await AnonymousData.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    const recentConsents = await Consent.countDocuments({
      consentDate: { $gte: sevenDaysAgo }
    });

    // Data type breakdown
    const dataTypeBreakdown = await AnonymousData.aggregate([
      { $group: { _id: '$dataType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Privacy level distribution
    const privacyLevelDistribution = await Consent.aggregate([
      { $match: { consentGiven: true } },
      { $group: { _id: '$privacyLevel', count: { $sum: 1 } } }
    ]);

    // K-anonymity compliance
    const kAnonymityStats = await AnonymousData.aggregate([
      {
        $group: {
          _id: null,
          avgKLevel: { $avg: '$kAnonymityLevel' },
          minKLevel: { $min: '$kAnonymityLevel' },
          maxKLevel: { $max: '$kAnonymityLevel' }
        }
      }
    ]);

    // Risk assessment
    const highRiskAudits = await PrivacyAudit.countDocuments({
      riskLevel: 'high',
      timestamp: { $gte: sevenDaysAgo }
    });

    const flaggedAudits = await PrivacyAudit.countDocuments({
      flagged: true,
      reviewRequired: true
    });

    // System health indicators
    const systemHealth = {
      dataQuality: privacyValidatedRecords / Math.max(totalAnonymousRecords, 1) * 100,
      privacyCompliance: avgPrivacyScore[0]?.avgScore || 0,
      consentRate: totalConsents / Math.max(totalAnonymousRecords, 1) * 100,
      kAnonymityCompliance: kAnonymityStats[0]?.minKLevel >= 5 ? 100 : 50,
      securityAlerts: highRiskAudits + flaggedAudits
    };

    const dashboardData = {
      overview: {
        totalAnonymousRecords,
        totalConsents,
        totalReports,
        totalAuditLogs,
        recentSubmissions,
        recentConsents
      },
      dataQuality: {
        privacyValidatedRecords,
        validationRate: (privacyValidatedRecords / Math.max(totalAnonymousRecords, 1)) * 100,
        avgPrivacyScore: avgPrivacyScore[0]?.avgScore || 0,
        kAnonymityStats: kAnonymityStats[0] || { avgKLevel: 0, minKLevel: 0, maxKLevel: 0 }
      },
      breakdowns: {
        dataTypes: dataTypeBreakdown,
        privacyLevels: privacyLevelDistribution
      },
      security: {
        highRiskAudits,
        flaggedAudits,
        totalSecurityEvents: highRiskAudits + flaggedAudits
      },
      systemHealth,
      accessLevel: admin.accessLevel,
      permissions: admin.permissions
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    logger.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data'
    });
  }
});

/**
 * Get detailed analytics for research purposes
 */
router.get('/analytics/detailed', verifyAdminToken, [
  query('timeRange').optional().isIn(['7d', '30d', '90d', '1y', 'all']),
  query('dataType').optional().isIn(['adherence', 'side_effect', 'medication_pattern', 'risk_assessment']),
  query('groupBy').optional().isIn(['day', 'week', 'month'])
], async (req: any, res) => {
  try {
    const admin = req.admin;
    
    // Check permissions
    if (!admin.permissions.includes('view_aggregated_data') && !admin.permissions.includes('view_all_data')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for detailed analytics'
      });
    }

    const { timeRange = '30d', dataType, groupBy = 'week' } = req.query;

    // Calculate date range
    let startDate = new Date();
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
    }

    // Build aggregation pipeline
    const matchStage: any = {
      createdAt: { $gte: startDate },
      privacyValidated: true
    };

    if (dataType) {
      matchStage.dataType = dataType;
    }

    // Time series aggregation
    const timeSeriesData = await AnonymousData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            week: { $week: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            dataType: '$dataType'
          },
          count: { $sum: 1 },
          avgPrivacyScore: { $avg: '$validationScore' },
          avgKAnonymity: { $avg: '$kAnonymityLevel' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } }
    ]);

    // Medication category analysis
    const medicationAnalysis = await AnonymousData.aggregate([
      { $match: { ...matchStage, 'metrics.medicationCategory': { $exists: true } } },
      {
        $group: {
          _id: '$metrics.medicationCategory',
          count: { $sum: 1 },
          avgAdherence: { $avg: '$metrics.adherenceRate' },
          sideEffects: { $sum: { $cond: [{ $eq: ['$dataType', 'side_effect'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Privacy compliance trends
    const privacyTrends = await AnonymousData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalRecords: { $sum: 1 },
          validatedRecords: { $sum: { $cond: ['$privacyValidated', 1, 0] } },
          avgPrivacyScore: { $avg: '$validationScore' },
          minKAnonymity: { $min: '$kAnonymityLevel' }
        }
      },
      {
        $addFields: {
          validationRate: { $divide: ['$validatedRecords', '$totalRecords'] }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Geographic patterns (if available)
    const geographicPatterns = await AnonymousData.aggregate([
      { 
        $match: { 
          ...matchStage, 
          regionCode: { $exists: true, $ne: null } 
        } 
      },
      {
        $group: {
          _id: '$regionCode',
          count: { $sum: 1 },
          dataTypes: { $addToSet: '$dataType' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const analyticsData = {
      timeRange,
      dataType: dataType || 'all',
      summary: {
        totalRecords: timeSeriesData.reduce((sum, item) => sum + item.count, 0),
        uniqueDataTypes: [...new Set(timeSeriesData.map(item => item._id.dataType))].length,
        avgPrivacyScore: timeSeriesData.reduce((sum, item) => sum + item.avgPrivacyScore, 0) / Math.max(timeSeriesData.length, 1)
      },
      timeSeries: timeSeriesData,
      medicationAnalysis,
      privacyTrends,
      geographicPatterns: geographicPatterns.length > 0 ? geographicPatterns : null
    };

    res.json({
      success: true,
      data: analyticsData
    });

  } catch (error) {
    logger.error('Detailed analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics'
    });
  }
});

/**
 * Get real-time system monitoring data
 */
router.get('/monitoring/realtime', verifyAdminToken, async (req: any, res) => {
  try {
    const admin = req.admin;

    if (!admin.permissions.includes('view_all_data')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for real-time monitoring'
      });
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Real-time metrics
    const lastHourSubmissions = await AnonymousData.countDocuments({
      createdAt: { $gte: oneHourAgo }
    });

    const lastDaySubmissions = await AnonymousData.countDocuments({
      createdAt: { $gte: oneDayAgo }
    });

    // Recent privacy violations
    const recentViolations = await PrivacyAudit.find({
      flagged: true,
      timestamp: { $gte: oneDayAgo }
    }).sort({ timestamp: -1 }).limit(10);

    // Active consent trends
    const activeConsents = await Consent.countDocuments({
      consentGiven: true,
      revokeDate: null
    });

    const recentConsentChanges = await Consent.find({
      $or: [
        { consentDate: { $gte: oneDayAgo } },
        { revokeDate: { $gte: oneDayAgo } }
      ]
    }).sort({ updatedAt: -1 });

    // Data validation metrics
    const validationStats = await AnonymousData.aggregate([
      { $match: { createdAt: { $gte: oneDayAgo } } },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          validatedSubmissions: { $sum: { $cond: ['$privacyValidated', 1, 0] } },
          avgValidationScore: { $avg: '$validationScore' },
          failedValidations: { $sum: { $cond: [{ $eq: ['$privacyValidated', false] }, 1, 0] } }
        }
      }
    ]);

    // System performance indicators
    const performanceMetrics = {
      submissionRate: {
        lastHour: lastHourSubmissions,
        lastDay: lastDaySubmissions,
        rate: lastHourSubmissions * 24 // Projected daily rate
      },
      validation: validationStats[0] || {
        totalSubmissions: 0,
        validatedSubmissions: 0,
        avgValidationScore: 0,
        failedValidations: 0
      },
      consent: {
        activeConsents,
        recentChanges: recentConsentChanges.length
      },
      security: {
        recentViolations: recentViolations.length,
        flaggedEvents: recentViolations.filter(v => v.reviewRequired).length
      }
    };

    res.json({
      success: true,
      data: {
        timestamp: now,
        metrics: performanceMetrics,
        recentViolations: recentViolations.map(v => ({
          timestamp: v.timestamp,
          action: v.action,
          riskLevel: v.riskLevel,
          flagged: v.flagged,
          details: v.details
        })),
        alerts: [
          ...(lastHourSubmissions > 1000 ? [{
            type: 'warning',
            message: 'High submission rate detected',
            value: lastHourSubmissions
          }] : []),
          ...(validationStats[0]?.failedValidations > 10 ? [{
            type: 'error',
            message: 'Multiple validation failures',
            value: validationStats[0].failedValidations
          }] : []),
          ...(recentViolations.length > 5 ? [{
            type: 'critical',
            message: 'Multiple privacy violations',
            value: recentViolations.length
          }] : [])
        ]
      }
    });

  } catch (error) {
    logger.error('Real-time monitoring error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get monitoring data'
    });
  }
});

/**
 * Export anonymized research dataset
 */
router.post('/export/research-dataset', verifyAdminToken, [
  body('format').isIn(['json', 'csv']),
  body('dataTypes').isArray(),
  body('timeRange').optional().isObject(),
  body('includeDemographics').optional().isBoolean(),
  body('minKAnonymity').optional().isInt({ min: 5, max: 100 })
], async (req: any, res) => {
  try {
    const admin = req.admin;

    if (!admin.permissions.includes('export_data')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for data export'
      });
    }

    const { format, dataTypes, timeRange, includeDemographics = false, minKAnonymity = 5 } = req.body;

    // Build query
    const query: any = {
      privacyValidated: true,
      kAnonymityLevel: { $gte: minKAnonymity },
      dataType: { $in: dataTypes }
    };

    if (timeRange) {
      query.createdAt = {};
      if (timeRange.start) query.createdAt.$gte = new Date(timeRange.start);
      if (timeRange.end) query.createdAt.$lte = new Date(timeRange.end);
    }

    // Get data with privacy controls
    const projection: any = {
      _id: 0,
      timeWindow: 1,
      weekday: 1,
      timeOfDay: 1,
      dataType: 1,
      metrics: 1,
      kAnonymityLevel: 1,
      noiseLevel: 1
    };

    if (includeDemographics && admin.accessLevel === 'superadmin') {
      projection.demographicGroup = 1;
      projection.regionCode = 1;
    }

    const data = await AnonymousData.find(query, projection).limit(10000);

    // Log export activity
    await PrivacyAudit.create({
      action: 'data_export',
      timestamp: new Date(),
      details: {
        adminId: admin.adminId,
        format,
        dataTypes,
        recordCount: data.length,
        includeDemographics
      },
      riskLevel: 'medium'
    });

    if (format === 'csv') {
      // Convert to CSV
      const csvData = data.map(record => ({
        timeWindow: record.timeWindow,
        weekday: record.weekday,
        timeOfDay: record.timeOfDay,
        dataType: record.dataType,
        kAnonymityLevel: record.kAnonymityLevel,
        ...record.metrics,
        ...(includeDemographics ? {
          demographicGroup: record.demographicGroup,
          regionCode: record.regionCode
        } : {})
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="research-dataset-${Date.now()}.csv"`);
      
      // Simple CSV conversion (in production, use a proper CSV library)
      const headers = Object.keys(csvData[0] || {});
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => row[header] || '').join(','))
      ].join('\n');

      res.send(csvContent);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="research-dataset-${Date.now()}.json"`);
      res.json({
        metadata: {
          exportDate: new Date(),
          recordCount: data.length,
          dataTypes,
          minKAnonymity,
          privacyNotice: 'This dataset contains only anonymized data. Individual users cannot be identified.'
        },
        data
      });
    }

  } catch (error) {
    logger.error('Research dataset export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export research dataset'
    });
  }
});

export { router as adminPanelRouter };
