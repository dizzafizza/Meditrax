import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log' })
  ]
});

/**
 * Generic error handler middleware
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = 500;
  let message = 'Internal server error';
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDevelopment && { 
      error: error.message,
      stack: error.stack 
    })
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  logger.warn('404 Not Found:', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.url
  });
};
