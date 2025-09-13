import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PrivacyAudit } from '../models/anonymousData';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/privacy-audit.log' })
  ]
});

// Hash IP address for privacy
const hashIpAddress = (ip: string): string => {
  const secret = process.env.AUDIT_SECRET || 'audit-secret';
  return crypto.createHmac('sha256', secret).update(ip).digest('hex').substring(0, 16);
};

// Hash User Agent for bot detection
const hashUserAgent = (userAgent: string): string => {
  const secret = process.env.AUDIT_SECRET || 'audit-secret';
  return crypto.createHmac('sha256', secret).update(userAgent).digest('hex').substring(0, 16);
};

// Track suspicious patterns
const suspiciousPatterns = new Map<string, number>();
const SUSPICIOUS_THRESHOLD = 10; // requests per minute
const CLEANUP_INTERVAL = 60000; // 1 minute

// Clean up tracking map periodically
setInterval(() => {
  suspiciousPatterns.clear();
}, CLEANUP_INTERVAL);

/**
 * Privacy audit logging middleware
 */
export const privacyAuditLogger = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const ipHash = hashIpAddress(clientIp);
    const userAgentHash = hashUserAgent(userAgent);
    const timestamp = new Date();

    // Track request patterns for abuse detection
    const patternKey = `${ipHash}-${req.path}`;
    const currentCount = suspiciousPatterns.get(patternKey) || 0;
    suspiciousPatterns.set(patternKey, currentCount + 1);

    // Detect suspicious activity
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let flagged = false;

    if (currentCount > SUSPICIOUS_THRESHOLD) {
      riskLevel = 'high';
      flagged = true;
      
      logger.warn('Suspicious activity detected', {
        ipHash,
        path: req.path,
        requestCount: currentCount,
        timestamp: timestamp.toISOString()
      });
    }

    // Detect potential bot activity
    const botPatterns = [
      /bot/i,
      /crawl/i,
      /spider/i,
      /scrape/i,
      /scan/i
    ];

    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      riskLevel = 'medium';
      
      logger.info('Bot activity detected', {
        userAgentHash,
        path: req.path,
        timestamp: timestamp.toISOString()
      });
    }

    // Log audit entry for privacy-sensitive endpoints
    const privacySensitivePaths = [
      '/api/anonymous',
      '/api/consent',
      '/api/reports'
    ];

    if (privacySensitivePaths.some(path => req.path.startsWith(path))) {
      // Determine action based on path and method
      let action = 'unknown';
      
      if (req.path.includes('/consent')) {
        if (req.method === 'POST') action = 'consent_update';
        else if (req.method === 'GET') action = 'consent_check';
      } else if (req.path.includes('/anonymous')) {
        action = 'data_submission';
      } else if (req.path.includes('/reports')) {
        action = 'report_access';
      }

      // Create audit log entry (non-blocking)
      setImmediate(async () => {
        try {
          await PrivacyAudit.create({
            action,
            timestamp,
            details: {
              method: req.method,
              path: req.path,
              contentLength: req.get('Content-Length') || 0,
              apiKeyUsed: !!req.headers['x-api-key'],
              researchAccess: req.path.includes('/reports')
            },
            ipHash,
            userAgentHash,
            riskLevel,
            flagged,
            reviewRequired: flagged && riskLevel === 'high'
          });
        } catch (auditError) {
          logger.error('Failed to create audit log:', auditError);
        }
      });
    }

    // Add privacy metadata to request
    req.privacyAudit = {
      ipHash,
      userAgentHash,
      timestamp,
      riskLevel,
      flagged
    };

    next();
  } catch (error) {
    logger.error('Privacy audit middleware error:', error);
    // Don't block request on audit failure
    next();
  }
};

/**
 * Enhanced audit logging for specific privacy events
 */
export const auditPrivacyEvent = async (
  eventType: string,
  details: Record<string, any>,
  req?: Request,
  riskLevel: 'low' | 'medium' | 'high' = 'low'
) => {
  try {
    let ipHash = 'system';
    let userAgentHash = 'system';

    if (req) {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      ipHash = hashIpAddress(clientIp);
      userAgentHash = hashUserAgent(userAgent);
    }

    await PrivacyAudit.create({
      action: eventType,
      timestamp: new Date(),
      details,
      ipHash,
      userAgentHash,
      riskLevel,
      flagged: riskLevel === 'high',
      reviewRequired: riskLevel === 'high'
    });

    logger.info('Privacy event audited', {
      eventType,
      riskLevel,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to audit privacy event:', error);
  }
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      privacyAudit?: {
        ipHash: string;
        userAgentHash: string;
        timestamp: Date;
        riskLevel: 'low' | 'medium' | 'high';
        flagged: boolean;
      };
    }
  }
}
