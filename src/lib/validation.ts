/**
 * ⚠ LEGACY MONOLITH – being broken into smaller modules.
 * Do NOT add new code here.  See src/lib/validation/* for the refactor.
 */
import { z } from 'zod';
import { UserRole } from '@/types';
import { sanitizeString, sanitizeAndValidateInput } from './validation/sanitiser';
import { checkForSuspiciousPatterns, hasCriticalPatterns } from './validation/guards';

// Accept either a standard UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
// or a Firestore-style document ID (alphanumeric, dash/underscore, >= 5 chars)
const uuidRegex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// Firestore auto-generated IDs are exactly 20 chars, alphanumeric only.
const firestoreIdRegex = '[A-Za-z0-9]{20}';
const combinedRegex = new RegExp(`^(?:${uuidRegex}|${firestoreIdRegex})$`, 'i');

// Flexible ID schema: UUID OR 5-40 char slug (alphanum, dash, underscore)
const slugIdRegex = '[A-Za-z0-9_-]{5,40}';
const flexibleIdRegex = new RegExp(`^(?:${uuidRegex}|${slugIdRegex})$`, 'i');
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
    'DEPARTED', 'RETURNED', 'PASS_CREATED', 'PASS_CLOSED', 'ARRIVED',
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

// Generic API request validator for Next.js API routes
export async function validateRequest<T extends z.ZodTypeAny>(
  request: Request | { json: () => Promise<any> },
  schema: T
): Promise<z.infer<T>> {
  const data = await request.json();
  return schema.parse(data);
}

// Sanitization utilities
export class ValidationService {
  /**
   * Validate and sanitize user data
   */
  static validateUser(data: unknown): z.infer<typeof userSchema> {
    try {
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;

        // Security: reject any string field that contains suspicious patterns BEFORE sanitization
        ['name', 'firstName', 'lastName', 'email'].forEach((key) => {
          const raw = sanitized[key as keyof typeof sanitized];
          if (typeof raw === 'string') {
            const cleaned = sanitizeString(raw);

            // Ensure no critical pattern sneaks through after sanitisation
            if (hasCriticalPatterns(cleaned)) {
              throw new Error('User validation failed: Suspicious patterns detected');
            }

            sanitized[key as keyof typeof sanitized] = cleaned;
          }
        });

        data = sanitized;
      }
      
      return userSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`User validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Validate and sanitize pass form data
   */
  static validatePassFormData(data: unknown): z.infer<typeof passFormDataSchema> {
    try {
      return passFormDataSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Pass form validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Validate pass data
   */
  static validatePass(data: unknown): z.infer<typeof passSchema> {
    try {
      return passSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Pass validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Validate location data
   */
  static validateLocation(data: unknown): z.infer<typeof locationSchema> {
    try {
      // Pre-sanitize string fields
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;
        if (typeof sanitized.name === 'string') sanitized.name = sanitizeString(sanitized.name);
        if (typeof sanitized.teacherName === 'string') sanitized.teacherName = sanitizeString(sanitized.teacherName);
        data = sanitized;
      }
      
      return locationSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Location validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Validate event log data
   */
  static validateEventLog(data: unknown): z.infer<typeof eventLogSchema> {
    try {
      // Pre-sanitize string fields
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;
        if (typeof sanitized.details === 'string') sanitized.details = sanitizeString(sanitized.details);
        data = sanitized;
      }
      
      return eventLogSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Event log validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Validate emergency contact data
   */
  static validateEmergencyContact(data: unknown): z.infer<typeof emergencyContactSchema> {
    try {
      // Pre-sanitize string fields
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;
        if (typeof sanitized.name === 'string') sanitized.name = sanitizeString(sanitized.name);
        if (typeof sanitized.relationship === 'string') sanitized.relationship = sanitizeString(sanitized.relationship);
        if (typeof sanitized.email === 'string') sanitized.email = sanitizeString(sanitized.email);
        if (typeof sanitized.phone === 'string') sanitized.phone = sanitizeString(sanitized.phone);
        data = sanitized;
      }
      
      return emergencyContactSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Emergency contact validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Validate UUID format
   */
  static validateUUID(id: unknown): string {
    try {
      return uuidSchema.parse(id);
    } catch {
      throw new Error('Invalid ID format');
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email: unknown): string {
    try {
      if (typeof email === 'string') {
        email = sanitizeString(email);
      }
      return emailSchema.parse(email);
    } catch {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Batch validation for arrays
   */
  static validateArray<T>(
    items: unknown[],
    validator: (item: unknown) => T
  ): { valid: T[]; errors: Array<{ index: number; error: string }> } {
    const valid: T[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    items.forEach((item, index) => {
      try {
        const validatedItem = validator(item);
        valid.push(validatedItem);
      } catch (error) {
        errors.push({
          index,
          error: error instanceof Error ? error.message : 'Validation failed'
        });
      }
    });

    return { valid, errors };
  }
}

// Type guards for runtime validation
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && uuidSchema.safeParse(value).success;
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && emailSchema.safeParse(value).success;
}

export function isValidUserRole(value: unknown): value is UserRole {
  return userRoleSchema.safeParse(value).success;
}

// Export types for use in other files
export type ValidatedUser = z.infer<typeof userSchema>;
export type ValidatedLocation = z.infer<typeof locationSchema>;
export type ValidatedPass = z.infer<typeof passSchema>;
export type ValidatedPassFormData = z.infer<typeof passFormDataSchema>;
export type ValidatedEventLog = z.infer<typeof eventLogSchema>;
export type ValidatedEmergencyContact = z.infer<typeof emergencyContactSchema>;

export { sanitizeString, sanitizeAndValidateInput } from './validation/sanitiser';
export { checkForSuspiciousPatterns } from './validation/guards'; 