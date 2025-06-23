import { RateLimiter, checkPassCreationRateLimit, checkLoginRateLimit } from '../rateLimiter';

// Mock console.error to capture security event logs
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock Date.now for predictable testing
const mockDateNow = jest.spyOn(Date, 'now');

describe.skip('RateLimiter', () => {
  let originalDateNow: typeof Date.now;
  let mockTime: number;

  beforeAll(() => {
    originalDateNow = Date.now;
    mockTime = 1700000000000; // Fixed timestamp
  });

  beforeEach(() => {
    // Reset the rate limiter's internal state
    (RateLimiter as any).limits.clear();
    
    // Reset time to base time
    mockTime = 1700000000000;
    mockDateNow.mockImplementation(() => mockTime);
    
    // Clear console.error mock
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    // Restore original Date.now
    mockDateNow.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('checkRateLimit', () => {
    it('should allow first request and return remaining requests', () => {
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4); // 5 max - 1 used
      expect(result.resetTime).toBe(mockTime + 60000); // 1 minute window
      expect(result.error).toBeUndefined();
    });

    it('should track multiple requests within window', () => {
      // First request
      let result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
      
      // Second request
      result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(3);
      
      // Third request
      result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(2);
    });

    it('should block requests when limit is exceeded', () => {
      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // 6th request should be blocked
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBeUndefined();
      expect(result.resetTime).toBe(mockTime + 60000);
      expect(result.error).toContain('Rate limit exceeded for PASS_CREATION');
    });

    it('should detect rapid attempts and extend ban', () => {
      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // Rapid attempt (within 1 second)
      mockTime += 500; // 0.5 seconds later
      mockDateNow.mockImplementation(() => mockTime);
      
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBe(mockTime + 120000); // Extended to 2 minutes
      
      // Should log security event
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[SECURITY EVENT] RAPID_ATTEMPTS',
        expect.objectContaining({
          userId: 'user1',
          operation: 'PASS_CREATION',
          attempts: 5,
          timeSinceLastAttempt: 500
        })
      );
    });

    it('should reset window when time expires', () => {
      // Use up all requests
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // Try again - should be blocked
      let result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);
      
      // Move time forward past window
      mockTime += 60001; // 1 minute + 1ms
      mockDateNow.mockImplementation(() => mockTime);
      
      // Should now allow new requests
      result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
      expect(result.resetTime).toBe(mockTime + 60000);
    });

    it('should handle different operations independently', () => {
      // Use up PASS_CREATION limit
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // LOGIN_ATTEMPTS should still work
      const loginResult = RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      expect(loginResult.allowed).toBe(true);
      expect(loginResult.remainingRequests).toBe(4); // LOGIN has 5 max requests
      
      // PASS_UPDATE should also work
      const updateResult = RateLimiter.checkRateLimit('user1', 'PASS_UPDATE');
      expect(updateResult.allowed).toBe(true);
      expect(updateResult.remainingRequests).toBe(9); // PASS_UPDATE has 10 max requests
    });

    it('should handle different users independently', () => {
      // Use up user1's limit
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // user2 should still be able to make requests
      const result = RateLimiter.checkRateLimit('user2', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
    });

    it('should handle LOGIN_ATTEMPTS configuration correctly', () => {
      // LOGIN_ATTEMPTS has 5 max requests and 5 minute window
      const result = RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
      expect(result.resetTime).toBe(mockTime + 300000); // 5 minutes
    });

    it('should handle PASS_UPDATE configuration correctly', () => {
      // PASS_UPDATE has 10 max requests and 1 minute window
      const result = RateLimiter.checkRateLimit('user1', 'PASS_UPDATE');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(9);
      expect(result.resetTime).toBe(mockTime + 60000); // 1 minute
    });
  });

  describe('resetRateLimit', () => {
    it('should reset specific operation for user', () => {
      // Use up limit
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // Should be blocked
      let result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);
      
      // Reset the limit
      RateLimiter.resetRateLimit('user1', 'PASS_CREATION');
      
      // Should now work
      result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
    });

    it('should reset all operations for user when operation not specified', () => {
      // Use up limits for multiple operations
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
        RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      }
      
      // Both should be blocked
      let passResult = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      let loginResult = RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      expect(passResult.allowed).toBe(false);
      expect(loginResult.allowed).toBe(false);
      
      // Reset all operations for user1
      RateLimiter.resetRateLimit('user1');
      
      // Both should now work
      passResult = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      loginResult = RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      expect(passResult.allowed).toBe(true);
      expect(loginResult.allowed).toBe(true);
    });

    it('should not affect other users when resetting', () => {
      // Use up limits for both users
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
        RateLimiter.checkRateLimit('user2', 'PASS_CREATION');
      }
      
      // Reset only user1
      RateLimiter.resetRateLimit('user1', 'PASS_CREATION');
      
      // user1 should work, user2 should still be blocked
      const user1Result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      const user2Result = RateLimiter.checkRateLimit('user2', 'PASS_CREATION');
      
      expect(user1Result.allowed).toBe(true);
      expect(user2Result.allowed).toBe(false);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status for all operations', () => {
      const status = RateLimiter.getRateLimitStatus('user1');
      
      expect(status).toHaveProperty('PASS_CREATION');
      expect(status).toHaveProperty('PASS_UPDATE');
      expect(status).toHaveProperty('LOGIN_ATTEMPTS');
      
      // All should show no usage initially
      expect(status.PASS_CREATION.count).toBe(0);
      expect(status.PASS_CREATION.maxRequests).toBe(5);
      expect(status.PASS_CREATION.resetTime).toBe(0);
      expect(status.PASS_CREATION.timeRemaining).toBe(0);
    });

    it('should show current usage when user has made requests', () => {
      // Make some requests
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      
      const status = RateLimiter.getRateLimitStatus('user1');
      
      expect(status.PASS_CREATION.count).toBe(2);
      expect(status.PASS_CREATION.maxRequests).toBe(5);
      expect(status.PASS_CREATION.resetTime).toBe(mockTime + 60000);
      expect(status.PASS_CREATION.timeRemaining).toBe(60000);
      
      expect(status.LOGIN_ATTEMPTS.count).toBe(1);
      expect(status.LOGIN_ATTEMPTS.maxRequests).toBe(5);
      expect(status.LOGIN_ATTEMPTS.resetTime).toBe(mockTime + 300000);
      expect(status.LOGIN_ATTEMPTS.timeRemaining).toBe(300000);
      
      expect(status.PASS_UPDATE.count).toBe(0);
    });

    it('should show zero counts for expired windows', () => {
      // Make requests
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      // Move time forward past window
      mockTime += 60001;
      mockDateNow.mockImplementation(() => mockTime);
      
      const status = RateLimiter.getRateLimitStatus('user1');
      
      expect(status.PASS_CREATION.count).toBe(0);
      expect(status.PASS_CREATION.resetTime).toBe(0);
      expect(status.PASS_CREATION.timeRemaining).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      // Create some entries
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user2', 'LOGIN_ATTEMPTS');
      
      // Verify entries exist
      const limitsMap = (RateLimiter as any).limits;
      expect(limitsMap.size).toBe(2);
      
      // Move time forward to expire PASS_CREATION (1 minute window)
      mockTime += 60001;
      mockDateNow.mockImplementation(() => mockTime);
      
      // Run cleanup
      RateLimiter.cleanup();
      
      // Should have removed expired PASS_CREATION but kept LOGIN_ATTEMPTS (5 minute window)
      expect(limitsMap.size).toBe(1);
      expect(limitsMap.has('user2:LOGIN_ATTEMPTS')).toBe(true);
      expect(limitsMap.has('user1:PASS_CREATION')).toBe(false);
    });

    it('should handle empty limits map', () => {
      // Cleanup with no entries should not throw
      expect(() => RateLimiter.cleanup()).not.toThrow();
    });

    it('should handle all expired entries', () => {
      // Create entries
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user2', 'LOGIN_ATTEMPTS');
      
      // Move time forward to expire all
      mockTime += 300001; // Past LOGIN_ATTEMPTS window (5 minutes)
      mockDateNow.mockImplementation(() => mockTime);
      
      RateLimiter.cleanup();
      
      const limitsMap = (RateLimiter as any).limits;
      expect(limitsMap.size).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for active entries', () => {
      // Create some entries
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user2', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user3', 'LOGIN_ATTEMPTS');
      
      const stats = RateLimiter.getStatistics();
      
      expect(stats.totalActiveEntries).toBe(3);
      expect(stats.entriesByOperation.PASS_CREATION).toBe(2);
      expect(stats.entriesByOperation.LOGIN_ATTEMPTS).toBe(1);
      expect(stats.recentViolations).toEqual([]);
    });

    it('should identify recent violations', () => {
      // Create violations by exceeding limits
      for (let i = 0; i < 6; i++) { // Exceed 5 limit
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      const stats = RateLimiter.getStatistics();
      
      expect(stats.recentViolations).toHaveLength(1);
      expect(stats.recentViolations[0]).toEqual({
        userId: 'user1',
        operation: 'PASS_CREATION',
        count: 5,
        resetTime: mockTime + 60000
      });
    });

    it('should exclude expired entries from statistics', () => {
      // Create entry
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      // Move time forward to expire
      mockTime += 60001;
      mockDateNow.mockImplementation(() => mockTime);
      
      const stats = RateLimiter.getStatistics();
      
      expect(stats.totalActiveEntries).toBe(0);
      expect(stats.entriesByOperation).toEqual({});
      expect(stats.recentViolations).toEqual([]);
    });

    it('should handle empty state', () => {
      const stats = RateLimiter.getStatistics();
      
      expect(stats.totalActiveEntries).toBe(0);
      expect(stats.entriesByOperation).toEqual({});
      expect(stats.recentViolations).toEqual([]);
    });
  });

  describe('updateConfig', () => {
    it('should update max requests', () => {
      RateLimiter.updateConfig('PASS_CREATION', { maxRequests: 10 });
      
      // Should now allow 10 requests instead of 5
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.remainingRequests).toBe(9); // 10 - 1
    });

    it('should update window time', () => {
      RateLimiter.updateConfig('PASS_CREATION', { windowMs: 120000 }); // 2 minutes
      
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.resetTime).toBe(mockTime + 120000);
    });

    it('should update both parameters', () => {
      RateLimiter.updateConfig('PASS_CREATION', { 
        maxRequests: 8,
        windowMs: 90000 
      });
      
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.remainingRequests).toBe(7); // 8 - 1
      expect(result.resetTime).toBe(mockTime + 90000);
    });

    it('should only update provided parameters', () => {
      // Get original config
      const originalResult = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      const originalResetTime = originalResult.resetTime!;
      
      // Reset to test again
      RateLimiter.resetRateLimit('user1', 'PASS_CREATION');
      
      // Update only maxRequests
      RateLimiter.updateConfig('PASS_CREATION', { maxRequests: 8 });
      
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.remainingRequests).toBe(7); // Updated
      expect(result.resetTime).toBe(mockTime + 60000); // Still original window
    });
  });

  describe('utility functions', () => {
    it('should provide checkPassCreationRateLimit utility', () => {
      const result = checkPassCreationRateLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
    });

    it('should provide checkLoginRateLimit utility', () => {
      const result = checkLoginRateLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
    });

    it('should work independently', () => {
      // Use up pass creation limit
      for (let i = 0; i < 5; i++) {
        checkPassCreationRateLimit('user1');
      }
      
      // Login should still work
      const loginResult = checkLoginRateLimit('user1');
      expect(loginResult.allowed).toBe(true);
      
      // Pass creation should be blocked
      const passResult = checkPassCreationRateLimit('user1');
      expect(passResult.allowed).toBe(false);
    });
  });

  describe('security event logging', () => {
    it('should log security events for rapid attempts', () => {
      // Use up limit
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // Rapid attempt
      mockTime += 500;
      mockDateNow.mockImplementation(() => mockTime);
      
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[SECURITY EVENT] RAPID_ATTEMPTS',
        expect.objectContaining({
          userId: 'user1',
          operation: 'PASS_CREATION',
          timestamp: expect.any(String),
          attempts: 5,
          timeSinceLastAttempt: 500
        })
      );
    });

    it('should include timestamp in security events', () => {
      // Use up limit
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      }
      
      // Rapid attempt
      mockTime += 100;
      mockDateNow.mockImplementation(() => mockTime);
      
      RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      
      const logCall = mockConsoleError.mock.calls[0];
      expect(logCall[1].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle user ID with colon', () => {
      const userIdWithColon = 'user:with:colons';
      
      const result = RateLimiter.checkRateLimit(userIdWithColon, 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      
      // Should still work for reset
      RateLimiter.resetRateLimit(userIdWithColon, 'PASS_CREATION');
    });

    it('should handle very long user IDs', () => {
      const longUserId = 'a'.repeat(1000);
      
      const result = RateLimiter.checkRateLimit(longUserId, 'PASS_CREATION');
      expect(result.allowed).toBe(true);
    });

    it('should handle concurrent operations correctly', () => {
      // Simulate concurrent requests by not advancing time
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(RateLimiter.checkRateLimit('user1', 'PASS_CREATION'));
      }
      
      // All should be allowed since they're within limit
      results.forEach((result, index) => {
        expect(result.allowed).toBe(true);
        expect(result.remainingRequests).toBe(4 - index);
      });
    });

    it('should handle time going backwards gracefully', () => {
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      // Simulate time going backwards
      mockTime -= 1000;
      mockDateNow.mockImplementation(() => mockTime);
      
      // Should still work (entry should be considered active)
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
    });
  });

  describe('configuration constants', () => {
    it('should have correct default configuration', () => {
      const config = (RateLimiter as any).CONFIG;
      
      expect(config.PASS_CREATION).toEqual({
        maxRequests: 5,
        windowMs: 60000,
        operation: 'pass_creation'
      });
      
      expect(config.PASS_UPDATE).toEqual({
        maxRequests: 10,
        windowMs: 60000,
        operation: 'pass_update'
      });
      
      expect(config.LOGIN_ATTEMPTS).toEqual({
        maxRequests: 5,
        windowMs: 300000,
        operation: 'login'
      });
    });
  });
}); 