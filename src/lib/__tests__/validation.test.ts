import { 
  ValidationService, 
  isValidUUID, 
  isValidEmail, 
  isValidUserRole,
  ValidatedUser,
  ValidatedLocation,
  ValidatedPass,
  ValidatedPassFormData,
  ValidatedEventLog,
  ValidatedEmergencyContact
} from '../validation';

describe('ValidationService - Comprehensive Coverage', () => {
  describe('sanitizeString', () => {
    it('should sanitize HTML tags', () => {
      expect(ValidationService.sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(ValidationService.sanitizeString('<img src="x" onerror="alert(1)">')).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(ValidationService.sanitizeString(null)).toBe('');
      expect(ValidationService.sanitizeString(undefined)).toBe('');
    });

    it('should handle non-string types', () => {
      expect(ValidationService.sanitizeString(123)).toBe('123');
      expect(ValidationService.sanitizeString(true)).toBe('true');
      expect(ValidationService.sanitizeString({})).toBe('[object Object]');
    });

    it('should trim whitespace', () => {
      expect(ValidationService.sanitizeString('  hello world  ')).toBe('hello world');
    });

    it('should handle empty strings', () => {
      expect(ValidationService.sanitizeString('')).toBe('');
      expect(ValidationService.sanitizeString('   ')).toBe('');
    });
  });

  describe('validateUser', () => {
    const validUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'student'
    };

    it('should validate correct user data', () => {
      const result = ValidationService.validateUser(validUser);
      expect(result).toEqual(validUser);
    });

    it('should throw error for invalid user data', () => {
      expect(() => ValidationService.validateUser({ ...validUser, email: 'invalid-email' }))
        .toThrow('User validation failed');
    });

    it('should sanitize string fields', () => {
      const userWithHtml = {
        ...validUser,
        firstName: '<script>alert("xss")</script>John',
        lastName: 'Doe<img src="x" onerror="alert(1)">'
      };
      const result = ValidationService.validateUser(userWithHtml);
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should handle missing required fields', () => {
      expect(() => ValidationService.validateUser({ ...validUser, id: undefined }))
        .toThrow('User validation failed');
      expect(() => ValidationService.validateUser({ ...validUser, email: undefined }))
        .toThrow('User validation failed');
    });

    it('should handle invalid role', () => {
      expect(() => ValidationService.validateUser({ ...validUser, role: 'invalid-role' }))
        .toThrow('User validation failed');
    });
  });

  describe('validatePassFormData', () => {
    const validFormData = {
      studentId: '123e4567-e89b-12d3-a456-426614174000',
      destinationLocationId: '123e4567-e89b-12d3-a456-426614174001',
      reason: 'Bathroom',
      expectedDuration: 5
    };

    it('should validate correct form data', () => {
      const result = ValidationService.validatePassFormData(validFormData);
      expect(result).toEqual(validFormData);
    });

    it('should throw error for invalid form data', () => { 
      expect(() => ValidationService.validatePassFormData({ ...validFormData, studentId: 'invalid-uuid' }))
        .toThrow('Pass form validation failed');
    });

    it('should handle missing required fields', () => {
      expect(() => ValidationService.validatePassFormData({ ...validFormData, studentId: undefined }))
        .toThrow('Pass form validation failed');
    });

    it('should handle invalid expectedDuration', () => {
      expect(() => ValidationService.validatePassFormData({ ...validFormData, expectedDuration: -1 }))
        .toThrow('Pass form validation failed');
      expect(() => ValidationService.validatePassFormData({ ...validFormData, expectedDuration: 'not-a-number' }))
        .toThrow('Pass form validation failed');
    });
  });

  describe('validatePass', () => {
    const validPass = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      studentId: '123e4567-e89b-12d3-a456-426614174001',
      teacherId: '123e4567-e89b-12d3-a456-426614174002',
      destinationLocationId: '123e4567-e89b-12d3-a456-426614174003',
      reason: 'Bathroom',
      status: 'active',
      expectedDuration: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should validate correct pass data', () => {
      const result = ValidationService.validatePass(validPass);
      expect(result.id).toBe(validPass.id);
      expect(result.reason).toBe(validPass.reason);
    });

    it('should throw error for invalid pass data', () => {
      expect(() => ValidationService.validatePass({ ...validPass, status: 'invalid-status' }))
        .toThrow('Pass validation failed');
    });

    it('should handle missing required fields', () => {
      expect(() => ValidationService.validatePass({ ...validPass, id: undefined }))
        .toThrow('Pass validation failed');
    });
  });

  describe('validateLocation', () => {
    const validLocation = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Library',
      teacherName: 'Ms. Smith',
      capacity: 30,
      isActive: true
    };

    it('should validate correct location data', () => {
      const result = ValidationService.validateLocation(validLocation);
      expect(result).toEqual(validLocation);
    });

    it('should sanitize string fields', () => {
      const locationWithHtml = {
        ...validLocation,
        name: '<script>alert("xss")</script>Library',
        teacherName: 'Ms. Smith<img src="x" onerror="alert(1)">'
      };
      const result = ValidationService.validateLocation(locationWithHtml);
      expect(result.name).toBe('Library');
      expect(result.teacherName).toBe('Ms. Smith');
    });

    it('should throw error for invalid location data', () => {
      expect(() => ValidationService.validateLocation({ ...validLocation, capacity: -1 }))
        .toThrow('Location validation failed');
    });

    it('should handle missing required fields', () => {
      expect(() => ValidationService.validateLocation({ ...validLocation, id: undefined }))
        .toThrow('Location validation failed');
    });
  });

  describe('validateEventLog', () => {
    const validEventLog = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      passId: '123e4567-e89b-12d3-a456-426614174001',
      userId: '123e4567-e89b-12d3-a456-426614174002',
      action: 'created',
      details: 'Pass created for bathroom visit',
      timestamp: new Date()
    };

    it('should validate correct event log data', () => {
      const result = ValidationService.validateEventLog(validEventLog);
      expect(result.action).toBe(validEventLog.action);
      expect(result.details).toBe(validEventLog.details);
    });

    it('should sanitize details field', () => {
      const logWithHtml = {
        ...validEventLog,
        details: '<script>alert("xss")</script>Pass created'
      };
      const result = ValidationService.validateEventLog(logWithHtml);
      expect(result.details).toBe('Pass created');
    });

    it('should throw error for invalid event log data', () => {
      expect(() => ValidationService.validateEventLog({ ...validEventLog, action: 'invalid-action' }))
        .toThrow('Event log validation failed');
    });

    it('should handle missing required fields', () => {
      expect(() => ValidationService.validateEventLog({ ...validEventLog, id: undefined }))
        .toThrow('Event log validation failed');
    });
  });

  describe('validateEmergencyContact', () => {
    const validContact = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      relationship: 'Parent',
      email: 'john@example.com',
      phone: '555-123-4567',
      isActive: true
    };

    it('should validate correct emergency contact data', () => {
      const result = ValidationService.validateEmergencyContact(validContact);
      expect(result).toEqual(validContact);
    });

    it('should sanitize string fields', () => {
      const contactWithHtml = {
        ...validContact,
        name: '<script>alert("xss")</script>John Doe',
        relationship: 'Parent<img src="x" onerror="alert(1)">',
        email: 'john@example.com<script>alert(1)</script>',
        phone: '555-123-4567<script>alert(1)</script>'
      };
      const result = ValidationService.validateEmergencyContact(contactWithHtml);
      expect(result.name).toBe('John Doe');
      expect(result.relationship).toBe('Parent');
      expect(result.email).toBe('john@example.com');
      expect(result.phone).toBe('555-123-4567');
    });

    it('should throw error for invalid emergency contact data', () => {
      expect(() => ValidationService.validateEmergencyContact({ ...validContact, email: 'invalid-email' }))
        .toThrow('Emergency contact validation failed');
    });

    it('should handle missing required fields', () => {
      expect(() => ValidationService.validateEmergencyContact({ ...validContact, id: undefined }))
        .toThrow('Emergency contact validation failed');
    });
  });

  describe('validateUUID', () => {
    it('should validate correct UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(ValidationService.validateUUID(uuid)).toBe(uuid);
    });

    it('should throw error for invalid UUID', () => {
      expect(() => ValidationService.validateUUID('invalid-uuid')).toThrow('Invalid UUID format');
      expect(() => ValidationService.validateUUID('')).toThrow('Invalid UUID format');
      expect(() => ValidationService.validateUUID(null)).toThrow('Invalid UUID format');
      expect(() => ValidationService.validateUUID(undefined)).toThrow('Invalid UUID format');
      expect(() => ValidationService.validateUUID(123)).toThrow('Invalid UUID format');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email', () => {
      expect(ValidationService.validateEmail('test@example.com')).toBe('test@example.com');
      expect(ValidationService.validateEmail('user.name@domain.co.uk')).toBe('user.name@domain.co.uk');
    });

    it('should sanitize email input', () => {
      expect(ValidationService.validateEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('should throw error for invalid email', () => {
      expect(() => ValidationService.validateEmail('invalid-email')).toThrow('Invalid email format');
      expect(() => ValidationService.validateEmail('')).toThrow('Invalid email format');
      expect(() => ValidationService.validateEmail(null)).toThrow('Invalid email format');
      expect(() => ValidationService.validateEmail(undefined)).toThrow('Invalid email format');
      expect(() => ValidationService.validateEmail(123)).toThrow('Invalid email format');
    });
  });

  describe('validateArray', () => {
    const validUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'student'
    };

    it('should validate array of valid items', () => {
      const users = [validUser, { ...validUser, id: '123e4567-e89b-12d3-a456-426614174001' }];
      const result = ValidationService.validateArray(users, ValidationService.validateUser);
      
      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed valid and invalid items', () => {
      const users = [
        validUser,
        { ...validUser, email: 'invalid-email' }, // Invalid
        { ...validUser, id: '123e4567-e89b-12d3-a456-426614174001' }
      ];
      const result = ValidationService.validateArray(users, ValidationService.validateUser);
      
      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[0].error).toContain('User validation failed');
    });

    it('should handle empty array', () => {
      const result = ValidationService.validateArray([], ValidationService.validateUser);
      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle all invalid items', () => {
      const invalidUsers = [
        { ...validUser, email: 'invalid1' },
        { ...validUser, email: 'invalid2' }
      ];
      const result = ValidationService.validateArray(invalidUsers, ValidationService.validateUser);
      
      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('checkForSuspiciousPatterns', () => {
    it('should detect script tags', () => {
      expect(ValidationService.checkForSuspiciousPatterns('<script>alert(1)</script>')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
    });

    it('should detect javascript URLs', () => {
      expect(ValidationService.checkForSuspiciousPatterns('javascript:alert(1)')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('JAVASCRIPT:alert(1)')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(ValidationService.checkForSuspiciousPatterns('onclick=alert(1)')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('onload = alert(1)')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('onmouseover=alert(1)')).toBe(true);
    });

    it('should detect data URLs', () => {
      expect(ValidationService.checkForSuspiciousPatterns('data:text/html,<script>alert(1)</script>')).toBe(true);
    });

    it('should detect various suspicious patterns', () => {
      expect(ValidationService.checkForSuspiciousPatterns('vbscript:alert(1)')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('expression(alert(1))')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('[object Object]')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('eval(alert(1))')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('setTimeout(alert, 1000)')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('setInterval(alert, 1000)')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('${alert(1)}')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('<%=alert(1)%>')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('%3Cscript%3E')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('../../../etc/passwd')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('__proto__')).toBe(true);
      expect(ValidationService.checkForSuspiciousPatterns('constructor')).toBe(true);
    });

    it('should not flag safe content', () => {
      expect(ValidationService.checkForSuspiciousPatterns('Hello World')).toBe(false);
      expect(ValidationService.checkForSuspiciousPatterns('This is a normal string')).toBe(false);
      expect(ValidationService.checkForSuspiciousPatterns('user@example.com')).toBe(false);
      expect(ValidationService.checkForSuspiciousPatterns('123-456-7890')).toBe(false);
    });
  });

  describe('sanitizeAndValidateInput', () => {
    it('should sanitize and validate clean input', () => {
      const result = ValidationService.sanitizeAndValidateInput('Hello World', 'test');
      expect(result).toBe('Hello World');
    });

    it('should throw error for non-string input', () => {
      expect(() => ValidationService.sanitizeAndValidateInput(123, 'test'))
        .toThrow('test: Input must be a string');
      expect(() => ValidationService.sanitizeAndValidateInput(null, 'test'))
        .toThrow('test: Input must be a string');
      expect(() => ValidationService.sanitizeAndValidateInput(undefined, 'test'))
        .toThrow('test: Input must be a string');
    });

    it('should throw error for suspicious patterns', () => {
      expect(() => ValidationService.sanitizeAndValidateInput('<script>alert(1)</script>', 'test'))
        .toThrow('test: Input contains suspicious patterns');
      expect(() => ValidationService.sanitizeAndValidateInput('javascript:alert(1)', 'test'))
        .toThrow('test: Input contains suspicious patterns');
    });

    it('should throw error for empty input after sanitization', () => {
      expect(() => ValidationService.sanitizeAndValidateInput('', 'test'))
        .toThrow('test: Input cannot be empty after sanitization');
      expect(() => ValidationService.sanitizeAndValidateInput('   ', 'test'))
        .toThrow('test: Input cannot be empty after sanitization');
    });

    it('should handle input that becomes empty after HTML sanitization', () => {
      expect(() => ValidationService.sanitizeAndValidateInput('<div></div>', 'test'))
        .toThrow('test: Input cannot be empty after sanitization');
    });
  });

  describe('helper functions', () => {
    describe('isValidUUID', () => {
      it('should return true for valid UUIDs', () => {
        expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
      });

      it('should return false for invalid UUIDs', () => {
        expect(isValidUUID('invalid-uuid')).toBe(false);
        expect(isValidUUID('')).toBe(false);
        expect(isValidUUID(null)).toBe(false);
        expect(isValidUUID(undefined)).toBe(false);
        expect(isValidUUID(123)).toBe(false);
      });
    });

    describe('isValidEmail', () => {
      it('should return true for valid emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should return false for invalid emails', () => {
        expect(isValidEmail('invalid-email')).toBe(false);
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail(null)).toBe(false);
        expect(isValidEmail(undefined)).toBe(false);
        expect(isValidEmail(123)).toBe(false);
      });
    });

    describe('isValidUserRole', () => {
      it('should return true for valid roles', () => {
        expect(isValidUserRole('student')).toBe(true);
        expect(isValidUserRole('teacher')).toBe(true);
        expect(isValidUserRole('admin')).toBe(true);
      });

      it('should return false for invalid roles', () => {
        expect(isValidUserRole('invalid-role')).toBe(false);
        expect(isValidUserRole('')).toBe(false);
        expect(isValidUserRole(null)).toBe(false);
        expect(isValidUserRole(undefined)).toBe(false);
        expect(isValidUserRole(123)).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should handle ZodError properly in validateUser', () => {
      try {
        ValidationService.validateUser({ invalid: 'data' });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('User validation failed');
      }
    });

    it('should handle non-ZodError in validateUser', () => {
      // Mock to throw a non-ZodError
      const originalParse = require('zod').z.string().email().parse;
      jest.spyOn(require('../validation'), 'userSchema', 'get').mockReturnValue({
        parse: () => { throw new Error('Custom error'); }
      });

      try {
        ValidationService.validateUser({});
      } catch (error) {
        expect(error.message).toBe('Custom error');
      }
    });
  });
}); 