/**
 * Phase-1 scaffold.
 * In Phase 4 we will build the orchestration layer here.
 */
export {};

/**
 * Phase-4: Orchestration logic moved from legacy validation.ts
 */
import { z } from 'zod';
import { UserRole } from '@/types';
import * as Schemas from './schemas';
import { sanitizeString, sanitizeAndValidateInput } from './sanitiser';
import { checkForSuspiciousPatterns, hasCriticalPatterns } from './guards';

// Generic API request validator for Next.js API routes
export async function validateRequest<T extends z.ZodTypeAny>(
  request: Request | { json: () => Promise<any> },
  schema: T
): Promise<z.infer<T>> {
  const data = await request.json();
  return schema.parse(data);
}

export class ValidationService {
  static validateUser(data: unknown): z.infer<typeof Schemas.userSchema> {
    try {
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;
        ['name', 'firstName', 'lastName', 'email'].forEach((key) => {
          const raw = sanitized[key as keyof typeof sanitized];
          if (typeof raw === 'string') {
            const cleaned = sanitizeString(raw);
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

  static validatePassFormData(data: unknown): z.infer<typeof Schemas.passFormDataSchema> {
    try {
      return Schemas.passFormDataSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Pass form validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  static validatePass(data: unknown): z.infer<typeof Schemas.passSchema> {
    try {
      return Schemas.passSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Pass validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  static validateLocation(data: unknown): z.infer<typeof Schemas.locationSchema> {
    try {
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;
        if (typeof sanitized.name === 'string') sanitized.name = sanitizeString(sanitized.name);
        if (typeof sanitized.teacherName === 'string') sanitized.teacherName = sanitizeString(sanitized.teacherName);
        data = sanitized;
      }
      return Schemas.locationSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Location validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  static validateEventLog(data: unknown): z.infer<typeof Schemas.eventLogSchema> {
    try {
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;
        if (typeof sanitized.details === 'string') sanitized.details = sanitizeString(sanitized.details);
        data = sanitized;
      }
      return Schemas.eventLogSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Event log validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  static validateEmergencyContact(data: unknown): z.infer<typeof Schemas.emergencyContactSchema> {
    try {
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data } as Record<string, unknown>;
        if (typeof sanitized.name === 'string') sanitized.name = sanitizeString(sanitized.name);
        if (typeof sanitized.relationship === 'string') sanitized.relationship = sanitizeString(sanitized.relationship);
        if (typeof sanitized.email === 'string') sanitized.email = sanitizeString(sanitized.email);
        if (typeof sanitized.phone === 'string') sanitized.phone = sanitizeString(sanitized.phone);
        data = sanitized;
      }
      return Schemas.emergencyContactSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Emergency contact validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  static validateUUID(id: unknown): string {
    try {
      return Schemas.uuidSchema.parse(id);
    } catch {
      throw new Error('Invalid ID format');
    }
  }

  static validateEmail(email: unknown): string {
    try {
      if (typeof email === 'string') {
        email = sanitizeString(email);
      }
      return Schemas.emailSchema.parse(email);
    } catch {
      throw new Error('Invalid email format');
    }
  }

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

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && Schemas.uuidSchema.safeParse(value).success;
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && Schemas.emailSchema.safeParse(value).success;
}

export function isValidUserRole(value: unknown): value is UserRole {
  return Schemas.userRoleSchema.safeParse(value).success;
}
