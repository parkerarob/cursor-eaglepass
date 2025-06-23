#!/usr/bin/env node

/**
 * EAGLE PASS STAGING DEPLOYMENT SCRIPT (Vercel)
 * 
 * This script deploys Eagle Pass to the staging environment via Vercel
 * 
 * Usage: node scripts/deploy-staging.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const STAGING_PROJECT = 'eaglepass-test';
const STAGING_ENVIRONMENT = 'staging';

console.log('🚀 Starting Eagle Pass Staging Deployment (Vercel)...');
console.log(`📋 Target Project: ${STAGING_PROJECT}`);
console.log(`🌍 Environment: ${STAGING_ENVIRONMENT}`);
console.log(`🏗️  Hosting: Vercel`);
console.log(`🗄️  Database: Firebase Firestore`);

// Step 1: Verify prerequisites
console.log('\n1️⃣ Checking prerequisites...');

try {
  // Check if Vercel CLI is installed
  execSync('vercel --version', { stdio: 'pipe' });
  console.log('✅ Vercel CLI is installed');
} catch (error) {
  console.error('❌ Vercel CLI is not installed. Please install it first:');
  console.error('   npm install -g vercel');
  process.exit(1);
}

// Check if user is logged in
try {
  execSync('vercel whoami', { stdio: 'pipe' });
  console.log('✅ Vercel CLI is authenticated');
} catch (error) {
  console.error('❌ Vercel CLI is not authenticated. Please login:');
  console.error('   vercel login');
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

// Step 4: Deploy Firebase services
console.log('\n4️⃣ Deploying Firebase services...');
try {
  // Switch to staging Firebase project
  execSync(`firebase use ${STAGING_PROJECT}`, { stdio: 'inherit' });
  console.log(`✅ Switched to ${STAGING_PROJECT} Firebase project`);
  
  // Deploy Firestore rules
  execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
  console.log('✅ Firestore rules deployed successfully');
  
  // Deploy Firestore indexes
  execSync('firebase deploy --only firestore:indexes', { stdio: 'inherit' });
  console.log('✅ Firestore indexes deployed successfully');
  
  // Deploy functions (if any)
  execSync('firebase deploy --only functions', { stdio: 'inherit' });
  console.log('✅ Firebase functions deployed successfully');
  
} catch (error) {
  console.error('❌ Firebase deployment failed');
  process.exit(1);
}

// Step 5: Deploy to Vercel
console.log('\n5️⃣ Deploying to Vercel...');
try {
  // Deploy to Vercel with staging environment
  execSync('vercel --prod', { stdio: 'inherit' });
  console.log('✅ Vercel deployment completed successfully');
  
} catch (error) {
  console.error('❌ Vercel deployment failed');
  process.exit(1);
}

// Step 6: Verify deployment
console.log('\n6️⃣ Verifying deployment...');
try {
  // Get deployment URL
  const deploymentInfo = execSync('vercel ls', { encoding: 'utf8' });
  console.log('📋 Recent deployments:');
  console.log(deploymentInfo);
  
  console.log('\n🎉 Staging deployment completed successfully!');
  console.log(`🌐 Your staging environment is now live on Vercel`);
  console.log(`🗄️  Firebase services are connected to ${STAGING_PROJECT}`);
  console.log('\n📝 Next steps:');
  console.log('   1. Test the application manually');
  console.log('   2. Verify all features work correctly');
  console.log('   3. Check FERPA compliance features');
  console.log('   4. Test parent portal access');
  console.log('   5. Verify notification system');
  console.log('\n🔧 Environment Variables:');
  console.log('   Make sure these are set in Vercel dashboard:');
  console.log('   - NEXT_PUBLIC_FIREBASE_API_KEY');
  console.log('   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  console.log('   - NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  console.log('   - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  console.log('   - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  console.log('   - NEXT_PUBLIC_FIREBASE_APP_ID');
  console.log('   - FIREBASE_PROJECT_ID');
  console.log('   - FIREBASE_CLIENT_EMAIL');
  console.log('   - FIREBASE_PRIVATE_KEY');
  
} catch (error) {
  console.error('❌ Verification failed');
  process.exit(1);
}

console.log('\n✅ Staging deployment script completed!'); 