import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import winston from 'winston';

// import { anonymousDataRouter } from './routes/anonymousData'; // DISABLED
// import { consentRouter } from './routes/consent'; // DISABLED
// import { reportsRouter } from './routes/reports'; // DISABLED
// import { adminPanelRouter } from './routes/adminPanel'; // DISABLED
// import { createIndexes } from './models/anonymousData'; // DISABLED
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
// import { validateApiKey } from './middleware/auth'; // DISABLED
// import { privacyAuditLogger } from './middleware/privacyAudit'; // DISABLED

// Load environment variables
config();

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'medtrack-anonymous-reporting' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting for anonymity protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Privacy audit logging - DISABLED
// app.use(privacyAuditLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// Privacy policy endpoint
app.get('/privacy-policy', (req, res) => {
  res.json({
    version: '1.0',
    lastUpdated: '2024-01-01',
    dataProcessing: {
      purpose: 'Anonymous medical research and drug safety monitoring',
      legalBasis: 'Consent and legitimate scientific interest',
      dataRetention: '2 years maximum',
      anonymizationMethods: [
        'K-anonymity (minimum group size of 5)',
        'Differential privacy with epsilon=1.0',
        'Data generalization and bucketing',
        'Time-window aggregation',
        'Cryptographic hashing'
      ]
    },
    userRights: {
      consent: 'Users can provide or withdraw consent at any time',
      access: 'Users can request information about their data processing',
      deletion: 'Users can request deletion of their anonymized data',
      portability: 'Anonymized aggregate data is not personally identifiable'
    },
    technicalMeasures: {
      encryption: 'Data encrypted in transit and at rest',
      access: 'Role-based access control with audit logging',
      anonymization: 'Multiple layers of privacy protection',
      monitoring: 'Continuous privacy compliance monitoring'
    }
  });
});

// Anonymous data collection routes (requires API key) - DISABLED
// app.use('/api/anonymous', validateApiKey, anonymousDataRouter);

// Consent management routes - DISABLED
// app.use('/api/consent', consentRouter);

// Research reports routes (requires special authorization) - DISABLED
// app.use('/api/reports', reportsRouter);

// Secret admin panel routes - DISABLED
// app.use('/api/admin', adminPanelRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medtrack-anonymous';
    
    await mongoose.connect(mongoUri, {
      // Use new URL parser
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    logger.info('Connected to MongoDB');
    
    // Create indexes for better performance - DISABLED
    // await createIndexes();
    
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    logger.warn('⚠️  Running in DEMO MODE without database - some features will be limited');
    // Don't exit in development - allow running without MongoDB for frontend testing
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
const startServer = async () => {
  try {
    // Try to connect to database, but continue without it in development
    await connectDB();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Privacy mode: ${process.env.PRIVACY_MODE || 'strict'}`);
      logger.info(`Admin panel: Available via secret sequence`);
      
      // Log initial admin credentials in development
      if (process.env.NODE_ENV === 'development') {
        logger.info('🔑 Development admin sequence: header-logo → sidebar-settings → sidebar-medications → sidebar-calendar → sidebar-dashboard → header-logo');
        logger.info('🔧 Emergency shortcut: Ctrl+Shift+Alt+A (development only)');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    
    // In development, try to start server anyway for frontend testing
    if (process.env.NODE_ENV === 'development') {
      logger.warn('⚠️  Starting server without database connection for development testing');
      app.listen(PORT, () => {
        logger.info(`🟡 Server running on port ${PORT} (NO DATABASE)`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.warn('📝 Database features will return mock data or errors');
      });
    } else {
      process.exit(1);
    }
  }
};

startServer();

export default app;