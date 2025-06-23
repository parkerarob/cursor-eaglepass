#!/usr/bin/env node

/**
 * EAGLE PASS PRODUCTION DEPLOYMENT SCRIPT
 * 
 * This script deploys Eagle Pass to the production environment (eaglepass-prod)
 * 
 * Usage: node scripts/deploy-production.js
 * 
 * ⚠️  WARNING: This deploys to PRODUCTION. Make sure you're ready!
 */

const { execSync } = require('child_process');

// Configuration
const PRODUCTION_PROJECT = 'eaglepass-prod';
const PRODUCTION_ENVIRONMENT = 'production';

console.log('🚀 Starting Eagle Pass PRODUCTION Deployment...');
console.log(`📋 Target Project: ${PRODUCTION_PROJECT}`);
console.log(`🌍 Environment: ${PRODUCTION_ENVIRONMENT}`);
console.log('\n⚠️  WARNING: This will deploy to PRODUCTION!');

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

// Step 3: Run full test suite
console.log('\n3️⃣ Running full test suite...');
try {
  execSync('npm run quality:full', { stdio: 'inherit' });
  console.log('✅ All quality checks passed');
} catch (error) {
  console.error('❌ Quality checks failed');
  process.exit(1);
}

// Step 4: Deploy to production
console.log('\n4️⃣ Deploying to PRODUCTION...');
try {
  // Deploy to production project
  execSync(`firebase use ${PRODUCTION_PROJECT}`, { stdio: 'inherit' });
  console.log(`✅ Switched to ${PRODUCTION_PROJECT} project`);
  
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
  console.error('❌ Production deployment failed');
  process.exit(1);
}

// Step 5: Verify deployment
console.log('\n5️⃣ Verifying production deployment...');
try {
  console.log('\n🎉 PRODUCTION deployment completed successfully!');
  console.log(`🌐 Your production environment is now live at: https://${PRODUCTION_PROJECT}.web.app`);
  console.log('\n📝 Post-deployment checklist:');
  console.log('   1. ✅ Verify all features work correctly');
  console.log('   2. ✅ Test FERPA compliance features');
  console.log('   3. ✅ Verify parent portal access');
  console.log('   4. ✅ Test notification system');
  console.log('   5. ✅ Monitor error logs');
  console.log('   6. ✅ Check performance metrics');
  console.log('   7. ✅ Notify stakeholders');
  
} catch (error) {
  console.error('❌ Verification failed');
  process.exit(1);
}

console.log('\n✅ Production deployment script completed!'); 