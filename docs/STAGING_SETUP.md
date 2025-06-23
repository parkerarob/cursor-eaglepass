# Eagle Pass Staging Environment Setup

## Overview

The staging environment (`eaglepass-test`) is a pre-production environment that mirrors production but is used for testing and validation before deploying to the live system.

## Environment Configuration

### Firebase Projects
- **Development**: `eaglepass-dev` (current default)
- **Staging**: `eaglepass-test` (for testing)
- **Production**: `eaglepass-prod` (live system)

### Environment Variables

You'll need to set up environment variables for the staging environment. Create a `.env.staging` file (not committed to git) with:

```bash
# Staging Environment Configuration
# Firebase Project: eaglepass-test

# Firebase Public Variables (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_staging_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=eaglepass-test.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=eaglepass-test
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=eaglepass-test.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_staging_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_staging_app_id

# Firebase Private Variables (Server-side)
FIREBASE_PROJECT_ID=eaglepass-test
FIREBASE_CLIENT_EMAIL=your_staging_client_email
FIREBASE_PRIVATE_KEY=your_staging_private_key

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Environment Flags
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_USE_EMULATOR=false

# FERPA Configuration
FERPA_AUDIT_ENABLED=true
FERPA_RETENTION_DAYS=365
FERPA_ANONYMIZATION_ENABLED=true

# Security Configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Notification Configuration
NOTIFICATION_EMAIL_ENABLED=false
NOTIFICATION_SMS_ENABLED=false
NOTIFICATION_PUSH_ENABLED=false
```

## Deployment Commands

### Quick Commands
```bash
# Deploy to staging
npm run deploy:staging

# Switch Firebase project to staging
npm run firebase:use:staging

# Switch Firebase project to development
npm run firebase:use:dev

# Switch Firebase project to production
npm run firebase:use:prod
```

### Manual Deployment Steps
```bash
# 1. Switch to staging project
firebase use eaglepass-test

# 2. Build the application
npm run build

# 3. Run tests
npm test

# 4. Deploy hosting
firebase deploy --only hosting

# 5. Deploy functions
firebase deploy --only functions

# 6. Deploy Firestore rules
firebase deploy --only firestore:rules

# 7. Deploy Firestore indexes
firebase deploy --only firestore:indexes
```

## Staging Environment Features

### What's Different from Development
- **Real Firebase Project**: Uses `eaglepass-test` instead of emulators
- **Production Build**: Optimized for performance
- **Real Data**: Can use test data that mirrors production
- **External Access**: Can be accessed by stakeholders for testing

### What's Different from Production
- **Test Data**: Safe to use test/sample data
- **Debugging Enabled**: More verbose logging
- **No Real Users**: Won't affect actual school operations
- **Faster Updates**: Can deploy more frequently

## Testing Checklist

### Pre-Deployment Testing
- [ ] All tests pass locally
- [ ] Build completes successfully
- [ ] No linter errors
- [ ] Security audit passes
- [ ] FERPA compliance verified

### Post-Deployment Testing
- [ ] Application loads correctly
- [ ] Authentication works
- [ ] Pass creation/management works
- [ ] Parent portal access works
- [ ] FERPA audit logging works
- [ ] Notifications work (if enabled)
- [ ] Admin features work
- [ ] Error handling works

### User Acceptance Testing
- [ ] Teachers can create passes
- [ ] Students can use passes
- [ ] Parents can access portal
- [ ] Admins can manage system
- [ ] Reports generate correctly
- [ ] Emergency features work

## Troubleshooting

### Common Issues

#### Firebase Project Not Found
```bash
# Check available projects
firebase projects:list

# Login if needed
firebase login
```

#### Environment Variables Missing
```bash
# Check if variables are set
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID

# Set them manually if needed
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=eaglepass-test
```

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

#### Deployment Failures
```bash
# Check Firebase CLI version
firebase --version

# Update Firebase CLI
npm install -g firebase-tools

# Check project access
firebase projects:list
```

## Best Practices

### Before Deploying to Staging
1. **Test Locally**: Ensure everything works in development
2. **Run Full Test Suite**: All tests should pass
3. **Check Build**: Production build should succeed
4. **Review Changes**: Understand what's being deployed
5. **Update Documentation**: Document any new features

### After Deploying to Staging
1. **Verify Deployment**: Check the staging URL
2. **Run Smoke Tests**: Basic functionality tests
3. **Test Critical Paths**: Core user workflows
4. **Check Logs**: Monitor for errors
5. **Notify Stakeholders**: Let them know it's ready for testing

### Before Promoting to Production
1. **Stakeholder Approval**: Get sign-off from users
2. **Performance Testing**: Ensure it handles expected load
3. **Security Review**: Final security check
4. **Backup Plan**: Know how to rollback if needed
5. **Monitoring Setup**: Ensure production monitoring is ready

## URLs

- **Staging**: https://eaglepass-test.web.app
- **Development**: http://localhost:3000 (with emulators)
- **Production**: https://eaglepass-prod.web.app (when ready)

## Support

If you encounter issues with the staging environment:

1. Check the troubleshooting section above
2. Review Firebase console logs
3. Check application error logs
4. Verify environment variables
5. Contact the development team

---

**Remember**: Staging is for testing and validation. Never use real student data in staging unless it's properly anonymized and you have permission. 