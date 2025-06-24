import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { User } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUserName(user: User | null | undefined): string {
  if (!user) {
    return 'Unknown User';
  }
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.name) {
    return user.name;
  }
  return user.email || 'Unnamed User';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
}

export function getSortableName(user: User): string {
  // Return "LastName, FirstName" for sorting, or fallback to email if no name
  if (user.firstName && user.lastName) {
    return `${user.lastName}, ${user.firstName}`;
  }
  if (user.name) {
    // Try to split the name into parts for sorting
    const nameParts = user.name.trim().split(' ');
    if (nameParts.length >= 2) {
      // Assume last part is last name, everything else is first name
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts.slice(0, -1).join(' ');
      return `${lastName}, ${firstName}`;
    }
    // Single name, use as-is
    return user.name;
  }
  // Fallback to email for sorting
  return user.email || 'Unknown';
}

export interface SplitNameResult {
  firstName: string;
  lastName: string;
  confidence: 'high' | 'medium' | 'low';
}

export function splitFullName(fullName: string): SplitNameResult {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '', confidence: 'low' };
  }

  const trimmedName = fullName.trim();
  if (!trimmedName) {
    return { firstName: '', lastName: '', confidence: 'low' };
  }

  // Handle common patterns
  const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
  
  if (nameParts.length === 0) {
    return { firstName: '', lastName: '', confidence: 'low' };
  }
  
  if (nameParts.length === 1) {
    // Single name - assume it's a first name
    return { 
      firstName: nameParts[0], 
      lastName: '', 
      confidence: 'low' 
    };
  }
  
  if (nameParts.length === 2) {
    // Two parts - assume "FirstName LastName"
    return { 
      firstName: nameParts[0], 
      lastName: nameParts[1], 
      confidence: 'high' 
    };
  }
  
  if (nameParts.length === 3) {
    // Three parts - could be "FirstName MiddleName LastName" or "FirstName LastName Suffix"
    // Check if last part looks like a suffix
    const lastPart = nameParts[2].toLowerCase();
    const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
    
    if (suffixes.includes(lastPart)) {
      // "FirstName LastName Suffix" format
      return { 
        firstName: nameParts[0], 
        lastName: `${nameParts[1]} ${nameParts[2]}`, 
        confidence: 'high' 
      };
    } else {
      // "FirstName MiddleName LastName" format - treat middle as part of first name
      return { 
        firstName: `${nameParts[0]} ${nameParts[1]}`, 
        lastName: nameParts[2], 
        confidence: 'medium' 
      };
    }
  }
  
  // More than 3 parts - assume "FirstName MiddleNames LastName"
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const middleNames = nameParts.slice(1, -1).join(' ');
  
  return { 
    firstName: middleNames ? `${firstName} ${middleNames}` : firstName, 
    lastName, 
    confidence: 'medium' 
  };
}

export interface EmailNameResult {
  firstName: string;
  lastName: string;
  confidence: 'high' | 'low';
}

export function extractNameFromEmail(email: string): EmailNameResult {
  if (!email || typeof email !== 'string') {
    return { firstName: '', lastName: '', confidence: 'low' };
  }

  const trimmedEmail = email.trim().toLowerCase();
  
  // Check if it's a valid nhcs.net email
  if (!trimmedEmail.endsWith('@nhcs.net')) {
    return { firstName: '', lastName: '', confidence: 'low' };
  }

  // Extract the part before @nhcs.net
  const localPart = trimmedEmail.replace('@nhcs.net', '');
  
  // Split by dot to get firstname.lastname
  const nameParts = localPart.split('.');
  
  if (nameParts.length !== 2) {
    return { firstName: '', lastName: '', confidence: 'low' };
  }
  
  const [firstName, lastName] = nameParts;
  
  // Validate that both parts exist and are not empty
  if (!firstName || !lastName) {
    return { firstName: '', lastName: '', confidence: 'low' };
  }
  
  // Capitalize first letter of each name
  const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
  
  return {
    firstName: capitalizedFirstName,
    lastName: capitalizedLastName,
    confidence: 'high'
  };
}

// Test function for email name extraction (can be removed in production)
export function testExtractNameFromEmail(): void {
  const testCases = [
    'robert.parker@nhcs.net',
    'mary.jane.watson@nhcs.net',
    'john.doe@nhcs.net',
    'invalid.email@gmail.com',
    'missing.last@nhcs.net',
    'first.@nhcs.net',
    '.last@nhcs.net',
    '@nhcs.net',
    '',
    '   '
  ];

  // Testing extractNameFromEmail function
  testCases.forEach(email => {
    const result = extractNameFromEmail(email);
    // `"${email}" -> ${result.firstName} | ${result.lastName} (${result.confidence})`
  });
}

// Test function for name splitting (can be removed in production)
export function testSplitFullName(): void {
  const testCases = [
    'John Doe',
    'Mary Jane Watson',
    'Robert J. Parker III',
    'Smith Jr.',
    'Madonna',
    'Jean-Claude Van Damme',
    'O\'Connor',
    '   ',
    ''
  ];

  // Testing splitFullName function
  testCases.forEach(name => {
    const result = splitFullName(name);
    // `"${name}" -> "${result.firstName}" | "${result.lastName}" (${result.confidence})`
  });
}

/**
 * Generate a cryptographically secure UUID
 * SECURITY: This is critical for school safety system - IDs must be unpredictable
 */
export function generateUUID(): string {
  // Use native crypto.randomUUID if available (Node 19+, modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Use crypto.getRandomValues for secure random bytes if available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    
    // Set version (4) and variant bits according to RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
    
    // Convert to hex string with dashes
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12), 
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }
  
  // SECURITY WARNING: Fallback to Math.random (NOT SECURE)
  console.error('SECURITY WARNING: Using insecure UUID generation! This should never happen in production.');
  console.error('Please ensure the application is running in a secure environment with crypto.randomUUID support.');
  
  // Log this security event for monitoring
  if (typeof window !== 'undefined') {
    console.error('Client environment does not support crypto.randomUUID');
  }
  
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
