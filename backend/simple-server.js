const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for the frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'development'
  });
});

// Mock consent endpoint for frontend testing
app.get('/api/consent/status/:userId', (req, res) => {
  res.json({
    success: true,
    data: {
      hasConsent: false,
      consentGiven: false,
      consentDate: new Date().toISOString(),
      preferences: {
        enabled: false,
        consentGiven: false,
        dataTypesAllowed: [],
        privacyLevel: 'minimal',
        granularControls: {
          includeAdherence: false,
          includeSideEffects: false,
          includeMedicationPatterns: false,
          includeRiskAssessments: false,
          allowTemporalAnalysis: false,
          allowDemographicAnalysis: false
        }
      }
    },
    message: 'Demo mode - no database connected'
  });
});

// Mock privacy info endpoint
app.get('/api/privacy-info', (req, res) => {
  res.json({
    success: true,
    privacyPolicy: {
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
      }
    }
  });
});

// Mock consent granting endpoint
app.post('/api/consent/grant', (req, res) => {
  res.json({
    success: true,
    message: 'Consent granted successfully (demo mode)',
    consentId: 'demo_consent_' + Date.now()
  });
});

// Mock anonymous data endpoint
app.post('/api/anonymous/*', (req, res) => {
  res.json({
    success: true,
    message: 'Demo mode - data would be stored in production'
  });
});

// Mock admin endpoints
app.get('/api/admin/*', (req, res) => {
  res.json({
    success: true,
    message: 'Demo mode - admin features available with MongoDB'
  });
});

// Catch all
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found - running in demo mode'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple backend server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`⚠️  Running in DEMO mode without database`);
  console.log(`🔧 Install MongoDB to enable full functionality`);
});
