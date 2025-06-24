import { NextResponse } from 'next/server';
import { GET } from '../../../api/session/route';

// Mock the session middleware
jest.mock('@/lib/auth/sessionMiddleware', () => ({
  createAuthenticatedRoute: jest.fn((handler, options) => {
    return async (request: any) => {
      // Mock authenticated request with session
      const mockAuthenticatedRequest = {
        ...request,
        session: request.session || null,
      };
      return handler(mockAuthenticatedRequest);
    };
  }),
}));

describe('/api/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return session data when session exists', async () => {
      const mockSession = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'teacher',
        schoolId: 'school1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        lastActivity: new Date('2024-01-01T11:00:00Z'),
        expiresAt: new Date('2024-01-01T18:00:00Z'),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      const mockRequest = {
        session: mockSession,
        url: 'http://localhost/api/session',
        method: 'GET',
      };

      const response = await GET(mockRequest as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        session: {
          userId: 'user123',
          email: 'test@example.com',
          role: 'teacher',
          schoolId: 'school1',
          createdAt: '2024-01-01T10:00:00.000Z',
          lastActivity: '2024-01-01T11:00:00.000Z',
          expiresAt: '2024-01-01T18:00:00.000Z',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        },
        timestamp: expect.any(String),
      });

      // Verify timestamp is a valid ISO string
      expect(new Date(data.timestamp)).toBeInstanceOf(Date);
    });

    it('should return 401 when no session exists', async () => {
      const mockRequest = {
        session: null,
        url: 'http://localhost/api/session',
        method: 'GET',
      };

      const response = await GET(mockRequest as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'No session found',
      });
    });

    it('should return 401 when session is undefined', async () => {
      const mockRequest = {
        url: 'http://localhost/api/session',
        method: 'GET',
      };

      const response = await GET(mockRequest as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'No session found',
      });
    });

    it('should handle session with minimal data', async () => {
      const mockSession = {
        userId: 'user456',
        email: 'minimal@example.com',
        role: 'student',
        schoolId: 'school2',
        createdAt: new Date('2024-01-02T09:00:00Z'),
        lastActivity: new Date('2024-01-02T09:30:00Z'),
        expiresAt: new Date('2024-01-02T17:00:00Z'),
        userAgent: 'Chrome/120.0',
        ipAddress: '10.0.0.1',
      };

      const mockRequest = {
        session: mockSession,
        url: 'http://localhost/api/session',
        method: 'GET',
      };

      const response = await GET(mockRequest as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.userId).toBe('user456');
      expect(data.session.email).toBe('minimal@example.com');
      expect(data.session.role).toBe('student');
      expect(data.session.schoolId).toBe('school2');
    });

    it('should handle session with admin role', async () => {
      const mockSession = {
        userId: 'admin1',
        email: 'admin@example.com',
        role: 'admin',
        schoolId: 'district1',
        createdAt: new Date('2024-01-03T08:00:00Z'),
        lastActivity: new Date('2024-01-03T08:45:00Z'),
        expiresAt: new Date('2024-01-03T16:00:00Z'),
        userAgent: 'Safari/17.0',
        ipAddress: '172.16.0.1',
      };

      const mockRequest = {
        session: mockSession,
        url: 'http://localhost/api/session',
        method: 'GET',
      };

      const response = await GET(mockRequest as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.role).toBe('admin');
      expect(data.session.schoolId).toBe('district1');
    });

    it('should convert dates to ISO strings correctly', async () => {
      const createdAt = new Date('2024-01-01T12:00:00.123Z');
      const lastActivity = new Date('2024-01-01T12:30:45.678Z');
      const expiresAt = new Date('2024-01-01T20:00:00.999Z');

      const mockSession = {
        userId: 'user789',
        email: 'timetest@example.com',
        role: 'teacher',
        schoolId: 'school3',
        createdAt,
        lastActivity,
        expiresAt,
        userAgent: 'Firefox/121.0',
        ipAddress: '203.0.113.1',
      };

      const mockRequest = {
        session: mockSession,
        url: 'http://localhost/api/session',
        method: 'GET',
      };

      const response = await GET(mockRequest as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.createdAt).toBe('2024-01-01T12:00:00.123Z');
      expect(data.session.lastActivity).toBe('2024-01-01T12:30:45.678Z');
      expect(data.session.expiresAt).toBe('2024-01-01T20:00:00.999Z');
    });

    it('should include all required session fields', async () => {
      const mockSession = {
        userId: 'complete-user',
        email: 'complete@example.com',
        role: 'parent',
        schoolId: 'complete-school',
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(),
        userAgent: 'Complete Browser',
        ipAddress: '192.0.2.1',
      };

      const mockRequest = {
        session: mockSession,
        url: 'http://localhost/api/session',
        method: 'GET',
      };

      const response = await GET(mockRequest as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session).toHaveProperty('userId');
      expect(data.session).toHaveProperty('email');
      expect(data.session).toHaveProperty('role');
      expect(data.session).toHaveProperty('schoolId');
      expect(data.session).toHaveProperty('createdAt');
      expect(data.session).toHaveProperty('lastActivity');
      expect(data.session).toHaveProperty('expiresAt');
      expect(data.session).toHaveProperty('userAgent');
      expect(data.session).toHaveProperty('ipAddress');
      expect(data).toHaveProperty('timestamp');
    });

    it('should generate fresh timestamp for each request', async () => {
      const mockSession = {
        userId: 'timestamp-user',
        email: 'timestamp@example.com',
        role: 'teacher',
        schoolId: 'timestamp-school',
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(),
        userAgent: 'Timestamp Browser',
        ipAddress: '198.51.100.1',
      };

      const mockRequest = {
        session: mockSession,
        url: 'http://localhost/api/session',
        method: 'GET',
      };

      const response1 = await GET(mockRequest as any);
      const data1 = await response1.json();

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));

      const response2 = await GET(mockRequest as any);
      const data2 = await response2.json();

      expect(data1.timestamp).not.toBe(data2.timestamp);
    });
  });
}); 