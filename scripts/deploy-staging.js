#!/usr/bin/env node

/**
 * EAGLE PASS STAGING DEPLOYMENT SCRIPT
 * 
 * This script deploys Eagle Pass to the staging environment (eaglepass-test)
 * 
 * Usage: node scripts/deploy-staging.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const STAGING_PROJECT = 'eaglepass-test';
const STAGING_ENVIRONMENT = 'staging';

console.log('🚀 Starting Eagle Pass Staging Deployment...');
console.log(`📋 Target Project: ${STAGING_PROJECT}`);
console.log(`🌍 Environment: ${STAGING_ENVIRONMENT}`);

// Step 1: Verify prerequisites
console.log('\n1️⃣ Checking prerequisites...');

try {
  // Check if Firebase CLI is installed
  execSync('firebase --version', { stdio: 'pipe' });
  console.log('✅ Firebase CLI is installed');
} catch (error) {
  console.error('❌ Firebase CLI is not installed. Please install it first:');
  console.error('   npm install -g firebase-tools');
  process.exit(1);
}

// Check if user is logged in
try {
  execSync('firebase projects:list', { stdio: 'pipe' });
  console.log('✅ Firebase CLI is authenticated');
} catch (error) {
  console.error('❌ Firebase CLI is not authenticated. Please login:');
  console.error('   firebase login');
  process.exit(1);
}

// Step 2: Build the application
console.log('\n2️⃣ Building application...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Step 3: Run tests
console.log('\n3️⃣ Running tests...');
try {
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ Tests passed');
} catch (error) {
  console.error('❌ Tests failed');
  process.exit(1);
}

// Step 4: Deploy to staging
console.log('\n4️⃣ Deploying to staging...');
try {
  // Deploy to staging project
  execSync(`firebase use ${STAGING_PROJECT}`, { stdio: 'inherit' });
  console.log(`✅ Switched to ${STAGING_PROJECT} project`);
  
  // Deploy hosting
  execSync('firebase deploy --only hosting', { stdio: 'inherit' });
  console.log('✅ Hosting deployed successfully');
  
  // Deploy functions
  execSync('firebase deploy --only functions', { stdio: 'inherit' });
  console.log('✅ Functions deployed successfully');
  
  // Deploy Firestore rules
  execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
  console.log('✅ Firestore rules deployed successfully');
  
  // Deploy Firestore indexes
  execSync('firebase deploy --only firestore:indexes', { stdio: 'inherit' });
  console.log('✅ Firestore indexes deployed successfully');
  
} catch (error) {
  console.error('❌ Deployment failed');
  process.exit(1);
}

// Step 5: Verify deployment
console.log('\n5️⃣ Verifying deployment...');
try {
  // Get hosting URL
  const hostingInfo = execSync('firebase hosting:channel:list', { encoding: 'utf8' });
  console.log('📋 Hosting channels:');
  console.log(hostingInfo);
  
  console.log('\n🎉 Staging deployment completed successfully!');
  console.log(`🌐 Your staging environment is now live at: https://${STAGING_PROJECT}.web.app`);
  console.log('\n📝 Next steps:');
  console.log('   1. Test the application manually');
  console.log('   2. Verify all features work correctly');
  console.log('   3. Check FERPA compliance features');
  console.log('   4. Test parent portal access');
  console.log('   5. Verify notification system');
  
} catch (error) {
  console.error('❌ Verification failed');
  process.exit(1);
}

console.log('\n✅ Staging deployment script completed!'); 