# Troubleshooting Guide

This guide helps diagnose and resolve common issues in the Eagle Pass system.

## Table of Contents
1. [Build & Development Issues](#build--development-issues)
2. [Firebase & Authentication](#firebase--authentication)
3. [FERPA Compliance Issues](#ferpa-compliance-issues)
4. [Runtime Errors](#runtime-errors)
5. [Performance Problems](#performance-problems)
6. [Data Issues](#data-issues)

## Build & Development Issues

### ESLint Warnings/Errors

**Problem:** Build fails with ESLint errors
```
Type error: 'student.emergencyContacts.length' is possibly 'undefined'.
```

**Solution:**
```typescript
// Add proper null checks
if (student && student.emergencyContacts && student.emergencyContacts.length > 0) {
  // Safe to access
}
```

### TypeScript Type Errors

**Problem:** TypeScript compilation errors
```
Type 'any' is not assignable to type 'User'
```

**Solution:**
1. Replace `any` with proper types
2. Use `unknown` for truly dynamic data
3. Add type assertions when necessary:
```typescript
const user = data as User;
```

### Module Not Found

**Problem:** Cannot find module errors
```
Module not found: Can't resolve '@/components/SomeComponent'
```

**Solution:**
1. Check file exists at path
2. Verify import path matches file location
3. Check `tsconfig.json` path aliases:
```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

## Firebase & Authentication

### Firebase Not Initialized

**Problem:** Firebase app not initialized error

**Solution:**
1. Check `.env.local` has all required variables:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
```

2. Verify Firebase config in `/src/lib/firebase/config.ts`

### Authentication Failed

**Problem:** User cannot log in

**Solution:**
1. Check Firebase Console for user status
2. Verify authentication is enabled
3. Check browser console for specific errors
4. Clear browser cache/cookies

### Permission Denied (Firestore)

**Problem:** Firestore permission denied errors

**Solution:**
1. Check `firestore.rules` for correct permissions
2. Verify user role matches required permissions
3. Test rules in Firebase Console Rules Playground
4. Deploy updated rules: `firebase deploy --only firestore:rules`

## FERPA Compliance Issues

### Audit Logs Not Recording

**Problem:** FERPA audit logs missing

**Solution:**
1. Check `ferpaAuditLogger.ts` is imported
2. Verify Firestore collection exists
3. Check for errors in console
4. Ensure proper error handling:
```typescript
try {
  await FERPAAuditLogger.logRecordAccess(...);
} catch (error) {
  console.error('Audit logging failed:', error);
  // Don't block operation, but log issue
}
```

### Parent Access Denied

**Problem:** Parent cannot access child's records

**Solution:**
1. Verify parent-student relationship exists:
```typescript
const relationship = await ParentAccessService.verifyParentStudentRelationship(parentId, studentId);
```

2. Check access request is approved
3. Verify FERPA compliance setup
4. Check audit logs for denied access attempts

### Data Retention Not Running

**Problem:** Old data not being cleaned up

**Solution:**
1. Check `dataRetentionService.ts` is initialized
2. Run manual cleanup:
```bash
npm run script:cleanup
```
3. Verify retention policies in code
4. Check Firestore for retention markers

## Runtime Errors

### Timestamp Conversion Errors

**Problem:** Cannot read property 'toDate' of undefined

**Solution:**
```typescript
// Always check timestamp exists
const date = data.timestamp ? data.timestamp.toDate() : new Date();

// Or use optional chaining
const date = data.timestamp?.toDate() ?? new Date();
```

### Null Reference Errors

**Problem:** Cannot read properties of null/undefined

**Solution:**
1. Add defensive checks:
```typescript
if (!user) {
  throw new Error('User not found');
}
```

2. Use optional chaining:
```typescript
const email = user?.emergencyContacts?.[0]?.email;
```

### State Update Errors

**Problem:** Cannot update state on unmounted component

**Solution:**
```typescript
useEffect(() => {
  let mounted = true;
  
  fetchData().then(data => {
    if (mounted) {
      setData(data);
    }
  });
  
  return () => { mounted = false; };
}, []);
```

## Performance Problems

### Slow Page Load

**Problem:** Pages loading slowly

**Solution:**
1. Check for unbounded queries:
```typescript
// Bad
const allPasses = await getDocs(collection(db, 'passes'));

// Good
const recentPasses = await getDocs(
  query(collection(db, 'passes'), 
    orderBy('createdAt', 'desc'), 
    limit(50)
  )
);
```

2. Implement pagination
3. Use React.memo for expensive components
4. Check bundle size: `npm run analyze`

### Memory Leaks

**Problem:** Browser memory usage increases over time

**Solution:**
1. Clean up event listeners
2. Cancel ongoing requests
3. Clear intervals/timeouts
4. Unsubscribe from Firestore listeners:
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    // Handle updates
  });
  
  return unsubscribe; // Cleanup
}, []);
```

## Data Issues

### Duplicate Records

**Problem:** Multiple passes created for same student

**Solution:**
1. Implement idempotency checks
2. Use transactions for critical operations:
```typescript
await runTransaction(db, async (transaction) => {
  // Check for existing pass
  // Create new pass if none exists
});
```

### Missing Required Fields

**Problem:** Documents missing required fields

**Solution:**
1. Add validation before saving:
```typescript
if (!pass.studentId || !pass.destination) {
  throw new Error('Missing required fields');
}
```

2. Set defaults for optional fields
3. Run data migration scripts if needed

### Incorrect Data Types

**Problem:** Data type mismatches in Firestore

**Solution:**
1. Always validate data types
2. Use consistent date handling:
```typescript
// Saving
createdAt: Timestamp.fromDate(new Date())

// Reading
createdAt: doc.data().createdAt.toDate()
```

## Quick Fixes

### Clear Local Storage
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
```

### Reset Firebase Emulator
```bash
# Kill emulator processes
firebase emulators:export ./backup
firebase emulators:start --import=./backup
```

### Force Rebuild
```bash
rm -rf .next
rm -rf node_modules/.cache
npm run build
```

### Check System Status
```typescript
// In browser console
const status = await FERPAService.healthCheck();
console.log(status);
```

## Debug Mode

Enable debug logging:
```typescript
// In browser console
localStorage.setItem('debug', 'true');
```

View all Firestore operations:
```typescript
// Add to firebase config
if (process.env.NODE_ENV === 'development') {
  enableLogging(true);
}
```

## Getting Help

1. Check error message in browser console
2. Search codebase for error text
3. Review relevant documentation
4. Check Firebase Console for service issues
5. Review recent commits for breaking changes

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "User not found" | Invalid user ID | Verify user exists in Firestore |
| "Permission denied" | Insufficient role permissions | Check user role and firestore.rules |
| "Invalid pass state" | State machine violation | Review pass status and transitions |
| "Notification failed" | Service configuration issue | Check NotificationService setup |
| "FERPA violation detected" | Unauthorized access attempt | Review audit logs and permissions | 