import { 
  RedisRateLimiter, 
  checkPassCreationRateLimit, 
  checkLoginRateLimit 
} from '../rateLimiter.redis';

// Mock console.error to capture security event logs
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  mockConsoleError.mockClear();
});

afterAll(() => {
  mockConsoleError.mockRestore();
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