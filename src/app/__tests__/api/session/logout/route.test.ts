import { NextRequest } from 'next/server';
import { POST } from '@/app/api/session/logout/route';
import { SessionManager } from '@/lib/auth/sessionManager';

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
  const mockInvalidateSession = SessionManager.invalidateSession as jest.MockedFunction<typeof SessionManager.invalidateSession>;
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should logout successfully with x-session-token header', async () => {
      mockInvalidateSession.mockResolvedValue(true);

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

      if (response.status !== 200) {
        console.log('Response status:', response.status);
        console.log('Response data:', data);
        console.log('Console error calls:', mockConsoleError.mock.calls);
      }

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session invalidated successfully');

      expect(mockInvalidateSession).toHaveBeenCalledWith('valid-token');
      
      // Check that cookies.delete was called (mocked in jest.setup.js)
      expect(response.cookies.delete).toHaveBeenCalledWith('sessionToken');
    });

    it('should logout successfully with authorization header token', async () => {
      mockInvalidateSession.mockResolvedValue(true);

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

      expect(mockInvalidateSession).toHaveBeenCalledWith('auth-token');
    });

    it('should logout successfully with cookie token', async () => {
      mockInvalidateSession.mockResolvedValue(true);

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

      expect(mockInvalidateSession).toHaveBeenCalledWith('cookie-token');
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
      expect(mockInvalidateSession).not.toHaveBeenCalled();
      
      // Should still clear cookie
      expect(response.cookies.delete).toHaveBeenCalledWith('sessionToken');
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

      expect(mockInvalidateSession).not.toHaveBeenCalled();
    });

    it('should return 500 when session invalidation throws an error', async () => {
      mockInvalidateSession.mockRejectedValue(new Error('Database error'));

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

      expect(mockInvalidateSession).toHaveBeenCalledWith('token');
    });

    it('should prioritize x-session-token over authorization header', async () => {
      mockInvalidateSession.mockResolvedValue(true);

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

      expect(mockInvalidateSession).toHaveBeenCalledWith('priority-token');
    });

    it('should prioritize headers over cookies', async () => {
      mockInvalidateSession.mockResolvedValue(true);

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

      expect(mockInvalidateSession).toHaveBeenCalledWith('header-token');
    });
  });
}); 