import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/auth.log' })
  ]
});

// Valid API keys (in production, store these securely)
const validApiKeys = new Set([
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_RESEARCH,
  process.env.API_KEY_FRONTEND
].filter(Boolean));

// Rate limiting per API key
const apiKeyUsage = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 1000; // requests per window

/**
 * Validate API key for anonymous data submission
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      logger.warn('API request without key', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        message: 'API key required'
      });
    }

    // Validate API key
    if (!validApiKeys.has(apiKey)) {
      logger.warn('Invalid API key attempt', {
        keyPrefix: apiKey.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    // Rate limiting per API key
    const now = Date.now();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
    const usage = apiKeyUsage.get(keyHash);
    
    if (!usage || now > usage.resetTime) {
      // Reset or initialize rate limit window
      apiKeyUsage.set(keyHash, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      });
    } else {
      // Check rate limit
      if (usage.count >= RATE_LIMIT_MAX) {
        logger.warn('API key rate limit exceeded', {
          keyHash,
          count: usage.count,
          ip: req.ip
        });
        
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded for this API key'
        });
      }
      
      usage.count++;
    }

    // Add API key info to request for logging
    req.apiKeyHash = keyHash;
    
    next();
  } catch (error) {
    logger.error('Error validating API key:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate research access for aggregated reports
 */
export const validateResearchAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const researchKey = process.env.API_KEY_RESEARCH;
    
    if (!apiKey || apiKey !== researchKey) {
      logger.warn('Unauthorized research access attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Research access required'
      });
    }

    next();
  } catch (error) {
    logger.error('Error validating research access:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate admin access for system operations
 */
export const validateAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminKey = req.headers['x-admin-key'] as string;
    const validAdminKey = process.env.ADMIN_KEY;
    
    if (!adminKey || !validAdminKey || adminKey !== validAdminKey) {
      logger.warn('Unauthorized admin access attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    logger.error('Error validating admin access:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      apiKeyHash?: string;
    }
  }
}
