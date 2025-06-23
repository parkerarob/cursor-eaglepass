# Code Conventions & Best Practices

This document outlines coding standards and conventions for the Eagle Pass system to ensure consistency and maintainability.

## TypeScript Conventions

### Type Definitions
```typescript
// ✅ Good - Use interfaces for objects
interface User {
  id: string;
  name: string;
  role: UserRole;
}

// ✅ Good - Use type aliases for unions/primitives
type UserRole = 'student' | 'teacher' | 'admin' | 'dev';

// ❌ Avoid - Don't use 'any'
const data: any = fetchData(); // Use 'unknown' instead

// ✅ Good - Explicit return types
function getUser(id: string): User | null {
  // implementation
}
```

### Null Checks
```typescript
// ✅ Good - Check for null/undefined
if (user && user.emergencyContacts && user.emergencyContacts.length > 0) {
  // Safe to access
}

// ✅ Good - Use optional chaining when appropriate
const email = user?.emergencyContacts?.[0]?.email;

// ❌ Avoid - Don't assume nested properties exist
const email = user.emergencyContacts[0].email; // May crash
```

## React/Next.js Patterns

### Component Structure
```typescript
// ✅ Good - Server component (default)
// src/components/UserList.tsx
export default function UserList({ users }: { users: User[] }) {
  return (
    <div>
      {users.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}

// ✅ Good - Client component (only when needed)
// src/components/InteractiveForm.tsx
'use client';

import { useState } from 'react';

export default function InteractiveForm() {
  const [value, setValue] = useState('');
  // ...
}
```

### File Naming
- Components: `PascalCase.tsx` (e.g., `UserCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `PascalCase.ts` or in `types/index.ts`
- Tests: `*.test.ts` or `*.test.tsx`

## Firebase/Firestore Patterns

### Timestamp Handling
```typescript
// ✅ Good - Converting timestamps
const user = {
  ...data,
  createdAt: data.createdAt.toDate(), // Firestore Timestamp → JS Date
};

// ✅ Good - Storing timestamps
await setDoc(docRef, {
  ...userData,
  updatedAt: Timestamp.fromDate(new Date()),
});
```

### Query Patterns
```typescript
// ✅ Good - Typed queries with error handling
async function getActiveStudents(): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', '==', 'student'),
      where('active', '==', true),
      orderBy('lastName'),
      limit(100)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
    
  } catch (error) {
    console.error('getActiveStudents: Error fetching students:', error);
    throw error;
  }
}
```

## Service Layer Patterns

### Service Structure
```typescript
// ✅ Good - Static class with clear methods
export class UserService {
  /**
   * Get user by ID with caching
   */
  static async getUser(id: string): Promise<User | null> {
    try {
      // Implementation
    } catch (error) {
      console.error('UserService: Error getting user:', error);
      throw error;
    }
  }
}
```

### Error Handling
```typescript
// ✅ Good - Consistent error pattern
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // 1. Log with service name and context
  console.error('ServiceName: Operation failed:', error);
  
  // 2. Log to monitoring if critical
  if (isCritical) {
    monitoringService.logError('Critical operation failed', {
      service: 'ServiceName',
      operation: 'operationName',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  // 3. Re-throw or return safe default
  throw error; // Or return null/empty array
}
```

## FERPA Compliance Patterns

### Audit Logging
```typescript
// ✅ Good - Always log data access
async function getStudentRecords(studentId: string, actorId: string): Promise<Records> {
  const records = await fetchRecords(studentId);
  
  // Log access for FERPA compliance
  await FERPAAuditLogger.logRecordAccess(
    actorId,
    'teacher', // role
    studentId,
    records.map(r => r.id),
    'Routine record access',
    '§99.31(a)(1) Educational interest'
  );
  
  return records;
}
```

### Parent Access
```typescript
// ✅ Good - Verify relationships before access
const relationship = await ParentAccessService.verifyParentStudentRelationship(
  parentId,
  studentId
);

if (!relationship) {
  throw new Error('No verified parent-student relationship');
}

// Proceed with access...
```

## Testing Patterns

### Unit Test Structure
```typescript
// ✅ Good - Descriptive test structure
describe('PassService', () => {
  describe('createPass', () => {
    it('should create a pass with valid data', async () => {
      // Arrange
      const mockStudent = createMockStudent();
      const destination = 'bathroom';
      
      // Act
      const pass = await PassService.createPass(mockStudent.id, destination);
      
      // Assert
      expect(pass).toBeDefined();
      expect(pass.status).toBe('OPEN');
      expect(pass.studentId).toBe(mockStudent.id);
    });
    
    it('should throw error for invalid student', async () => {
      // Test error case
      await expect(
        PassService.createPass('invalid-id', 'bathroom')
      ).rejects.toThrow('Student not found');
    });
  });
});
```

## Jest Spying and Static Methods in TypeScript

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

## Import Organization

```typescript
// ✅ Good - Organized imports
// 1. External libraries
import { useState, useEffect } from 'react';
import { collection, query, where } from 'firebase/firestore';

// 2. Internal absolute imports
import { User, Pass } from '@/types';
import { db } from '@/lib/firebase/firestore';

// 3. Internal relative imports
import { formatDate } from './utils';
import UserCard from './UserCard';

// 4. Type imports
import type { UserRole } from '@/types';
```

## Comments & Documentation

### Function Documentation
```typescript
/**
 * Create a new hall pass for a student
 * 
 * @param studentId - The ID of the student
 * @param destination - The destination location
 * @param options - Optional configuration
 * @returns The created pass or null if failed
 * @throws {Error} If student not found or permission denied
 */
async function createPass(
  studentId: string,
  destination: string,
  options?: PassOptions
): Promise<Pass | null> {
  // Implementation
}
```

### Inline Comments
```typescript
// ✅ Good - Explain why, not what
// Check parent relationship for FERPA compliance
const hasAccess = await verifyParentAccess(parentId, studentId);

// ❌ Avoid - Obvious comments
// Set status to 'OPEN'
pass.status = 'OPEN';
```

## Git Commit Messages

### Format
```
type: brief description

Longer explanation if needed
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code restructuring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

### Examples
```
feat: add parent portal access

Implements FERPA-compliant parent access to student records
with proper authentication and audit logging

fix: correct timestamp conversion in pass history

docs: update FERPA compliance documentation
```

## Performance Considerations

### Database Queries
```typescript
// ✅ Good - Limit query results
const recentPasses = await getDocs(
  query(passesRef, orderBy('createdAt', 'desc'), limit(50))
);

// ❌ Avoid - Unbounded queries
const allPasses = await getDocs(collection(db, 'passes'));
```

### Component Optimization
```typescript
// ✅ Good - Memoize expensive computations
const sortedStudents = useMemo(
  () => students.sort((a, b) => a.lastName.localeCompare(b.lastName)),
  [students]
);

// ✅ Good - Debounce user input
const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  [handleSearch]
);
```

## Security Best Practices

### Data Validation
```typescript
// ✅ Good - Validate user input
function validatePassDestination(destination: string): boolean {
  const validDestinations = ['bathroom', 'nurse', 'office', 'library'];
  return validDestinations.includes(destination.toLowerCase());
}

// ✅ Good - Sanitize data before storage
const sanitizedName = name.trim().slice(0, 100);
```

### Role Checking
```typescript
// ✅ Good - Check permissions explicitly
if (userRole !== 'admin' && userRole !== 'teacher') {
  throw new Error('Insufficient permissions');
}

// ✅ Good - Use role hooks in components
const { role } = useRole();
if (role !== 'admin') {
  return <AccessDenied />;
}
```

## Environment Variables

### Naming Convention
```env
# Public variables (exposed to client)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_APP_NAME=...

# Server-only variables
DATABASE_URL=...
ADMIN_SECRET_KEY=...
```

### Usage
```typescript
// ✅ Good - Type-safe env access
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!apiKey) {
  throw new Error('Firebase API key not configured');
}

// ❌ Avoid - Direct usage without checks
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, // May be undefined
};
```

## Accessibility

### ARIA Labels
```tsx
// ✅ Good - Descriptive labels
<button
  onClick={handleClose}
  aria-label="Close pass for student John Doe"
>
  Close Pass
</button>

// ✅ Good - Form labels
<label htmlFor="destination">
  Destination
  <select id="destination" name="destination" required>
    <option value="">Select destination</option>
    <option value="bathroom">Bathroom</option>
  </select>
</label>
```

## Common Anti-Patterns to Avoid

1. **Mutating state directly**
   ```typescript
   // ❌ Bad
   user.name = 'New Name';
   
   // ✅ Good
   setUser({ ...user, name: 'New Name' });
   ```

2. **Ignoring TypeScript errors**
   ```typescript
   // ❌ Bad
   // @ts-ignore
   const data = someFunction();
   
   // ✅ Good - Fix the type issue
   const data: unknown = someFunction();
   ```

3. **Nested ternaries**
   ```typescript
   // ❌ Bad
   const status = isActive ? isVerified ? 'active' : 'pending' : 'inactive';
   
   // ✅ Good
   let status = 'inactive';
   if (isActive) {
     status = isVerified ? 'active' : 'pending';
   }
   ```

4. **Magic numbers/strings**
   ```typescript
   // ❌ Bad
   if (duration > 600) { // What is 600?
   
   // ✅ Good
   const NOTIFICATION_THRESHOLD_SECONDS = 600;
   if (duration > NOTIFICATION_THRESHOLD_SECONDS) {
   ```

Remember: Consistency is key. When in doubt, follow existing patterns in the codebase. 