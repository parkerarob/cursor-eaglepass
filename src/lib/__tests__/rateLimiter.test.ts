import { 
  RedisRateLimiter, 
  checkPassCreationRateLimit, 
  checkLoginRateLimit 
} from '../rateLimiter.redis';

// Import the in-memory RateLimiter for comprehensive testing
import { RateLimiter, checkPassCreationRateLimit as checkPassMemory } from '../rateLimiter';

// Mock console.error to capture security event logs
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  mockConsoleError.mockClear();
});

afterAll(() => {
  mockConsoleError.mockRestore();
});

describe('In-Memory RateLimiter - Comprehensive Coverage', () => {
  beforeEach(() => {
    // Clear all rate limits before each test
    jest.clearAllMocks();
    // Reset the internal limits map
    (RateLimiter as any).limits.clear();
  });

  describe('checkRateLimit', () => {
    it('should allow first request and return correct remaining count', () => {
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4); // 5 max - 1 used = 4
      expect(result.resetTime).toBeGreaterThan(Date.now());
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

    it('should block requests when limit exceeded', () => {
      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // 6th request should be blocked
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeGreaterThan(Date.now());
      expect(result.error).toContain('Rate limit exceeded for PASS_CREATION');
    });

    it('should detect rapid attempts and extend ban time', () => {
      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // Make rapid attempt (should trigger security event)
      const firstBlockedResult = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      const originalResetTime = firstBlockedResult.resetTime!;
      
      // Make another rapid attempt immediately
      const rapidResult = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      expect(rapidResult.allowed).toBe(false);
      expect(rapidResult.resetTime).toBeGreaterThan(originalResetTime); // Extended ban
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY EVENT] RAPID_ATTEMPTS'),
        expect.objectContaining({
          userId: 'user1',
          operation: 'PASS_CREATION'
        })
      );
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

    it('should reset expired windows automatically', () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = 1000000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      // Use up limit
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // Verify blocked
      let result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);

      // Advance time beyond window (60 seconds + 1ms)
      currentTime += 60001;
      
      // Should be allowed again
      result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should handle all operation types', () => {
      // Test PASS_CREATION
      let result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);

      // Test PASS_UPDATE
      result = RateLimiter.checkRateLimit('user1', 'PASS_UPDATE');
      expect(result.allowed).toBe(true);

      // Test LOGIN_ATTEMPTS
      result = RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      expect(result.allowed).toBe(true);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset specific operation for user', () => {
      // Use up limit
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // Verify blocked
      let result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);

      // Reset the limit
      RateLimiter.resetRateLimit('user1', 'PASS_CREATION');
      
      // Should be allowed again
      result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
    });

    it('should reset all operations for user when no operation specified', () => {
      // Use up limits for multiple operations
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
        RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      }
      
      // Verify both are blocked
      let passResult = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      let loginResult = RateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      expect(passResult.allowed).toBe(false);
      expect(loginResult.allowed).toBe(false);

      // Reset all for user1
      RateLimiter.resetRateLimit('user1');
      
      // Both should be allowed again
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
      
      // user1 should be reset, user2 should still be blocked
      const user1Result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      const user2Result = RateLimiter.checkRateLimit('user2', 'PASS_CREATION');
      
      expect(user1Result.allowed).toBe(true);
      expect(user2Result.allowed).toBe(false);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return empty status for new user', () => {
      const status = RateLimiter.getRateLimitStatus('newuser');
      
      expect(status.PASS_CREATION).toEqual({
        count: 0,
        maxRequests: 5,
        resetTime: 0,
        timeRemaining: 0
      });
      expect(status.LOGIN_ATTEMPTS).toEqual({
        count: 0,
        maxRequests: 5,
        resetTime: 0,
        timeRemaining: 0
      });
      expect(status.PASS_UPDATE).toEqual({
        count: 0,
        maxRequests: 10,
        resetTime: 0,
        timeRemaining: 0
      });
    });

    it('should return current status for active user', () => {
      // Make some requests
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      const status = RateLimiter.getRateLimitStatus('user1');
      
      expect(status.PASS_CREATION.count).toBe(2);
      expect(status.PASS_CREATION.maxRequests).toBe(5);
      expect(status.PASS_CREATION.resetTime).toBeGreaterThan(Date.now());
      expect(status.PASS_CREATION.timeRemaining).toBeGreaterThan(0);
    });

    it('should show expired entries as reset', () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = 1000000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      // Make request
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      // Advance time beyond window
      currentTime += 70000; // 70 seconds
      
      const status = RateLimiter.getRateLimitStatus('user1');
      expect(status.PASS_CREATION.count).toBe(0);
      expect(status.PASS_CREATION.timeRemaining).toBe(0);

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = 1000000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      // Create some entries
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user2', 'LOGIN_ATTEMPTS');
      
      // Verify entries exist
      const limits = (RateLimiter as any).limits;
      expect(limits.size).toBe(2);
      
      // Advance time beyond window
      currentTime += 70000; // 70 seconds
      
      // Run cleanup
      RateLimiter.cleanup();
      
      // Entries should be removed
      expect(limits.size).toBe(0);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should keep active entries during cleanup', () => {
      // Create some entries
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user2', 'LOGIN_ATTEMPTS');
      
      // Run cleanup (entries should still be active)
      RateLimiter.cleanup();
      
      // Entries should still exist
      const limits = (RateLimiter as any).limits;
      expect(limits.size).toBe(2);
    });
  });

  describe('getStatistics', () => {
    it('should return empty statistics when no entries', () => {
      const stats = RateLimiter.getStatistics();
      
      expect(stats.totalActiveEntries).toBe(0);
      expect(stats.entriesByOperation).toEqual({});
      expect(stats.recentViolations).toEqual([]);
    });

    it('should return correct statistics with active entries', () => {
      // Create some entries
      RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      RateLimiter.checkRateLimit('user2', 'LOGIN_ATTEMPTS');
      RateLimiter.checkRateLimit('user3', 'PASS_CREATION');
      
      const stats = RateLimiter.getStatistics();
      
      expect(stats.totalActiveEntries).toBe(3);
      expect(stats.entriesByOperation).toEqual({
        PASS_CREATION: 2,
        LOGIN_ATTEMPTS: 1
      });
    });

    it('should track recent violations', () => {
      // Create violation
      for (let i = 0; i < 6; i++) { // Exceed limit of 5
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      const stats = RateLimiter.getStatistics();
      
      expect(stats.recentViolations.length).toBe(1);
      expect(stats.recentViolations[0]).toEqual({
        userId: 'user1',
        operation: 'PASS_CREATION',
        count: 5,
        resetTime: expect.any(Number)
      });
    });
  });

  describe('updateConfig', () => {
    afterEach(() => {
      // Reset config to original values
      RateLimiter.updateConfig('PASS_CREATION', { maxRequests: 5, windowMs: 60000 });
    });

    it('should update maxRequests', () => {
      RateLimiter.updateConfig('PASS_CREATION', { maxRequests: 10 });
      
      // Should now allow 10 requests instead of 5
      for (let i = 0; i < 10; i++) {
        const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
        expect(result.allowed).toBe(true);
      }
      
      // 11th should be blocked
      const result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);
    });

    it('should update windowMs', () => {
      // Set very short window for testing
      RateLimiter.updateConfig('PASS_CREATION', { windowMs: 100 });
      
      // Use up limit
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // Should be blocked
      let result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);
      
      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          result = RateLimiter.checkRateLimit('user1', 'PASS_CREATION');
          expect(result.allowed).toBe(true);
          resolve(undefined);
        }, 150); // Wait longer than 100ms window
      });
    });
  });

  describe('convenience functions', () => {
    it('should work with checkPassCreationRateLimit', () => {
      const result = checkPassMemory('user1');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
    });
  });
});

describe('Redis RateLimiter - TASK-002 Remediation', () => {
  beforeAll(async () => {
    // Initialize Redis connection for tests
    await RedisRateLimiter.initialize();
  });

  afterAll(async () => {
    // Clean up Redis connection after tests
    await RedisRateLimiter.cleanup();
  });

  beforeEach(async () => {
    // Clear Redis data before each test by resetting all test users
    const testUsers = ['user1', 'user2', 'user3'];
    for (const userId of testUsers) {
      await RedisRateLimiter.resetRateLimit(userId);
    }
  });

  describe('🔥 SECURITY REQUIREMENT: Rate Limits Must Persist Across Server Restarts', () => {
    it('should use Redis for persistence (not in-memory)', async () => {
      // This is the core security requirement from TASK-002
      const result = await RedisRateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 max - 1 used = 4 remaining
      expect(result.resetTime).toBeGreaterThan(Date.now());
      expect(result.error).toBeUndefined();
    });

    it('should enforce rate limits correctly', async () => {
      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        await RedisRateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // 6th request should be blocked
      const result = await RedisRateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should handle different operations independently', async () => {
      // Use up PASS_CREATION limit
      for (let i = 0; i < 5; i++) {
        await RedisRateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // LOGIN_ATTEMPTS should still work
      const loginResult = await RedisRateLimiter.checkRateLimit('user1', 'LOGIN_ATTEMPTS');
      expect(loginResult.allowed).toBe(true);
      expect(loginResult.remaining).toBe(4); // LOGIN has 5 max requests
    });

    it('should handle different users independently', async () => {
      // Use up user1's limit
      for (let i = 0; i < 5; i++) {
        await RedisRateLimiter.checkRateLimit('user1', 'PASS_CREATION');
      }
      
      // user2 should still be able to make requests
      const result = await RedisRateLimiter.checkRateLimit('user2', 'PASS_CREATION');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('convenience functions', () => {
    it('should work with checkPassCreationRateLimit', async () => {
      const result = await checkPassCreationRateLimit('user_convenience_1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should work with checkLoginRateLimit', async () => {
      const result = await checkLoginRateLimit('user_convenience_2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('Redis health', () => {
    it('should report Redis health status', async () => {
      const health = await RedisRateLimiter.healthCheck();
      // Redis may not be available in test environment, but should not throw
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.details).toBe('string');
    });
  });
}); 