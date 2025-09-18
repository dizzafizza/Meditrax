#!/usr/bin/env node

/**
 * Firebase Configuration Checker
 * Validates that all required Firebase environment variables are set
 */

const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID', 
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_VAPID_KEY'
];

const optionalVars = [
  'VITE_FIREBASE_MEASUREMENT_ID'
];

console.log('🔥 Firebase Configuration Checker\n');

let allRequired = true;
let warnings = [];

// Check required variables
console.log('📋 Required Configuration:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
    allRequired = false;
  }
});

console.log('\n📋 Optional Configuration:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`⚠️  ${varName}: Not set (optional)`);
    warnings.push(varName);
  }
});

console.log('\n📊 Summary:');
if (allRequired) {
  console.log('✅ All required Firebase environment variables are configured!');
  console.log('🚀 Firebase push notifications should work in production');
  
  if (warnings.length > 0) {
    console.log(`⚠️  Optional variables missing: ${warnings.join(', ')}`);
  }
  
  process.exit(0);
} else {
  console.log('❌ Missing required Firebase environment variables');
  console.log('🔧 Fix by setting missing variables in GitHub Secrets or .env file');
  console.log('\n📖 See GITHUB_SECRETS_SETUP.md for detailed instructions');
  process.exit(1);
}
