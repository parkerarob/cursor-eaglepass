#!/usr/bin/env node

/**
 * Basic Functionality Test Script for Eagle Pass
 * 
 * This script helps test basic functionality by simulating user actions
 * and checking expected outcomes. It's designed to be run manually
 * during Phase 6 testing to validate core features.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  testTimeout: 30000, // 30 seconds
  retryAttempts: 3,
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

/**
 * Utility function to log test results
 */
function logTest(testName, status, message = '') {
  const timestamp = new Date().toISOString();
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  
  console.log(`${statusIcon} [${timestamp}] ${testName}: ${status}`);
  if (message) {
    console.log(`   ${message}`);
  }
  
  if (status === 'PASS') {
    testResults.passed++;
  } else if (status === 'FAIL') {
    testResults.failed++;
    testResults.errors.push({ test: testName, message });
  } else {
    testResults.skipped++;
  }
}

/**
 * Check if the application is running
 */
function checkAppRunning() {
  try {
    const response = execSync(`curl -s -o /dev/null -w "%{http_code}" ${TEST_CONFIG.baseUrl}`, { encoding: 'utf8' });
    return response.trim() === '200';
  } catch (error) {
    return false;
  }
}

/**
 * Test 1: Application Accessibility
 */
function testAppAccessibility() {
  logTest('Application Accessibility', 'INFO', 'Checking if application is accessible...');
  
  if (!checkAppRunning()) {
    logTest('Application Accessibility', 'FAIL', 'Application is not running or not accessible');
    return false;
  }
  
  logTest('Application Accessibility', 'PASS', 'Application is accessible');
  return true;
}

/**
 * Test 2: Environment Configuration
 */
function testEnvironmentConfiguration() {
  logTest('Environment Configuration', 'INFO', 'Checking environment variables...');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logTest('Environment Configuration', 'FAIL', `Missing environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  logTest('Environment Configuration', 'PASS', 'All required environment variables are set');
  return true;
}

/**
 * Test 3: Build Process
 */
function testBuildProcess() {
  logTest('Build Process', 'INFO', 'Testing build process...');
  
  try {
    execSync('npm run build', { stdio: 'pipe' });
    logTest('Build Process', 'PASS', 'Application builds successfully');
    return true;
  } catch (error) {
    logTest('Build Process', 'FAIL', 'Build process failed');
    return false;
  }
}

/**
 * Test 4: Test Suite
 */
function testTestSuite() {
  logTest('Test Suite', 'INFO', 'Running test suite...');
  
  try {
    execSync('npm test', { stdio: 'pipe' });
    logTest('Test Suite', 'PASS', 'All tests pass');
    return true;
  } catch (error) {
    logTest('Test Suite', 'FAIL', 'Some tests failed');
    return false;
  }
}

/**
 * Test 5: Linting
 */
function testLinting() {
  logTest('Linting', 'INFO', 'Running linting checks...');
  
  try {
    execSync('npm run lint', { stdio: 'pipe' });
    logTest('Linting', 'PASS', 'No linting errors found');
    return true;
  } catch (error) {
    logTest('Linting', 'FAIL', 'Linting errors found');
    return false;
  }
}

/**
 * Test 6: Type Checking
 */
function testTypeChecking() {
  logTest('Type Checking', 'INFO', 'Running TypeScript type checking...');
  
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    logTest('Type Checking', 'PASS', 'No TypeScript errors found');
    return true;
  } catch (error) {
    logTest('Type Checking', 'FAIL', 'TypeScript errors found');
    return false;
  }
}

/**
 * Test 7: File Structure
 */
function testFileStructure() {
  logTest('File Structure', 'INFO', 'Checking required files and directories...');
  
  const requiredFiles = [
    'src/app/page.tsx',
    'src/lib/stateMachine.ts',
    'src/lib/passService.ts',
    'src/components/PassStatus.tsx',
    'src/components/CreatePassForm.tsx',
    'src/lib/firebase/config.ts',
    'src/lib/firebase/auth.ts',
    'src/lib/firebase/firestore.ts',
    'src/types/index.ts',
    'package.json',
    'tsconfig.json',
    'next.config.ts'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    logTest('File Structure', 'FAIL', `Missing required files: ${missingFiles.join(', ')}`);
    return false;
  }
  
  logTest('File Structure', 'PASS', 'All required files present');
  return true;
}

/**
 * Test 8: Dependencies
 */
function testDependencies() {
  logTest('Dependencies', 'INFO', 'Checking package dependencies...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['next', 'react', 'firebase', 'typescript'];
    const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]);
    
    if (missingDeps.length > 0) {
      logTest('Dependencies', 'FAIL', `Missing required dependencies: ${missingDeps.join(', ')}`);
      return false;
    }
    
    logTest('Dependencies', 'PASS', 'All required dependencies present');
    return true;
  } catch (error) {
    logTest('Dependencies', 'FAIL', 'Error checking dependencies');
    return false;
  }
}

/**
 * Generate test report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('EAGLE PASS - BASIC FUNCTIONALITY TEST REPORT');
  console.log('='.repeat(60));
  
  console.log(`\nTest Results:`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏭️ Skipped: ${testResults.skipped}`);
  console.log(`📊 Total: ${testResults.passed + testResults.failed + testResults.skipped}`);
  
  if (testResults.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    testResults.errors.forEach(error => {
      console.log(`   - ${error.test}: ${error.message}`);
    });
  }
  
  const successRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1);
  console.log(`\n📈 Success Rate: ${successRate}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All basic functionality tests passed!');
    console.log('Ready for Phase 6 real-world testing.');
  } else {
    console.log('\n⚠️  Some tests failed. Please address issues before proceeding with Phase 6.');
  }
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Main test runner
 */
function runTests() {
  console.log('🚀 Starting Eagle Pass Basic Functionality Tests...\n');
  
  const tests = [
    testFileStructure,
    testDependencies,
    testEnvironmentConfiguration,
    testLinting,
    testTypeChecking,
    testTestSuite,
    testBuildProcess,
    testAppAccessibility
  ];
  
  tests.forEach(test => {
    try {
      test();
    } catch (error) {
      logTest(test.name, 'FAIL', `Test execution error: ${error.message}`);
    }
  });
  
  generateReport();
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  testResults,
  logTest
}; 