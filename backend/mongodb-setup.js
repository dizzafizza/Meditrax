/**
 * MongoDB Configuration Script for MedTrack Anonymous Reporting System
 * Run this script to set up the database with proper indexes, security, and initial data
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medtrack-anonymous';

async function setupMongoDB() {
  let client;
  
  try {
    console.log('🔧 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    console.log('✅ Connected to MongoDB successfully');

    // Create collections with validation schemas
    await createCollections(db);
    
    // Create indexes for performance
    await createIndexes(db);
    
    // Set up TTL (Time To Live) indexes for data expiration
    await setupDataExpiration(db);
    
    // Create initial admin user
    await createInitialAdmin(db);
    
    // Insert sample aggregation data for testing
    await insertSampleData(db);
    
    console.log('🎉 MongoDB setup completed successfully!');
    
  } catch (error) {
    console.error('❌ MongoDB setup failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function createCollections(db) {
  console.log('📦 Creating collections with validation schemas...');

  // Anonymous Data Collection with schema validation
  try {
    await db.createCollection('anonymousdata', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['timeWindow', 'userSegmentHash', 'dataType', 'metrics', 'noiseLevel', 'kAnonymityLevel', 'submissionWindow'],
          properties: {
            timeWindow: {
              bsonType: 'string',
              description: 'Time window for aggregation (e.g., 2024-W01)'
            },
            weekday: {
              bsonType: 'int',
              minimum: 0,
              maximum: 6,
              description: 'Day of week (0-6)'
            },
            timeOfDay: {
              enum: ['morning', 'afternoon', 'evening', 'night'],
              description: 'Time of day categorization'
            },
            regionCode: {
              bsonType: 'string',
              maxLength: 10,
              description: 'Geographic region code'
            },
            timezoneOffset: {
              bsonType: 'int',
              minimum: -12,
              maximum: 14,
              description: 'Timezone offset from UTC'
            },
            userSegmentHash: {
              bsonType: 'string',
              minLength: 16,
              maxLength: 64,
              description: 'Anonymized user segment identifier'
            },
            demographicGroup: {
              bsonType: 'string',
              maxLength: 50,
              description: 'Anonymized demographic grouping'
            },
            dataType: {
              enum: ['adherence', 'side_effect', 'medication_pattern', 'risk_assessment'],
              description: 'Type of anonymized data'
            },
            metrics: {
              bsonType: 'object',
              description: 'Anonymized metrics data'
            },
            noiseLevel: {
              bsonType: 'double',
              minimum: 0,
              description: 'Amount of differential privacy noise added'
            },
            kAnonymityLevel: {
              bsonType: 'int',
              minimum: 1,
              description: 'K-anonymity level for this data point'
            },
            submissionWindow: {
              bsonType: 'string',
              description: 'Time window when data was submitted'
            },
            privacyValidated: {
              bsonType: 'bool',
              description: 'Whether privacy validation passed'
            },
            validationScore: {
              bsonType: 'double',
              minimum: 0,
              maximum: 100,
              description: 'Privacy validation score'
            }
          }
        }
      }
    });
    console.log('  ✅ anonymousdata collection created');
  } catch (error) {
    if (error.code !== 48) { // Collection already exists
      throw error;
    }
    console.log('  ℹ️  anonymousdata collection already exists');
  }

  // Consent Collection
  try {
    await db.createCollection('consents', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userIdHash', 'consentGiven', 'consentDate'],
          properties: {
            userIdHash: {
              bsonType: 'string',
              minLength: 32,
              maxLength: 64,
              description: 'Hashed user identifier'
            },
            consentGiven: {
              bsonType: 'bool',
              description: 'Whether consent is granted'
            },
            consentDate: {
              bsonType: 'date',
              description: 'Date consent was granted'
            },
            dataTypesAllowed: {
              bsonType: 'array',
              items: {
                enum: ['adherence', 'side_effects', 'medication_patterns', 'risk_assessments']
              },
              description: 'Types of data user consented to share'
            },
            privacyLevel: {
              enum: ['minimal', 'standard', 'detailed'],
              description: 'Level of privacy protection requested'
            },
            revokeDate: {
              bsonType: ['date', 'null'],
              description: 'Date consent was revoked, if applicable'
            }
          }
        }
      }
    });
    console.log('  ✅ consents collection created');
  } catch (error) {
    if (error.code !== 48) {
      throw error;
    }
    console.log('  ℹ️  consents collection already exists');
  }

  // Admin Users Collection (for secret admin panel)
  try {
    await db.createCollection('adminusers', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['username', 'passwordHash', 'accessLevel', 'isActive'],
          properties: {
            username: {
              bsonType: 'string',
              minLength: 3,
              maxLength: 50,
              description: 'Admin username'
            },
            passwordHash: {
              bsonType: 'string',
              minLength: 60,
              description: 'Bcrypt hashed password'
            },
            accessLevel: {
              enum: ['research', 'admin', 'superadmin'],
              description: 'Level of access granted'
            },
            isActive: {
              bsonType: 'bool',
              description: 'Whether account is active'
            },
            lastLogin: {
              bsonType: ['date', 'null'],
              description: 'Last login timestamp'
            },
            secretSequence: {
              bsonType: 'string',
              description: 'Encrypted UI sequence for admin access'
            }
          }
        }
      }
    });
    console.log('  ✅ adminusers collection created');
  } catch (error) {
    if (error.code !== 48) {
      throw error;
    }
    console.log('  ℹ️  adminusers collection already exists');
  }
}

async function createIndexes(db) {
  console.log('🔍 Creating database indexes...');

  // Anonymous Data indexes
  await db.collection('anonymousdata').createIndexes([
    { key: { timeWindow: 1, dataType: 1 }, background: true },
    { key: { userSegmentHash: 1, submissionWindow: 1 }, background: true },
    { key: { dataType: 1, privacyValidated: 1 }, background: true },
    { key: { kAnonymityLevel: 1, noiseLevel: 1 }, background: true },
    { key: { 'metrics.medicationCategory': 1 }, background: true, sparse: true },
    { key: { createdAt: 1 }, background: true }
  ]);
  console.log('  ✅ anonymousdata indexes created');

  // Consent indexes
  await db.collection('consents').createIndexes([
    { key: { userIdHash: 1 }, unique: true, background: true },
    { key: { consentGiven: 1, revokeDate: 1 }, background: true },
    { key: { consentDate: 1 }, background: true },
    { key: { privacyLevel: 1 }, background: true }
  ]);
  console.log('  ✅ consents indexes created');

  // Aggregated Reports indexes
  await db.collection('aggregatedreports').createIndexes([
    { key: { reportType: 1, 'timeRange.start': 1 }, background: true },
    { key: { generatedAt: 1 }, background: true },
    { key: { accessLevel: 1 }, background: true },
    { key: { reportId: 1 }, unique: true, background: true }
  ]);
  console.log('  ✅ aggregatedreports indexes created');

  // Privacy Audit indexes
  await db.collection('privacyaudits').createIndexes([
    { key: { timestamp: 1 }, background: true },
    { key: { action: 1, timestamp: 1 }, background: true },
    { key: { flagged: 1, reviewRequired: 1 }, background: true },
    { key: { riskLevel: 1 }, background: true }
  ]);
  console.log('  ✅ privacyaudits indexes created');

  // Admin Users indexes
  await db.collection('adminusers').createIndexes([
    { key: { username: 1 }, unique: true, background: true },
    { key: { isActive: 1 }, background: true },
    { key: { accessLevel: 1 }, background: true }
  ]);
  console.log('  ✅ adminusers indexes created');
}

async function setupDataExpiration(db) {
  console.log('⏰ Setting up data expiration policies...');

  // Anonymous data expires after 2 years
  await db.collection('anonymousdata').createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 63072000, background: true } // 2 years
  );

  // Privacy audit logs expire after 7 years (compliance requirement)
  await db.collection('privacyaudits').createIndex(
    { timestamp: 1 },
    { expireAfterSeconds: 220752000, background: true } // 7 years
  );

  console.log('  ✅ Data expiration policies configured');
}

async function createInitialAdmin(db) {
  console.log('👤 Creating initial admin user...');

  const bcrypt = require('bcrypt');
  const crypto = require('crypto');

  // Generate a secure admin password
  const adminPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Create encrypted secret sequence (will be used for UI pattern access)
  const secretSequence = 'header-logo-settings-medications-calendar-dashboard-logo';
  const encryptedSequence = crypto.createHmac('sha256', process.env.ADMIN_SECRET || 'default-admin-secret')
    .update(secretSequence)
    .digest('hex');

  const adminUser = {
    username: 'system_admin',
    passwordHash,
    accessLevel: 'superadmin',
    isActive: true,
    createdAt: new Date(),
    lastLogin: null,
    secretSequence: encryptedSequence,
    permissions: [
      'view_all_data',
      'generate_reports',
      'manage_users',
      'view_audit_logs',
      'export_data',
      'system_configuration'
    ]
  };

  try {
    await db.collection('adminusers').insertOne(adminUser);
    console.log('  ✅ Initial admin user created');
    console.log(`  🔑 Admin Password: ${adminPassword}`);
    console.log(`  🔐 Secret UI Sequence: ${secretSequence}`);
    console.log('  ⚠️  SAVE THESE CREDENTIALS SECURELY!');
  } catch (error) {
    if (error.code === 11000) {
      console.log('  ℹ️  Admin user already exists');
    } else {
      throw error;
    }
  }
}

async function insertSampleData(db) {
  console.log('📊 Inserting sample data for testing...');

  // Sample anonymous data points
  const sampleData = [
    {
      timeWindow: '2024-W01',
      weekday: 1,
      timeOfDay: 'morning',
      userSegmentHash: 'abcd1234567890ef',
      dataType: 'adherence',
      metrics: {
        medicationCategory: 'ANTIDEPRESSANT',
        dosageFrequency: 'daily',
        adherenceRate: 87.5,
        missedDosePattern: 'weekend'
      },
      noiseLevel: 0.1,
      kAnonymityLevel: 8,
      submissionWindow: '2024-W01',
      privacyValidated: true,
      validationScore: 95,
      createdAt: new Date(),
      processedAt: new Date()
    },
    {
      timeWindow: '2024-W01',
      weekday: 3,
      timeOfDay: 'evening',
      userSegmentHash: 'efgh5678901234ab',
      dataType: 'side_effect',
      metrics: {
        medicationCategory: 'BETA_BLOCKER',
        riskLevel: 'moderate',
        sideEffectCategory: 'cardiovascular',
        severityLevel: 'mild',
        onsetPattern: 'gradual'
      },
      noiseLevel: 0.1,
      kAnonymityLevel: 6,
      submissionWindow: '2024-W01',
      privacyValidated: true,
      validationScore: 92,
      createdAt: new Date(),
      processedAt: new Date()
    }
  ];

  try {
    await db.collection('anonymousdata').insertMany(sampleData);
    console.log('  ✅ Sample anonymous data inserted');
  } catch (error) {
    console.log('  ℹ️  Sample data may already exist');
  }

  // Sample aggregated report
  const sampleReport = {
    reportId: `sample-adherence-${Date.now()}`,
    reportType: 'adherence',
    timeRange: {
      start: '2024-W01',
      end: '2024-W04'
    },
    sampleSize: 127,
    confidenceInterval: 0.95,
    data: {
      summary: {
        averageAdherence: 82.3,
        medicationCategories: 8,
        totalSamples: 127
      },
      byCategory: {
        'ANTIDEPRESSANT': { adherenceRate: 87.5, sampleSize: 23 },
        'BETA_BLOCKER': { adherenceRate: 79.2, sampleSize: 18 },
        'DIABETES_MEDICATION': { adherenceRate: 91.1, sampleSize: 31 }
      }
    },
    dataQualityScore: 88,
    privacyScore: 95,
    completenessScore: 92,
    generatedAt: new Date(),
    accessLevel: 'research'
  };

  try {
    await db.collection('aggregatedreports').insertOne(sampleReport);
    console.log('  ✅ Sample aggregated report inserted');
  } catch (error) {
    console.log('  ℹ️  Sample report may already exist');
  }
}

// Run the setup
if (require.main === module) {
  setupMongoDB()
    .then(() => {
      console.log('🎉 MongoDB setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupMongoDB };
