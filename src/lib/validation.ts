/**
 * ⚠ LEGACY MONOLITH – being broken into smaller modules.
 * Do NOT add new code here.  See src/lib/validation/* for the refactor.
 */
import { z } from 'zod';
import * as Schemas from './validation/schemas';
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
export const idSchema = Schemas.idSchema;

export const uuidSchema = Schemas.uuidSchema;

// Base validation schemas
export const emailSchema = Schemas.emailSchema;
export const phoneSchema = Schemas.phoneSchema;
export const nameSchema = Schemas.nameSchema;

// User role validation
export const userRoleSchema = Schemas.userRoleSchema;

// Location type validation
export const locationTypeSchema = Schemas.locationTypeSchema;

// Pass status validation
export const passStatusSchema = Schemas.passStatusSchema;

// Movement state validation
export const movementStateSchema = Schemas.movementStateSchema;

// Emergency contact validation
export const emergencyContactSchema = Schemas.emergencyContactSchema;

// User validation schema
export const userSchema = Schemas.userSchema;

// Location validation schema
export const locationSchema = Schemas.locationSchema;

// Leg validation schema
export const legSchema = Schemas.legSchema;

// Pass validation schema
export const passSchema = Schemas.passSchema;

// Pass form data validation
export const passFormDataSchema = Schemas.passFormDataSchema;

// Event log validation schema
export const eventLogSchema = Schemas.eventLogSchema;

// Parent relationship verification request schema
export const parentRelationshipVerifySchema = Schemas.parentRelationshipVerifySchema;

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
  static validateUser(data: unknown): z.infer<typeof Schemas.userSchema> {
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
      
      return Schemas.userSchema.parse(data);
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
export type ValidatedUser = z.infer<typeof Schemas.userSchema>;
export type ValidatedLocation = z.infer<typeof Schemas.locationSchema>;
export type ValidatedPass = z.infer<typeof Schemas.passSchema>;
export type ValidatedPassFormData = z.infer<typeof Schemas.passFormDataSchema>;
export type ValidatedEventLog = z.infer<typeof Schemas.eventLogSchema>;
export type ValidatedEmergencyContact = z.infer<typeof Schemas.emergencyContactSchema>;

export { sanitizeString, sanitizeAndValidateInput } from './validation/sanitiser';
export { checkForSuspiciousPatterns } from './validation/guards'; 