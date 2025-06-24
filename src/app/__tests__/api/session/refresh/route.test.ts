import { NextRequest } from 'next/server';
import { POST } from '@/app/api/session/refresh/route';

// Mock the session middleware
jest.mock('@/lib/auth/sessionMiddleware', () => ({
  createAuthenticatedRoute: jest.fn((handler) => handler),
}));

// Mock the session manager
jest.mock('@/lib/auth/sessionManager', () => ({
  SessionManager: {
    refreshSession: jest.fn(),
    validateSession: jest.fn(),
  },
}));

describe('/api/session/refresh', () => {
  const { SessionManager } = require('@/lib/auth/sessionManager');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should refresh session successfully with valid token', async () => {
      const mockSession = {
        userId: 'user1',
        email: 'user@example.com',
        role: 'teacher',
        schoolId: 'school1',
        createdAt: 1000000,
        lastActivity: 1000500,
        expiresAt: 2000000,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      };

      SessionManager.refreshSession.mockResolvedValue(true);
      SessionManager.validateSession.mockResolvedValue({
        valid: true,
        session: mockSession
      });

      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
        headers: {
          'x-session-token': 'valid-token',
        },
      });

      // Mock the authenticated request properties
      (request as any).session = mockSession;

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session).toEqual({
        userId: 'user1',
        email: 'user@example.com',
        role: 'teacher',
        schoolId: 'school1',
        createdAt: new Date(1000000).toISOString(),
        lastActivity: new Date(1000500).toISOString(),
        expiresAt: new Date(2000000).toISOString(),
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      });
      expect(data.timestamp).toBeDefined();

      expect(SessionManager.refreshSession).toHaveBeenCalledWith('valid-token');
      expect(SessionManager.validateSession).toHaveBeenCalledWith('valid-token');
    });

    it('should refresh session with authorization header token', async () => {
      const mockSession = {
        userId: 'user1',
        email: 'user@example.com',
        role: 'admin',
        schoolId: 'school1',
        createdAt: 1000000,
        lastActivity: 1000500,
        expiresAt: 2000000,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      };

      SessionManager.refreshSession.mockResolvedValue(true);
      SessionManager.validateSession.mockResolvedValue({
        valid: true,
        session: mockSession
      });

      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer auth-token',
        },
      });

      (request as any).session = mockSession;

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(SessionManager.refreshSession).toHaveBeenCalledWith('auth-token');
    });

    it('should refresh session with cookie token', async () => {
      const mockSession = {
        userId: 'user1',
        email: 'user@example.com',
        role: 'teacher',
        schoolId: 'school1',
        createdAt: 1000000,
        lastActivity: 1000500,
        expiresAt: 2000000,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      };

      SessionManager.refreshSession.mockResolvedValue(true);
      SessionManager.validateSession.mockResolvedValue({
        valid: true,
        session: mockSession
      });

      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
      });

      // Mock cookie
      (request as any).cookies = {
        get: jest.fn((name) => name === 'sessionToken' ? { value: 'cookie-token' } : undefined)
      };
      (request as any).session = mockSession;

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(SessionManager.refreshSession).toHaveBeenCalledWith('cookie-token');
    });

    it('should return 401 when no session found', async () => {
      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
      });

      // No session attached
      (request as any).session = null;

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('No session found');
    });

    it('should return 401 when no session token found', async () => {
      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
      });

      (request as any).session = { userId: 'user1' };
      (request as any).cookies = {
        get: jest.fn(() => undefined)
      };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Session token not found');
    });

    it('should return 400 when session refresh fails', async () => {
      SessionManager.refreshSession.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
        headers: {
          'x-session-token': 'invalid-token',
        },
      });

      (request as any).session = { userId: 'user1' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Failed to refresh session');
      expect(SessionManager.refreshSession).toHaveBeenCalledWith('invalid-token');
    });

    it('should return 401 when session validation fails after refresh', async () => {
      SessionManager.refreshSession.mockResolvedValue(true);
      SessionManager.validateSession.mockResolvedValue({
        valid: false,
        session: null
      });

      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
        headers: {
          'x-session-token': 'token',
        },
      });

      (request as any).session = { userId: 'user1' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Session validation failed after refresh');
    });

    it('should return 500 when refresh throws an error', async () => {
      SessionManager.refreshSession.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
        headers: {
          'x-session-token': 'token',
        },
      });

      (request as any).session = { userId: 'user1' };

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to refresh session');
    });

    it('should handle complex session data correctly', async () => {
      const mockSession = {
        userId: 'complex-user-123',
        email: 'complex.user+test@school.edu',
        role: 'admin',
        schoolId: 'complex-school-456',
        createdAt: 1703001234567,
        lastActivity: 1703001234890,
        expiresAt: 1703087634567,
        userAgent: 'Mozilla/5.0 (complex user agent)',
        ipAddress: '192.168.1.100'
      };

      SessionManager.refreshSession.mockResolvedValue(true);
      SessionManager.validateSession.mockResolvedValue({
        valid: true,
        session: mockSession
      });

      const request = new NextRequest('http://localhost/api/session/refresh', {
        method: 'POST',
        headers: {
          'x-session-token': 'complex-token-789',
        },
      });

      (request as any).session = mockSession;

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.userId).toBe('complex-user-123');
      expect(data.session.email).toBe('complex.user+test@school.edu');
      expect(data.session.role).toBe('admin');
      expect(data.session.schoolId).toBe('complex-school-456');
      
      // Verify date conversion
      expect(data.session.createdAt).toBe(new Date(1703001234567).toISOString());
      expect(data.session.lastActivity).toBe(new Date(1703001234890).toISOString());
      expect(data.session.expiresAt).toBe(new Date(1703087634567).toISOString());
      
      expect(data.session.userAgent).toBe('Mozilla/5.0 (complex user agent)');
      expect(data.session.ipAddress).toBe('192.168.1.100');
      expect(data.timestamp).toBeDefined();
    });
  });
}); 