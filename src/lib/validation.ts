import { z } from 'zod';
import { UserRole } from '@/types';

// Accept either a standard UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
// or a Firestore-style document ID (alphanumeric, dash/underscore, >= 5 chars)
const uuidRegex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// Accept alphanumeric Firestore IDs (Firebase auth UIDs and doc IDs are 20-30 chars, no symbols).
const firestoreIdRegex = '[A-Za-z0-9_-]{20,30}';
const combinedRegex = new RegExp(`^(?:${uuidRegex}|${firestoreIdRegex})$`, 'i');

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
  id: uuidSchema,
  name: nameSchema.optional(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: emailSchema,
  role: userRoleSchema,
  schoolId: z.string().optional(),
  assignedLocationId: uuidSchema.optional(),
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
   * Sanitize and validate user input
   */
  static sanitizeString(input: unknown): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    // Remove dangerous characters and normalize
    return input
      .trim()
      .replace(/[<>'"&]/g, '') // Remove potential XSS characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate and sanitize user data
   */
  static validateUser(data: unknown): z.infer<typeof userSchema> {
    try {
      // Pre-sanitize string fields
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;
        if (typeof sanitized.name === 'string') sanitized.name = this.sanitizeString(sanitized.name);
        if (typeof sanitized.firstName === 'string') sanitized.firstName = this.sanitizeString(sanitized.firstName);
        if (typeof sanitized.lastName === 'string') sanitized.lastName = this.sanitizeString(sanitized.lastName);
        if (typeof sanitized.email === 'string') sanitized.email = this.sanitizeString(sanitized.email);
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
        if (typeof sanitized.name === 'string') sanitized.name = this.sanitizeString(sanitized.name);
        if (typeof sanitized.teacherName === 'string') sanitized.teacherName = this.sanitizeString(sanitized.teacherName);
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
        if (typeof sanitized.details === 'string') sanitized.details = this.sanitizeString(sanitized.details);
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
        if (typeof sanitized.name === 'string') sanitized.name = this.sanitizeString(sanitized.name);
        if (typeof sanitized.relationship === 'string') sanitized.relationship = this.sanitizeString(sanitized.relationship);
        if (typeof sanitized.email === 'string') sanitized.email = this.sanitizeString(sanitized.email);
        if (typeof sanitized.phone === 'string') sanitized.phone = this.sanitizeString(sanitized.phone);
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
        email = this.sanitizeString(email);
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

  /**
   * Security check for suspicious patterns
   */
  static checkForSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /<script/i,           // Script tags
      /javascript:/i,       // Javascript URLs
      /on\w+\s*=/i,        // Event handlers
      /data:text\/html/i,   // Data URLs
      /vbscript:/i,        // VBScript
      /expression\(/i,      // CSS expressions
      /\[object\s+object\]/i, // Object representations
      /eval\s*\(/i,        // Eval calls
      /setTimeout\s*\(/i,   // Timer functions
      /setInterval\s*\(/i,  // Timer functions
      /\${/,               // Template literals
      /<%/,                // Server tags
      /%3C/i,              // Encoded <
      /%3E/i,              // Encoded >
      /\.\.\//,            // Directory traversal
      /__proto__/,         // Prototype pollution
      /constructor/,       // Constructor access
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Advanced input sanitization with security checks
   */
  static sanitizeAndValidateInput(input: unknown, context: string): string {
    if (typeof input !== 'string') {
      throw new Error(`${context}: Input must be a string`);
    }

    // Check for suspicious patterns
    if (this.checkForSuspiciousPatterns(input)) {
      throw new Error(`${context}: Input contains suspicious patterns`);
    }

    // Sanitize and validate
    const sanitized = this.sanitizeString(input);
    
    if (sanitized.length === 0) {
      throw new Error(`${context}: Input cannot be empty after sanitization`);
    }

    return sanitized;
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