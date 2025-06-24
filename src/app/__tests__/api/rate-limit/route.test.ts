import { NextRequest } from 'next/server';
import { POST } from '../../../api/rate-limit/route';

// Mock the rate limiter
jest.mock('@/lib/rateLimiter.redis', () => ({
  checkPassCreationRateLimit: jest.fn(),
  checkLoginRateLimit: jest.fn(),
}));

// Mock console.error to avoid noise in tests
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('/api/rate-limit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('POST', () => {
    it('should check pass creation rate limit successfully', async () => {
      const { checkPassCreationRateLimit } = require('@/lib/rateLimiter.redis');
      const mockResult = {
        allowed: true,
        remainingRequests: 4,
        resetTime: Date.now() + 60000,
      };
      checkPassCreationRateLimit.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user1',
          operation: 'PASS_CREATION',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
      expect(checkPassCreationRateLimit).toHaveBeenCalledWith('user1');
    });

    it('should check login rate limit successfully', async () => {
      const { checkLoginRateLimit } = require('@/lib/rateLimiter.redis');
      const mockResult = {
        allowed: false,
        remainingRequests: 0,
        resetTime: Date.now() + 300000,
      };
      checkLoginRateLimit.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user2',
          operation: 'LOGIN',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
      expect(checkLoginRateLimit).toHaveBeenCalledWith('user2');
    });

    it('should return 400 when userId is missing', async () => {
      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'PASS_CREATION',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: userId, operation',
      });
    });

    it('should return 400 when operation is missing', async () => {
      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user1',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: userId, operation',
      });
    });

    it('should return 400 when both userId and operation are missing', async () => {
      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: userId, operation',
      });
    });

    it('should return 400 when operation is invalid', async () => {
      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user1',
          operation: 'INVALID_OPERATION',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Invalid operation. Must be PASS_CREATION or LOGIN',
      });
    });

    it('should handle empty string values', async () => {
      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: '',
          operation: '',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: userId, operation',
      });
    });

    it('should return 503 when pass creation rate limiter throws an error', async () => {
      const { checkPassCreationRateLimit } = require('@/lib/rateLimiter.redis');
      checkPassCreationRateLimit.mockRejectedValue(new Error('Redis connection failed'));

      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user1',
          operation: 'PASS_CREATION',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toEqual({
        allowed: false,
        error: 'Rate limiting service unavailable. Please try again later.',
      });
    });

    it('should return 503 when login rate limiter throws an error', async () => {
      const { checkLoginRateLimit } = require('@/lib/rateLimiter.redis');
      checkLoginRateLimit.mockRejectedValue(new Error('Redis timeout'));

      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user2',
          operation: 'LOGIN',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toEqual({
        allowed: false,
        error: 'Rate limiting service unavailable. Please try again later.',
      });
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(503);
    });

    it('should handle case-sensitive operation values', async () => {
      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user1',
          operation: 'pass_creation', // lowercase
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Invalid operation. Must be PASS_CREATION or LOGIN',
      });
    });

    it('should handle null values', async () => {
      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: null,
          operation: null,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: userId, operation',
      });
    });

    it('should handle rate limit denial response', async () => {
      const { checkPassCreationRateLimit } = require('@/lib/rateLimiter.redis');
      const mockResult = {
        allowed: false,
        remainingRequests: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      };
      checkPassCreationRateLimit.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost/api/rate-limit', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user1',
          operation: 'PASS_CREATION',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
      expect(data.allowed).toBe(false);
    });
  });
}); 