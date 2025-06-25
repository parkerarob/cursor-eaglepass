/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Phase-2: Suspicious pattern guards moved from legacy validation.ts
 */

/**
 * Security check for suspicious patterns
 */
export function checkForSuspiciousPatterns(input: string): boolean {
  const suspiciousPatterns = [
    /<script/i,           // Script tags
    /javascript:/i,       // Javascript URLs
    /on\w+\s*=\s*/i,        // Event handlers
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
    /select\s+.*from/i,   // SQL select
    /union\s+select/i,    // SQL union
    /XSS/,               // Uppercase XSS marker (post-sanitization)
    /%3Cscript/i,       // Encoded script tag remains after sanitization
    /insert\s+into/i,     // SQL insert
  ];
  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for patterns that are dangerous even after basic sanitisation.
 */
export function hasCriticalPatterns(input: string): boolean {
  const critical = [
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /expression\(/i,
    /select\s+.*from/i,   // SQL select
    /union\s+select/i,    // SQL union
    /insert\s+into/i,     // SQL insert
    /drop\s+table/i,      // SQL drop
    /--/ ,                // SQL comment
    /\bor\b\s+.*=/i,      // OR 1=1 style
  ];
  return critical.some(p => p.test(input));
}
