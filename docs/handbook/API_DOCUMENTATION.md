# API Documentation

This document details all service APIs in the Eagle Pass system, including parameters, return types, and usage examples.

## Core Services

### PassService (`/src/lib/passService.ts`)

#### createPass
Creates a new hall pass for a student.

```typescript
static async createPass(
  actorUserId: string,
  studentUserId: string,
  origin: string,
  destination: string,
  passType: 'Gated' | 'Immediate' = 'Immediate'
): Promise<Pass>
```

**Parameters:**
- `actorUserId`: ID of the user creating the pass (teacher/admin)
- `studentUserId`: ID of the student
- `origin`: Starting location ID
- `destination`: Destination location ID
- `passType`: Whether pass requires approval

**Returns:** Created `Pass` object

**Throws:** 
- `Error` if student not found
- `Error` if permission denied

#### closePass
Closes an active pass.

```typescript
static async closePass(
  passId: string,
  closedBy: string
): Promise<Pass>
```

**Parameters:**
- `passId`: ID of the pass to close
- `closedBy`: ID of the user closing the pass

**Returns:** Updated `Pass` object

### State Machine (`/src/lib/stateMachine.ts`)

#### processMovement
Processes student movement between locations.

```typescript
static async processMovement(
  passId: string,
  newLocationId: string,
  timestamp?: Date
): Promise<{
  pass: Pass;
  actionType: 'IN' | 'OUT';
  isComplete: boolean;
}>
```

**Parameters:**
- `passId`: ID of the active pass
- `newLocationId`: Location the student is entering/leaving
- `timestamp`: Optional timestamp (defaults to now)

**Returns:**
- `pass`: Updated pass object
- `actionType`: Whether student entered or left
- `isComplete`: Whether pass journey is complete

## FERPA Services

### FERPAService (`/src/lib/ferpaService.ts`)

#### logRecordAccess
Logs access to student records for FERPA compliance.

```typescript
static async logRecordAccess(
  actorId: string,
  actorRole: 'parent' | 'teacher' | 'admin' | 'student',
  studentId: string,
  recordIds: string[],
  purpose: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void>
```

**Parameters:**
- `actorId`: ID of user accessing records
- `actorRole`: Role of the accessing user
- `studentId`: ID of student whose records are accessed
- `recordIds`: Array of record IDs accessed
- `purpose`: Reason for access
- `ipAddress`: Optional IP address
- `userAgent`: Optional user agent string

#### recordEmergencyDisclosure
Records emergency disclosure of student information.

```typescript
static async recordEmergencyDisclosure(
  studentIds: string[],
  disclosedTo: string[],
  reason: string,
  emergencyType: 'health' | 'safety' | 'security',
  disclosedBy: string,
  additionalDetails?: Record<string, unknown>
): Promise<EmergencyDisclosure>
```

**Parameters:**
- `studentIds`: Array of affected student IDs
- `disclosedTo`: Recipients of the information
- `reason`: Reason for disclosure
- `emergencyType`: Type of emergency
- `disclosedBy`: ID of person making disclosure
- `additionalDetails`: Optional additional context

**Returns:** `EmergencyDisclosure` record

### ParentAccessService (`/src/lib/parentAccessService.ts`)

#### submitAccessRequest
Submits a parent request to access student records.

```typescript
static async submitAccessRequest(
  parentId: string,
  parentEmail: string,
  studentId: string,
  requestType: 'inspection' | 'review' | 'correction' | 'copy',
  purpose: string,
  requestDetails?: string
): Promise<ParentAccessRequest>
```

**Parameters:**
- `parentId`: ID of the parent
- `parentEmail`: Parent's email address
- `studentId`: ID of the student
- `requestType`: Type of access requested
- `purpose`: Purpose of the request
- `requestDetails`: Optional additional details

**Returns:** `ParentAccessRequest` object

#### getStudentRecordsForParent
Retrieves student records for authorized parent access.

```typescript
static async getStudentRecordsForParent(
  parentId: string,
  studentId: string,
  accessRequestId: string
): Promise<{
  student: User;
  passes: Pass[];
  eventLogs: EventLog[];
  ferpaNotice: string;
  accessSummary: {
    totalRecords: number;
    recordTypes: string[];
    accessDate: Date;
  };
}>
```

**Parameters:**
- `parentId`: ID of the parent
- `studentId`: ID of the student
- `accessRequestId`: ID of approved access request

**Returns:** Object containing student records and metadata

## Notification Service (`/src/lib/notificationService.ts`)

#### sendNotification
Sends multi-channel notifications for extended passes.

```typescript
static async sendNotification(
  pass: Pass,
  student: User,
  notificationLevel: 'student' | 'teacher' | 'admin'
): Promise<NotificationResult>
```

**Parameters:**
- `pass`: The pass triggering notification
- `student`: Student information
- `notificationLevel`: Escalation level

**Returns:** `NotificationResult` with channel statuses

## Policy Engine (`/src/lib/policyEngine.ts`)

#### evaluatePolicy
Evaluates if an action is allowed based on policies.

```typescript
static async evaluatePolicy(context: PolicyContext): Promise<{
  allowed: boolean;
  appliedPolicies: string[];
  reason?: string;
}>
```

**Parameters:**
- `context`: Policy context including student, location, and action

**Returns:**
- `allowed`: Whether action is permitted
- `appliedPolicies`: List of policies applied
- `reason`: Optional explanation if denied

## Firebase Services

### User Management (`/src/lib/firebase/firestore.ts`)

#### getUserById
Retrieves a user by their ID.

```typescript
async function getUserById(userId: string): Promise<User | null>
```

**Parameters:**
- `userId`: The user's unique ID

**Returns:** `User` object or null if not found

#### getStudentsByAssignedLocation
Gets all students assigned to a location.

```typescript
async function getStudentsByAssignedLocation(
  locationId: string
): Promise<User[]>
```

**Parameters:**
- `locationId`: The location ID

**Returns:** Array of `User` objects with role 'student'

#### getPassesByStudentName
Retrieves passes for a specific student.

```typescript
async function getPassesByStudentName(
  studentName: string,
  limit?: number
): Promise<Pass[]>
```

**Parameters:**
- `studentName`: Full name of the student
- `limit`: Optional limit on results (default: 50)

**Returns:** Array of `Pass` objects

## Data Retention Service (`/src/lib/dataRetentionService.ts`)

#### runManualCleanup
Manually triggers data retention cleanup.

```typescript
static async runManualCleanup(
  recordType?: string
): Promise<RetentionMetrics>
```

**Parameters:**
- `recordType`: Optional specific record type to clean

**Returns:** `RetentionMetrics` with cleanup statistics

## Error Handling

All services follow consistent error handling:

```typescript
try {
  const result = await service.method();
  return result;
} catch (error) {
  console.error('ServiceName: Error description:', error);
  throw error;
}
```

## Response Types

### Pass
```typescript
interface Pass {
  id: string;
  studentId: string;
  status: 'OPEN' | 'CLOSED' | 'PENDING_APPROVAL';
  createdAt: Date;
  lastUpdatedAt: Date;
  legs: Leg[];
  closedBy?: string;
  closedAt?: Date;
  durationMinutes?: number;
  lastNotificationAt?: Date;
  notificationLevel?: 'none' | 'student' | 'teacher' | 'admin';
}
```

### User
```typescript
interface User {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'dev';
  assignedLocationId?: string;
  emergencyContacts?: EmergencyContact[];
}
```

### FERPAAuditLog
```typescript
interface FERPAAuditLog {
  id: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  studentId: string;
  recordIds: string[];
  purpose: string;
  legalBasis: string;
  timestamp: Date;
}
```

## Usage Examples

### Creating a Pass
```typescript
// Teacher creates bathroom pass for student
const pass = await PassService.createPass(
  teacherId,
  studentId,
  'classroom-101',
  'bathroom-a',
  'Immediate'
);
```

### Processing Movement
```typescript
// Student arrives at destination
const result = await StateMachine.processMovement(
  pass.id,
  'bathroom-a'
);

if (result.isComplete) {
  console.log('Student has returned to origin');
}
```

### Parent Access Request
```typescript
// Parent requests to view child's records
const request = await ParentAccessService.submitAccessRequest(
  parentId,
  'parent@email.com',
  studentId,
  'inspection',
  'Routine records review'
);

// After admin approval, parent can access records
const records = await ParentAccessService.getStudentRecordsForParent(
  parentId,
  studentId,
  request.id
);
```

### Emergency Disclosure
```typescript
// Record emergency disclosure
const disclosure = await FERPAService.recordEmergencyDisclosure(
  ['student-1', 'student-2'],
  ['Police Department', 'School Nurse'],
  'Active threat on campus',
  'security',
  adminId
);
```

## Rate Limiting

Some endpoints implement rate limiting:

- Parent access requests: Max 5 per hour per parent
- Pass creation: Max 100 per hour per teacher
- Report generation: Max 10 per hour per admin

## Authentication

All API calls require authentication via Firebase Auth. The user's role determines available operations:

- **Students**: Read own passes
- **Teachers**: Create/manage passes for assigned students
- **Admins**: Full system access
- **Parents**: Access own child's records (with approval)

## Webhooks & Events

The system emits events for external integration:

- `pass.created` - New pass created
- `pass.closed` - Pass completed
- `notification.sent` - Alert triggered
- `ferpa.disclosure` - Emergency disclosure
- `parent.access` - Parent accessed records

## Parent API Endpoints

### Parent Relationship Verification (`/api/parent/verify-relationship`)

#### POST /api/parent/verify-relationship
Verifies a parent-student relationship for FERPA compliance.

```typescript
interface VerifyRelationshipRequest {
  parentId: string;
  studentId: string;
  relationshipType: 'parent' | 'guardian' | 'legal_representative';
  verificationMethod: 'email' | 'phone' | 'document';
  contactInfo: string;
}
```

**Response:**
```typescript
interface VerifyRelationshipResponse {
  success: boolean;
  relationshipId?: string;
  status: 'verified' | 'pending' | 'rejected';
  message: string;
  expiresAt?: Date;
}
```

#### GET /api/parent/verify-relationship/:relationshipId
Retrieves the status of a relationship verification.

**Response:**
```typescript
interface RelationshipStatusResponse {
  relationshipId: string;
  parentId: string;
  studentId: string;
  status: 'verified' | 'pending' | 'rejected' | 'expired';
  verifiedAt?: Date;
  expiresAt?: Date;
  verificationMethod: string;
}
```

### Parent Relationship Management (`/api/parent/relationships`)

#### GET /api/parent/relationships
Retrieves all relationships for a parent.

**Query Parameters:**
- `parentId`: Parent's user ID
- `status`: Filter by status (active, pending, expired)

**Response:**
```typescript
interface ParentRelationshipsResponse {
  relationships: ParentStudentRelationship[];
  totalCount: number;
}
```

#### POST /api/parent/relationships
Creates a new parent-student relationship (admin only).

```typescript
interface CreateRelationshipRequest {
  parentId: string;
  studentId: string;
  relationshipType: 'parent' | 'guardian' | 'legal_representative';
  schoolYear: string;
  isActive: boolean;
  verificationStatus: 'verified' | 'pending';
}
```

#### PUT /api/parent/relationships/:relationshipId
Updates an existing relationship (admin only).

```typescript
interface UpdateRelationshipRequest {
  isActive?: boolean;
  verificationStatus?: 'verified' | 'pending' | 'rejected';
  schoolYear?: string;
}
```

#### DELETE /api/parent/relationships/:relationshipId
Deactivates a relationship (admin only).

### Directory Information Management (`/api/parent/directory-info`)

#### GET /api/parent/directory-info/:studentId
Retrieves directory information opt-out preferences for a student.

**Response:**
```typescript
interface DirectoryInfoResponse {
  studentId: string;
  optOuts: {
    name: boolean;
    grade: boolean;
    attendance: boolean;
    activities: boolean;
    honors: boolean;
    photo: boolean;
  };
  lastUpdated: Date;
  schoolYear: string;
}
```

#### POST /api/parent/directory-info/:studentId
Updates directory information opt-out preferences.

```typescript
interface UpdateDirectoryInfoRequest {
  optOuts: {
    name?: boolean;
    grade?: boolean;
    attendance?: boolean;
    activities?: boolean;
    honors?: boolean;
    photo?: boolean;
  };
  reason?: string;
}
```

**Response:**
```typescript
interface UpdateDirectoryInfoResponse {
  success: boolean;
  message: string;
  updatedAt: Date;
  auditLogId: string;
}
```

#### GET /api/parent/directory-info/check/:studentId
Checks if specific directory information can be disclosed.

**Query Parameters:**
- `category`: Directory information category (name, grade, attendance, activities, honors, photo)

**Response:**
```typescript
interface DisclosureCheckResponse {
  studentId: string;
  category: string;
  canDisclose: boolean;
  reason?: string;
  lastOptOutUpdate?: Date;
}
```

## Parent API Usage Examples

### Verifying a Parent Relationship
```typescript
// Parent initiates relationship verification
const verification = await fetch('/api/parent/verify-relationship', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    parentId: 'parent-123',
    studentId: 'student-456',
    relationshipType: 'parent',
    verificationMethod: 'email',
    contactInfo: 'parent@email.com'
  })
});

const result = await verification.json();
// { success: true, relationshipId: 'rel-789', status: 'pending' }
```

### Managing Directory Information Opt-outs
```typescript
// Parent updates directory information preferences
const updateOptOuts = await fetch('/api/parent/directory-info/student-456', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    optOuts: {
      photo: true,
      honors: false,
      activities: true
    },
    reason: 'Privacy concerns'
  })
});

const result = await updateOptOuts.json();
// { success: true, message: 'Preferences updated', updatedAt: '2024-12-19T...' }
```

### Checking Disclosure Permissions
```typescript
// Check if student's name can be disclosed
const disclosureCheck = await fetch('/api/parent/directory-info/check/student-456?category=name');
const result = await disclosureCheck.json();
// { studentId: 'student-456', category: 'name', canDisclose: false, reason: 'Parent opted out' }
``` 