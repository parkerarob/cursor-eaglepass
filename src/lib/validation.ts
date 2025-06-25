/**
 * ⚠ LEGACY MONOLITH – being broken into smaller modules.
 * Do NOT add new code here.  See src/lib/validation/* for the refactor.
 */
import { z } from 'zod';
import * as Schemas from './validation/schemas';
import { UserRole } from '@/types';
import { sanitizeString, sanitizeAndValidateInput } from './validation/sanitiser';
import { checkForSuspiciousPatterns, hasCriticalPatterns } from './validation/guards';
import { ValidationService, validateRequest } from './validation/service';

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

// Only keep type exports and re-exports for backward compatibility.
export type ValidatedUser = z.infer<typeof Schemas.userSchema>;
export type ValidatedLocation = z.infer<typeof Schemas.locationSchema>;
export type ValidatedPass = z.infer<typeof Schemas.passSchema>;
export type ValidatedPassFormData = z.infer<typeof Schemas.passFormDataSchema>;
export type ValidatedEventLog = z.infer<typeof Schemas.eventLogSchema>;
export type ValidatedEmergencyContact = z.infer<typeof Schemas.emergencyContactSchema>;
export { sanitizeString, sanitizeAndValidateInput } from './validation/sanitiser';
export { checkForSuspiciousPatterns } from './validation/guards';
export { ValidationService, validateRequest } from './validation/service';
export { isValidUUID, isValidEmail, isValidUserRole } from './validation/service'; 