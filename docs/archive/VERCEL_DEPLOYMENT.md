# Eagle Pass Vercel Deployment Guide

## Overview

Eagle Pass uses **Vercel for hosting** and **Firebase for backend services**. This guide explains how to deploy to different environments.

## Architecture

### Hosting & Deployment
- **Frontend**: Vercel (Next.js hosting)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Functions**: Firebase Functions (optional)
- **Environment Variables**: Vercel Dashboard

### Environment Structure
- **Development**: Local with emulators
- **Staging**: Vercel + Firebase `eaglepass-test`
- **Production**: Vercel + Firebase `eaglepass-prod`

## Prerequisites

### Required Tools
```bash
# Install Vercel CLI
npm install -g vercel

# Install Firebase CLI
npm install -g firebase-tools

# Login to both services
vercel login
firebase login
```

### Required Accounts
- **Vercel Account**: For hosting
- **Firebase Account**: For backend services
- **GitHub Account**: For code repository

## Environment Variables Setup

### Vercel Dashboard Configuration

#### 1. Go to Vercel Dashboard
- Visit: https://vercel.com/dashboard
- Select your Eagle Pass project

#### 2. Set Environment Variables
Go to **Settings** → **Environment Variables** and add:

**Client-side Variables (NEXT_PUBLIC_*)**
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_USE_EMULATOR=false
```

**Server-side Variables**
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
REDIS_URL=your_redis_url
FERPA_AUDIT_ENABLED=true
FERPA_RETENTION_DAYS=365
FERPA_ANONYMIZATION_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
NOTIFICATION_EMAIL_ENABLED=false
NOTIFICATION_SMS_ENABLED=false
NOTIFICATION_PUSH_ENABLED=false
```

#### 3. Environment-Specific Variables
- **Staging**: Use `eaglepass-test` Firebase project
- **Production**: Use `eaglepass-prod` Firebase project

## Deployment Process

### Quick Deployment Commands
```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# Manual Vercel deployment
vercel --prod
```

### Step-by-Step Deployment

#### 1. Build and Test
```bash
# Build the application
npm run build

# Run tests
npm test

# Run quality checks
npm run quality:full
```

#### 2. Deploy Firebase Services
```bash
# Switch to target Firebase project
firebase use eaglepass-test  # or eaglepass-prod

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Deploy functions (if any)
firebase deploy --only functions
```

#### 3. Deploy to Vercel
```bash
# Deploy to Vercel
vercel --prod
```

## Environment-Specific Setup

### Staging Environment (`eaglepass-test`)

#### Firebase Setup
1. **Create Firebase Project**: `eaglepass-test`
2. **Enable Services**:
   - Firestore Database
   - Authentication
   - Functions (if needed)
3. **Configure Firestore Rules**
4. **Set up Authentication Providers**

#### Vercel Setup
1. **Set Environment Variables** for staging
2. **Configure Domain** (optional)
3. **Set up Preview Deployments**

### Production Environment (`eaglepass-prod`)

#### Firebase Setup
1. **Create Firebase Project**: `eaglepass-prod`
2. **Enable Services**:
   - Firestore Database
   - Authentication
   - Functions (if needed)
3. **Configure Firestore Rules**
4. **Set up Authentication Providers**

#### Vercel Setup
1. **Set Environment Variables** for production
2. **Configure Custom Domain**
3. **Set up Monitoring**

## Deployment Scripts

### Staging Deployment
```bash
npm run deploy:staging
```

**What it does:**
1. ✅ Checks Vercel CLI installation
2. ✅ Builds the application
3. ✅ Runs tests
4. ✅ Deploys Firebase services to `eaglepass-test`
5. ✅ Deploys to Vercel
6. ✅ Verifies deployment

### Production Deployment
```bash
npm run deploy:production
```

**What it does:**
1. ✅ Checks Vercel CLI installation
2. ✅ Builds the application
3. ✅ Runs full quality checks
4. ✅ Deploys Firebase services to `eaglepass-prod`
5. ✅ Deploys to Vercel production
6. ✅ Verifies deployment

## Troubleshooting

### Common Issues

#### Vercel CLI Not Found
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login
```

#### Firebase CLI Not Found
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login
```

#### Environment Variables Missing
1. **Check Vercel Dashboard**: Settings → Environment Variables
2. **Verify Variable Names**: Must match exactly
3. **Check Environment**: Production vs Preview

#### Build Failures
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Try build again
npm run build
```

#### Firebase Connection Issues
1. **Check Project ID**: Must match Firebase project
2. **Verify API Key**: Must be from correct project
3. **Check Firestore Rules**: Must allow access

### Debugging Commands
```bash
# Check Vercel status
vercel whoami
vercel ls

# Check Firebase status
firebase projects:list
firebase use

# Check environment variables
vercel env ls
```

## Best Practices

### Before Deployment
1. ✅ **Test Locally**: Ensure everything works in development
2. ✅ **Run Tests**: All tests should pass
3. ✅ **Check Build**: Production build should succeed
4. ✅ **Verify Environment Variables**: All required variables set
5. ✅ **Review Changes**: Understand what's being deployed

### After Deployment
1. ✅ **Verify Deployment**: Check the Vercel URL
2. ✅ **Test Core Features**: Authentication, pass creation, etc.
3. ✅ **Check FERPA Compliance**: Audit logging, parent access
4. ✅ **Monitor Logs**: Check for errors
5. ✅ **Performance Check**: Ensure good load times

### Security Considerations
1. ✅ **Environment Variables**: Never commit secrets to git
2. ✅ **Firebase Rules**: Proper security rules in place
3. ✅ **Authentication**: Domain restrictions configured
4. ✅ **FERPA Compliance**: Audit logging enabled
5. ✅ **Rate Limiting**: Protection against abuse

## Monitoring and Maintenance

### Vercel Monitoring
- **Deployment Status**: Check Vercel dashboard
- **Performance**: Vercel Analytics
- **Error Tracking**: Vercel Error Tracking

### Firebase Monitoring
- **Firestore Usage**: Firebase console
- **Authentication**: User management
- **Functions**: Logs and performance

### FERPA Compliance
- **Audit Logs**: Check Firestore audit collection
- **Data Retention**: Verify retention policies
- **Access Controls**: Test parent portal access

---

## Quick Reference

### URLs
- **Staging**: `https://your-project.vercel.app` (or custom domain)
- **Production**: `https://your-project.vercel.app` (or custom domain)

### Commands
```bash
# Deploy staging
npm run deploy:staging

# Deploy production
npm run deploy:production

# Switch Firebase projects
npm run firebase:use:staging
npm run firebase:use:prod

# Local development
npm run dev
```

### Environment Variables Checklist
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `REDIS_URL`
- [ ] `FERPA_AUDIT_ENABLED`
- [ ] `RATE_LIMIT_ENABLED` 