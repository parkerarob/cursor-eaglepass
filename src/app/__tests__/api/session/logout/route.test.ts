import { NextRequest } from 'next/server';
import { POST } from '@/app/api/session/logout/route';

// Mock the session middleware
jest.mock('@/lib/auth/sessionMiddleware', () => ({
  createAuthenticatedRoute: jest.fn((handler) => handler),
}));

// Mock the session manager
jest.mock('@/lib/auth/sessionManager', () => ({
  SessionManager: {
    invalidateSession: jest.fn(),
  },
}));

describe('/api/session/logout', () => {
  const { SessionManager } = require('@/lib/auth/sessionManager');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should logout successfully with x-session-token header', async () => {
      SessionManager.invalidateSession.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/session/logout', {
        method: 'POST',
        headers: {
          'x-session-token': 'valid-token',
        },
      });

      // Mock the authenticated request properties
      (request as any).session = { userId: 'user1', email: 'user@example.com' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session invalidated successfully');

      expect(SessionManager.invalidateSession).toHaveBeenCalledWith('valid-token');
      
      // Check that cookie is deleted
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('sessionToken=;');
    });

    it('should logout successfully with authorization header token', async () => {
      SessionManager.invalidateSession.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/session/logout', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer auth-token',
        },
      });

      (request as any).session = { userId: 'user1', email: 'user@example.com' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session invalidated successfully');

      expect(SessionManager.invalidateSession).toHaveBeenCalledWith('auth-token');
    });

    it('should logout successfully with cookie token', async () => {
      SessionManager.invalidateSession.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/session/logout', {
        method: 'POST',
      });

      // Mock cookie
      (request as any).cookies = {
        get: jest.fn((name) => name === 'sessionToken' ? { value: 'cookie-token' } : undefined)
      };
      (request as any).session = { userId: 'user1', email: 'user@example.com' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session invalidated successfully');

      expect(SessionManager.invalidateSession).toHaveBeenCalledWith('cookie-token');
    });

    it('should logout successfully even without session token', async () => {
      const request = new NextRequest('http://localhost/api/session/logout', {
        method: 'POST',
      });

      (request as any).cookies = {
        get: jest.fn(() => undefined)
      };
      (request as any).session = { userId: 'user1', email: 'user@example.com' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session invalidated successfully');

      // Should not call invalidateSession if no token
      expect(SessionManager.invalidateSession).not.toHaveBeenCalled();
      
      // Should still clear cookie
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('sessionToken=;');
    });

    it('should return 401 when no session found', async () => {
      const request = new NextRequest('http://localhost/api/session/logout', {
        method: 'POST',
      });

      // No session attached
      (request as any).session = null;

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('No session found');

      expect(SessionManager.invalidateSession).not.toHaveBeenCalled();
    });

    it('should return 500 when session invalidation throws an error', async () => {
      SessionManager.invalidateSession.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/session/logout', {
        method: 'POST',
        headers: {
          'x-session-token': 'token',
        },
      });

      (request as any).session = { userId: 'user1', email: 'user@example.com' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to logout');

      expect(SessionManager.invalidateSession).toHaveBeenCalledWith('token');
    });

    it('should prioritize x-session-token over authorization header', async () => {
      SessionManager.invalidateSession.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/session/logout', {
        method: 'POST',
        headers: {
          'x-session-token': 'priority-token',
          'authorization': 'Bearer fallback-token',
        },
      });

      (request as any).session = { userId: 'user1', email: 'user@example.com' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      expect(SessionManager.invalidateSession).toHaveBeenCalledWith('priority-token');
    });

    it('should prioritize headers over cookies', async () => {
      SessionManager.invalidateSession.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/session/logout', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer header-token',
        },
      });

      (request as any).cookies = {
        get: jest.fn((name) => name === 'sessionToken' ? { value: 'cookie-token' } : undefined)
      };
      (request as any).session = { userId: 'user1', email: 'user@example.com' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      expect(SessionManager.invalidateSession).toHaveBeenCalledWith('header-token');
    });
  });
}); 