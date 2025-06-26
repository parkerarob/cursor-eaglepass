/**
 * Phase-1 scaffold.
 * In Phase 3 we will move all pure Zod schemas here.
 */
export {};

/**
 * Phase-3: All Zod schemas and their regex/constants moved from legacy validation.ts
 */
import { z } from 'zod';
import { UserRole } from '@/types';

// Accept either a standard UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
// or a Firestore-style document ID (alphanumeric, dash/underscore, >= 5 chars)
export const uuidRegex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const firestoreIdRegex = '[A-Za-z0-9]{20}';
export const combinedRegex = new RegExp(`^(?:${uuidRegex}|${firestoreIdRegex})$`, 'i');

// Flexible ID schema: UUID OR 5-40 char slug (alphanum, dash, underscore)
export const slugIdRegex = '[A-Za-z0-9_-]{5,40}';
export const flexibleIdRegex = new RegExp(`^(?:${uuidRegex}|${slugIdRegex})$`, 'i');
export const idSchema = z.string().regex(flexibleIdRegex, 'Invalid ID format');

export const uuidSchema = z.string().regex(combinedRegex, 'Invalid ID format');

// Base validation schemas
export const emailSchema = z.string().email('Invalid email format');
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');
export const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name too long').trim();

// User role validation
export const userRoleSchema = z.enum(['student', 'teacher', 'admin', 'dev'] as const);

// Location type validation
export const locationTypeSchema = z.enum([
  'classroom', 'bathroom', 'library', 'office', 'nurse', 'cafeteria'
] as const);

// Pass status validation
export const passStatusSchema = z.enum(['OPEN', 'CLOSED', 'PENDING_APPROVAL'] as const);

// Movement state validation
export const movementStateSchema = z.enum(['IN', 'OUT'] as const);

// Emergency contact validation
export const emergencyContactSchema = z.object({
  name: nameSchema,
  relationship: z.string().min(1, 'Relationship is required').max(50, 'Relationship too long'),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  isPrimary: z.boolean().optional()
}).refine(
  (contact) => contact.email || contact.phone,
  { message: 'At least one contact method (email or phone) is required' }
);

// User validation schema
export const userSchema = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: emailSchema,
  role: userRoleSchema,
  schoolId: z.string().optional(),
  assignedLocationId: idSchema.optional(),
  emergencyContacts: z.array(emergencyContactSchema).optional()
}).refine(
  (user) => user.name || (user.firstName && user.lastName),
  { message: 'Either full name or first/last name is required' }
);

// Location validation schema
export const locationSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, 'Location name is required').max(100, 'Name too long'),
  locationType: locationTypeSchema,
  responsiblePartyId: uuidSchema.optional(),
  teacherName: nameSchema.optional()
});

// Leg validation schema
export const legSchema = z.object({
  id: uuidSchema,
  legNumber: z.number().int().positive('Leg number must be positive'),
  originLocationId: uuidSchema,
  destinationLocationId: uuidSchema,
  state: movementStateSchema,
  timestamp: z.date()
}).refine(
  (leg) => leg.originLocationId !== leg.destinationLocationId,
  { message: 'Origin and destination cannot be the same' }
);

// Pass validation schema
export const passSchema = z.object({
  id: uuidSchema,
  studentId: uuidSchema,
  status: passStatusSchema,
  createdAt: z.date(),
  lastUpdatedAt: z.date(),
  legs: z.array(legSchema).min(1, 'Pass must have at least one leg'),
  closedBy: uuidSchema.optional(),
  closedAt: z.date().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  lastNotificationAt: z.date().optional(),
  notificationLevel: z.enum(['none', 'student', 'teacher', 'admin']).optional(),
  claimedBy: z.object({
    userId: uuidSchema,
    userName: nameSchema,
    timestamp: z.date()
  }).optional()
}).refine(
  (pass) => pass.status !== 'CLOSED' || (pass.closedBy && pass.closedAt),
  { message: 'Closed passes must have closedBy and closedAt fields' }
);

// Pass form data validation
export const passFormDataSchema = z.object({
  // Firestore document IDs are non-UUID 20-char strings, so allow any non-empty string
  destinationLocationId: z.string().min(1, 'Destination is required')
});

// Event log validation schema
export const eventLogSchema = z.object({
  id: uuidSchema.optional(), // Optional for creation
  passId: uuidSchema,
  studentId: uuidSchema,
  actorId: uuidSchema,
  timestamp: z.date(),
  eventType: z.enum([
    'DEPARTED', 'RETURNED', 'PASS_CREATED', 'PASS_CLOSED', 'ARRIVED', 'NEW_DESTINATION',
    'INVALID_TRANSITION', 'POLICY_DENIED', 'ERROR', 'NOTIFICATION_SENT',
    'NOTIFICATION_FAILED', 'STUDENT_CLAIMED', 'EMERGENCY_ACTIVATED'
  ]),
  details: z.string().max(1000, 'Details too long').optional(),
  notificationLevel: z.enum(['student', 'teacher', 'admin']).optional()
});

// Parent relationship verification request schema
export const parentRelationshipVerifySchema = z.object({
  parentId: uuidSchema,
  studentId: uuidSchema
});
