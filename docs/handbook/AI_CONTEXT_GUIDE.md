# AI Context Guide for Eagle Pass System

This guide provides essential context for AI assistants (like Cursor AI) to understand the codebase structure, make informed changes, and avoid common pitfalls.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Key Data Models](#key-data-models)
4. [Critical Services](#critical-services)
5. [Security & Compliance](#security--compliance)
6. [Common Patterns](#common-patterns)
7. [Known Issues & Gotchas](#known-issues--gotchas)
8. [Testing Guidelines](#testing-guidelines)
9. [Deployment Checklist](#deployment-checklist)

## Project Overview

**Eagle Pass** is a school safety system for managing student hall passes with FERPA compliance.

### Core Features
- Digital hall pass creation and tracking
- Real-time student location monitoring
- FERPA-compliant data handling
- Parent access portal
- Notification system for extended passes
- Comprehensive audit logging

### User Roles
- **Students**: Can have passes created for them
- **Teachers**: Create/manage passes, view students
- **Admins**: Full system access, reports, FERPA compliance
- **Parents**: View their child's records (FERPA-compliant)

## Architecture & Tech Stack

### Frontend
- **Framework**: Next.js 15.3.4 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: Custom UI components + shadcn/ui
- **State Management**: React hooks + Context API

### Backend
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Vercel
- **Environment**: Node.js

### Key Dependencies
```json
{
  "next": "15.3.4",
  "react": "^18",
  "firebase": "^10.7.1",
  "@radix-ui/*": "UI primitives",
  "tailwindcss": "^3.4.1"
}
```

## Key Data Models

### User Model (`/src/types/index.ts`)
```typescript
interface User {
  id: string;
  name?: string; // Deprecated, use firstName/lastName
  firstName?: string;
  lastName?: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'dev';
  assignedLocationId?: string;
  emergencyContacts?: EmergencyContact[];
}
```

### Pass Model
```typescript
interface Pass {
  id: string;
  studentId: string;
  status: 'OPEN' | 'CLOSED' | 'PENDING_APPROVAL';
  createdAt: Date;
  legs: Leg[]; // Movement history
  durationMinutes?: number;
  notificationLevel?: 'none' | 'student' | 'teacher' | 'admin';
}
```

### FERPA-Specific Models
- `ParentAccessRequest`: Tracks parent record requests
- `EmergencyDisclosure`: Documents emergency info sharing
- `FERPAAuditLog`: Comprehensive access logging

## Critical Services

### 1. FERPA Compliance Services (`/src/lib/`)
- **ferpaService.ts**: Central FERPA coordination
- **ferpaAuditLogger.ts**: Audit trail management
- **dataRetentionService.ts**: Automated data cleanup
- **emergencyDisclosureManager.ts**: Emergency disclosure tracking
- **parentAccessService.ts**: Parent portal API

### 2. Core Business Logic
- **passService.ts**: Pass creation/management
- **stateMachine.ts**: Pass state transitions
- **notificationService.ts**: Alert system
- **policyEngine.ts**: Permission rules

### 3. Firebase Services (`/src/lib/firebase/`)
- **firestore.ts**: Database operations
- **auth.ts**: Authentication logic
- **config.ts**: Firebase configuration

### 4. Security Services
- **rateLimiter.redis.ts**: Persistent Redis-based rate limiting
- **rateLimiter.ts**: In-memory rate limiting fallback
- **security.test.ts**: Security validation tests

## Security & Compliance

### Rate Limiting (TASK-002 ✅ COMPLETE)
- **Primary**: Redis-based persistent rate limiting (`rateLimiter.redis.ts`)
- **Fallback**: In-memory rate limiting for graceful degradation
- **API Endpoint**: `/api/rate-limit` for server-side enforcement
- **Security**: Fail-secure behavior, rate limits survive server restarts
- **Architecture**: Clean client/server separation to avoid bundling conflicts

### FERPA Requirements
1. **Audit Everything**: All data access must be logged
2. **Parent Rights**: Parents can request/review records
3. **Data Retention**: Automated cleanup per policy
4. **Emergency Disclosure**: Special handling required

### Security Rules (`firestore.rules`)
- Role-based access control
- Parent-student relationship verification
- Admin override capabilities
- Audit log protection

### Environment Variables
```env
# Required in .env.local
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# Redis Configuration (for rate limiting)
REDIS_URL=redis://localhost:6379  # Or Redis Cloud/AWS ElastiCache URL
```

## Common Patterns

### 1. Type Safety
- Always use TypeScript types, avoid `any`
- Import types from `@/types` or define locally
- Use `unknown` for truly dynamic data

### 2. Error Handling
```typescript
try {
  // Operation
} catch (error) {
  console.error('ServiceName: Error description:', error);
  // Log to monitoring service if critical
  throw error; // Re-throw if caller needs to handle
}
```

### 3. Firestore Operations
- Always convert Timestamps to Dates when reading
- Use transactions for multi-document updates
- Implement proper error handling

### 4. Component Structure
- Use server components by default
- Add 'use client' only when needed
- Separate logic from presentation

## Known Issues & Gotchas

### 1. TypeScript Strict Mode
- Optional chaining needed for nested properties
- Check for null/undefined before accessing

### 2. Firebase Timestamps
- Always convert: `data.timestamp.toDate()`
- Store as: `Timestamp.fromDate(new Date())`

### 3. Build Warnings
- ESLint configured to warn (not error) on:
  - `@typescript-eslint/no-explicit-any`
  - `@typescript-eslint/no-unused-vars`

### 4. Email Notifications
- `NotificationService.sendEmail()` not implemented
- Currently using console.log for email simulation
- TODO: Implement actual email service

### 5. Role Switching
- Dev role users can switch roles
- State persists in localStorage
- Check `useRole()` hook for current role

## Testing Guidelines

### Unit Tests
```bash
npm test                 # Run all tests
npm test -- --watch     # Watch mode
npm test -- --coverage  # Coverage report
```

### Test Structure
- Tests in `__tests__` folders
- Mock Firebase services
- Test both success and error paths

### Key Test Areas
1. State machine transitions
2. FERPA compliance rules
3. Policy engine decisions
4. Data validation

## Deployment Checklist

### Pre-Deployment
1. **Run Build**: `npm run build`
2. **Fix ESLint Warnings**: Address any new warnings
3. **Test Locally**: Verify core functionality
4. **Update Docs**: Document new features/changes

### Environment Setup
1. Set all required environment variables
2. Verify Firebase project configuration
3. Check Firestore security rules
4. Test authentication flow

### Post-Deployment
1. Verify FERPA audit logging
2. Test parent portal access
3. Check notification system
4. Monitor error logs

## Quick Reference

### Common Commands
```bash
npm run dev              # Start development server
npm run build           # Production build
npm run lint            # Run ESLint
npm test                # Run tests
```

### File Structure
```
src/
├── app/                # Next.js pages
├── components/         # React components
├── lib/               # Business logic
│   ├── firebase/      # Firebase services
│   └── __tests__/     # Unit tests
└── types/             # TypeScript types
```

### Important Files
- `/firestore.rules`: Security rules
- `/docs/PRD.md`: Product requirements
- `/docs/FERPA_*.md`: Compliance docs
- `/src/types/index.ts`: Core type definitions

## AI Assistant Tips

1. **Always check existing patterns** before implementing new features
2. **Run build** after changes to catch type errors
3. **Update relevant docs** when adding features
4. **Consider FERPA implications** for any data handling
5. **Test error cases** not just happy paths
6. **Use parallel tool calls** when gathering information
7. **Preserve existing ESLint suppressions** unless fixing the underlying issue

## Need More Context?

Key documents to review:
- `/docs/PRD.md`: Full product specification
- `/docs/FERPA_TECHNICAL_IMPLEMENTATION.md`: Compliance details
- `/docs/CURRENT_STATE_ANALYSIS.md`: System status
- `/src/lib/stateMachine.ts`: Core business logic

## Jest Spying and Static Methods

- If you need to spy on or mock a static method in a class for testing, declare it as `public static`.
- TypeScript and Jest do not allow spying on `protected` or `private` static methods.
- If the method is not part of the intended public API, add a comment: `// public for testability (Jest spyOn limitation)`.
- Do **not** use `as any` or type assertions to bypass this, as it leads to brittle and unclear tests.

**Example:**
```typescript
export class DataRetentionService {
  // public for testability (Jest spyOn limitation)
  public static async findExpiredRecords(...) { /* ... */ }
}
```

#### Static Initialization and Testability

- **Do not run static initialization code (e.g., scheduling jobs, side effects) at module load time** in files that will be tested.
- This can cause classes to be loaded and methods to be bound before Jest spies are set up, making it impossible to mock or spy on those methods in tests.
- If you must run static initialization, guard it with:
  ```typescript
  if (process.env.NODE_ENV !== 'test') {
    DataRetentionService.scheduleAutomatedCleanup();
  }
  ```
- Alternatively, move such initialization to explicit startup scripts or entry points, not inside the module itself. 