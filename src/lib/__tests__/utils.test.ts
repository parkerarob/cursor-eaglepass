import { 
  cn, 
  formatUserName, 
  formatDuration, 
  getSortableName, 
  splitFullName, 
  extractNameFromEmail,
  testExtractNameFromEmail,
  testSplitFullName,
  generateUUID
} from '../utils';
import { User } from '@/types';

describe('Utils - Comprehensive Coverage', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toContain('class1');
      expect(cn('class1', 'class2')).toContain('class2');
    });

    it('should handle conditional classes', () => {
      expect(cn('base', true && 'conditional')).toContain('base');
      expect(cn('base', true && 'conditional')).toContain('conditional');
      expect(cn('base', false && 'conditional')).toContain('base');
      expect(cn('base', false && 'conditional')).not.toContain('conditional');
    });

    it('should handle empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
      expect(cn('', '')).toBe('');
    });

    it('should handle complex class combinations', () => {
      const result = cn(
        'px-4 py-2',
        'bg-blue-500 hover:bg-blue-600',
        'text-white font-semibold',
        'rounded-lg shadow-md'
      );
      expect(result).toContain('px-4');
      expect(result).toContain('bg-blue-500');
      expect(result).toContain('text-white');
      expect(result).toContain('rounded-lg');
    });
  });

  describe('formatUserName', () => {
    it('should format user with first and last name', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };
      expect(formatUserName(user)).toBe('John Doe');
    });

    it('should format user with only name field', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'student'
      };
      expect(formatUserName(user)).toBe('John Doe');
    });

    it('should format user with only email', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        role: 'student'
      };
      expect(formatUserName(user)).toBe('john@example.com');
    });

    it('should handle null user', () => {
      expect(formatUserName(null)).toBe('Unknown User');
    });

    it('should handle undefined user', () => {
      expect(formatUserName(undefined)).toBe('Unknown User');
    });

    it('should handle user with empty fields', () => {
      const user: User = {
        id: '1',
        email: '',
        role: 'student'
      };
      expect(formatUserName(user)).toBe('Unnamed User');
    });

    it('should prefer firstName/lastName over name field', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        name: 'Different Name',
        role: 'student'
      };
      expect(formatUserName(user)).toBe('John Doe');
    });

    it('should handle partial name fields', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        firstName: 'John',
        role: 'student'
      };
      expect(formatUserName(user)).toBe('john@example.com');
    });
  });

  describe('formatDuration', () => {
    it('should format minutes under 60', () => {
      expect(formatDuration(30)).toBe('30m');
      expect(formatDuration(45)).toBe('45m');
      expect(formatDuration(59)).toBe('59m');
    });

    it('should format exact hours', () => {
      expect(formatDuration(60)).toBe('1h 0m');
      expect(formatDuration(120)).toBe('2h 0m');
      expect(formatDuration(180)).toBe('3h 0m');
    });

    it('should format hours with minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(135)).toBe('2h 15m');
      expect(formatDuration(195)).toBe('3h 15m');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0m');
    });

    it('should handle decimal minutes', () => {
      expect(formatDuration(45.5)).toBe('46m');
      expect(formatDuration(90.7)).toBe('1h 31m');
    });

    it('should handle large durations', () => {
      expect(formatDuration(1440)).toBe('24h 0m'); // 1 day
      expect(formatDuration(1500)).toBe('25h 0m'); // 25 hours
    });
  });

  describe('getSortableName', () => {
    it('should format user with first and last name', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };
      expect(getSortableName(user)).toBe('Doe, John');
    });

    it('should format user with only name field (multiple words)', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'student'
      };
      expect(getSortableName(user)).toBe('Doe, John');
    });

    it('should format user with three-part name', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        name: 'John Michael Doe',
        role: 'student'
      };
      expect(getSortableName(user)).toBe('Doe, John Michael');
    });

    it('should handle single name', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        name: 'John',
        role: 'student'
      };
      expect(getSortableName(user)).toBe('John');
    });

    it('should fallback to email when no name', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        role: 'student'
      };
      expect(getSortableName(user)).toBe('john@example.com');
    });

    it('should handle empty email as fallback', () => {
      const user: User = {
        id: '1',
        email: '',
        role: 'student'
      };
      expect(getSortableName(user)).toBe('Unknown');
    });

    it('should prefer firstName/lastName over name field', () => {
      const user: User = {
        id: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        name: 'Different Name',
        role: 'student'
      };
      expect(getSortableName(user)).toBe('Doe, John');
    });
  });

  describe('splitFullName', () => {
    it('should handle null/undefined input', () => {
      expect(splitFullName(null as any)).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
      expect(splitFullName(undefined as any)).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
    });

    it('should handle empty string', () => {
      expect(splitFullName('')).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
      expect(splitFullName('   ')).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
    });

    it('should handle single name', () => {
      expect(splitFullName('John')).toEqual({
        firstName: 'John',
        lastName: '',
        confidence: 'low'
      });
    });

    it('should handle two names with high confidence', () => {
      expect(splitFullName('John Doe')).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        confidence: 'high'
      });
    });

    it('should handle three names with suffix', () => {
      expect(splitFullName('John Doe Jr.')).toEqual({
        firstName: 'John',
        lastName: 'Doe Jr.',
        confidence: 'high'
      });
      expect(splitFullName('John Smith Sr')).toEqual({
        firstName: 'John',
        lastName: 'Smith Sr',
        confidence: 'high'
      });
      expect(splitFullName('John Doe III')).toEqual({
        firstName: 'John',
        lastName: 'Doe III',
        confidence: 'high'
      });
    });

    it('should handle three names without suffix', () => {
      expect(splitFullName('John Michael Doe')).toEqual({
        firstName: 'John Michael',
        lastName: 'Doe',
        confidence: 'medium'
      });
    });

    it('should handle four or more names', () => {
      expect(splitFullName('John Michael Patrick Doe')).toEqual({
        firstName: 'John Michael Patrick',
        lastName: 'Doe',
        confidence: 'medium'
      });
    });

    it('should handle extra whitespace', () => {
      expect(splitFullName('  John   Doe  ')).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        confidence: 'high'
      });
    });

    it('should handle non-string input', () => {
      expect(splitFullName(123 as any)).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
    });

    it('should handle all suffix variants', () => {
      const suffixes = ['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      suffixes.forEach(suffix => {
        expect(splitFullName(`John Doe ${suffix}`)).toEqual({
          firstName: 'John',
          lastName: `Doe ${suffix}`,
          confidence: 'high'
        });
      });
    });
  });

  describe('extractNameFromEmail', () => {
    it('should extract name from valid nhcs.net email', () => {
      expect(extractNameFromEmail('john.doe@nhcs.net')).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        confidence: 'high'
      });
    });

    it('should handle capitalization', () => {
      expect(extractNameFromEmail('JOHN.DOE@NHCS.NET')).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        confidence: 'high'
      });
    });

    it('should handle null/undefined input', () => {
      expect(extractNameFromEmail(null as any)).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
      expect(extractNameFromEmail(undefined as any)).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
    });

    it('should handle empty string', () => {
      expect(extractNameFromEmail('')).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
    });

    it('should reject non-nhcs.net emails', () => {
      expect(extractNameFromEmail('john.doe@gmail.com')).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
    });

    it('should handle malformed emails', () => {
      expect(extractNameFromEmail('john@nhcs.net')).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
      expect(extractNameFromEmail('john.@nhcs.net')).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
      expect(extractNameFromEmail('.doe@nhcs.net')).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
      expect(extractNameFromEmail('@nhcs.net')).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
    });

    it('should handle whitespace', () => {
      expect(extractNameFromEmail('  john.doe@nhcs.net  ')).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        confidence: 'high'
      });
    });

    it('should handle non-string input', () => {
      expect(extractNameFromEmail(123 as any)).toEqual({
        firstName: '',
        lastName: '',
        confidence: 'low'
      });
    });
  });

  describe('testExtractNameFromEmail', () => {
    it('should run without errors', () => {
      expect(() => testExtractNameFromEmail()).not.toThrow();
    });
  });

  describe('testSplitFullName', () => {
    it('should run without errors', () => {
      expect(() => testSplitFullName()).not.toThrow();
    });
  });

  describe('generateUUID', () => {
    it('should generate a valid UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toBeTruthy();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBeGreaterThan(0);
    });

    it('should generate different UUIDs on subsequent calls', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });

    it('should generate UUID with expected format', () => {
      const uuid = generateUUID();
      // Basic format check - should have length and contain some expected characters
      expect(uuid.length).toBeGreaterThan(10);
      expect(uuid).toMatch(/[a-f0-9-]/);
    });

    it('should consistently generate valid UUIDs', () => {
      for (let i = 0; i < 10; i++) {
        const uuid = generateUUID();
        expect(uuid).toBeTruthy();
        expect(typeof uuid).toBe('string');
        expect(uuid.length).toBeGreaterThan(0);
      }
    });
  });
}); 