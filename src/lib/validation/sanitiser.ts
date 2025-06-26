import { checkForSuspiciousPatterns } from './guards';

/**
 * Phase-2: Sanitisation helpers moved from legacy validation.ts
 */

/**
 * Sanitize and validate user input
 */
export function sanitizeString(input: unknown): string {
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
 * Advanced input sanitization with security checks
 *
 * Depends on checkForSuspiciousPatterns from guards.ts
 */
export function sanitizeAndValidateInput(input: unknown, context: string): string {
  if (typeof input !== 'string') {
    throw new Error(`${context}: Input must be a string`);
  }
  // Check for suspicious patterns
  if (checkForSuspiciousPatterns(input)) {
    throw new Error(`${context}: Input contains suspicious patterns`);
  }
  // Sanitize and validate
  const sanitized = sanitizeString(input);
  if (sanitized.length === 0) {
    throw new Error(`${context}: Input cannot be empty after sanitization`);
  }
  return sanitized;
}
