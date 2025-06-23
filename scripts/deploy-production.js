#!/usr/bin/env node

/**
 * EAGLE PASS PRODUCTION DEPLOYMENT SCRIPT (Vercel)
 * 
 * This script deploys Eagle Pass to the production environment via Vercel
 * 
 * Usage: node scripts/deploy-production.js
 * 
 * ⚠️  WARNING: This deploys to PRODUCTION. Make sure you're ready!
 */

const { execSync } = require('child_process');

// Configuration
const PRODUCTION_PROJECT = 'eaglepass-prod';
const PRODUCTION_ENVIRONMENT = 'production';

console.log('🚀 Starting Eagle Pass PRODUCTION Deployment (Vercel)...');
console.log(`📋 Target Project: ${PRODUCTION_PROJECT}`);
console.log(`🌍 Environment: ${PRODUCTION_ENVIRONMENT}`);
console.log(`🏗️  Hosting: Vercel`);
console.log(`🗄️  Database: Firebase Firestore`);
console.log('\n⚠️  WARNING: This will deploy to PRODUCTION!');

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

// Step 3: Run full test suite
console.log('\n3️⃣ Running full test suite...');
try {
  execSync('npm run quality:full', { stdio: 'inherit' });
  console.log('✅ All quality checks passed');
} catch (error) {
  console.error('❌ Quality checks failed');
  process.exit(1);
}

// Step 4: Deploy Firebase services
console.log('\n4️⃣ Deploying Firebase services...');
try {
  // Switch to production Firebase project
  execSync(`firebase use ${PRODUCTION_PROJECT}`, { stdio: 'inherit' });
  console.log(`✅ Switched to ${PRODUCTION_PROJECT} Firebase project`);
  
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
console.log('\n5️⃣ Deploying to Vercel PRODUCTION...');
try {
  // Deploy to Vercel production
  execSync('vercel --prod', { stdio: 'inherit' });
  console.log('✅ Vercel production deployment completed successfully');
  
} catch (error) {
  console.error('❌ Vercel production deployment failed');
  process.exit(1);
}

// Step 6: Verify deployment
console.log('\n6️⃣ Verifying production deployment...');
try {
  // Get deployment URL
  const deploymentInfo = execSync('vercel ls', { encoding: 'utf8' });
  console.log('📋 Recent deployments:');
  console.log(deploymentInfo);
  
  console.log('\n🎉 PRODUCTION deployment completed successfully!');
  console.log(`🌐 Your production environment is now live on Vercel`);
  console.log(`🗄️  Firebase services are connected to ${PRODUCTION_PROJECT}`);
  console.log('\n📝 Post-deployment checklist:');
  console.log('   1. ✅ Verify all features work correctly');
  console.log('   2. ✅ Test FERPA compliance features');
  console.log('   3. ✅ Verify parent portal access');
  console.log('   4. ✅ Test notification system');
  console.log('   5. ✅ Monitor error logs');
  console.log('   6. ✅ Check performance metrics');
  console.log('   7. ✅ Notify stakeholders');
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

console.log('\n✅ Production deployment script completed!'); 