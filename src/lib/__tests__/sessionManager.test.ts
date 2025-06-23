import { SessionManager, SessionData } from '../auth/sessionManager';

// Mock Redis client
const mockRedis = {
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  sAdd: jest.fn(),
  sRem: jest.fn(),
  sMembers: jest.fn(),
  expire: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn()
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedis)
}));

// Mock monitoring service
jest.mock('../monitoringService', () => ({
  monitoringService: {
    logError: jest.fn(),
    logInfo: jest.fn()
  }
}));

// Mock event logger
jest.mock('../eventLogger', () => ({
  eventLogger: {
    logEvent: jest.fn()
  }
}));

describe('SessionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static properties
    (SessionManager as any).redis = null;
    (SessionManager as any).isConnected = false;
    
    // Setup default mock behavior
    mockRedis.connect.mockResolvedValue(undefined);
    mockRedis.on.mockImplementation((event, callback) => {
      if (event === 'connect') {
        callback();
      }
    });
  });

  describe('initialize', () => {
    it('should initialize Redis connection successfully', async () => {
      await SessionManager.initialize();
      
      expect(mockRedis.connect).toHaveBeenCalled();
      expect((SessionManager as any).isConnected).toBe(true);
    });

    it('should handle Redis connection errors', async () => {
      const error = new Error('Connection failed');
      mockRedis.connect.mockRejectedValue(error);
      
      await SessionManager.initialize();
      
      expect((SessionManager as any).isConnected).toBe(false);
    });
  });

  describe('createSession', () => {
    beforeEach(async () => {
      await SessionManager.initialize();
    });

    it('should create a new session successfully', async () => {
      const mockSessionData = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'student',
        schoolId: 'school-1',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 4 * 60 * 60 * 1000
      };

      mockRedis.setEx.mockResolvedValue('OK');
      mockRedis.sAdd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.sMembers.mockResolvedValue([]);

      const sessionToken = await SessionManager.createSession(
        mockSessionData.userId,
        mockSessionData.email,
        mockSessionData.role,
        mockSessionData.schoolId
      );

      expect(sessionToken).toBeDefined();
      expect(mockRedis.setEx).toHaveBeenCalled();
      expect(mockRedis.sAdd).toHaveBeenCalled();
    });

    it('should throw error when Redis is not available', async () => {
      (SessionManager as any).isConnected = false;
      
      await expect(
        SessionManager.createSession('user-1', 'test@example.com', 'student', 'school-1')
      ).rejects.toThrow('Redis not available for session management');
    });
  });

  describe('validateSession', () => {
    beforeEach(async () => {
      await SessionManager.initialize();
    });

    it('should validate a valid session', async () => {
      const mockSession: SessionData = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'student',
        schoolId: 'school-1',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 4 * 60 * 60 * 1000
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setEx.mockResolvedValue('OK');

      const result = await SessionManager.validateSession('valid-token');

      expect(result.valid).toBe(true);
      expect(result.session).toEqual(mockSession);
    });

    it('should reject expired session', async () => {
      const expiredSession: SessionData = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'student',
        schoolId: 'school-1',
        createdAt: Date.now() - 5 * 60 * 60 * 1000,
        lastActivity: Date.now() - 5 * 60 * 60 * 1000,
        expiresAt: Date.now() - 60 * 60 * 1000 // Expired 1 hour ago
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredSession));
      mockRedis.del.mockResolvedValue(1);

      const result = await SessionManager.validateSession('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session expired');
    });

    it('should reject inactive session', async () => {
      const inactiveSession: SessionData = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'student',
        schoolId: 'school-1',
        createdAt: Date.now() - 2 * 60 * 60 * 1000,
        lastActivity: Date.now() - 31 * 60 * 1000, // 31 minutes ago (inactive)
        expiresAt: Date.now() + 2 * 60 * 60 * 1000
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(inactiveSession));
      mockRedis.del.mockResolvedValue(1);

      const result = await SessionManager.validateSession('inactive-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session inactive for too long');
    });

    it('should return error when session not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await SessionManager.validateSession('non-existent-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('refreshSession', () => {
    beforeEach(async () => {
      await SessionManager.initialize();
    });

    it('should refresh session successfully', async () => {
      const mockSession: SessionData = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'student',
        schoolId: 'school-1',
        createdAt: Date.now() - 2 * 60 * 60 * 1000,
        lastActivity: Date.now() - 60 * 60 * 1000,
        expiresAt: Date.now() + 60 * 60 * 1000
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setEx.mockResolvedValue('OK');

      const result = await SessionManager.refreshSession('valid-token');

      expect(result).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalled();
    });

    it('should return false when session not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await SessionManager.refreshSession('non-existent-token');

      expect(result).toBe(false);
    });
  });

  describe('invalidateSession', () => {
    beforeEach(async () => {
      await SessionManager.initialize();
    });

    it('should invalidate session successfully', async () => {
      const mockSession: SessionData = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'student',
        schoolId: 'school-1',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 4 * 60 * 60 * 1000
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.sRem.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      const result = await SessionManager.invalidateSession('valid-token');

      expect(result).toBe(true);
      expect(mockRedis.sRem).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should return true even when session not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.del.mockResolvedValue(0);

      const result = await SessionManager.invalidateSession('non-existent-token');

      expect(result).toBe(true);
    });
  });

  describe('getUserSessions', () => {
    beforeEach(async () => {
      await SessionManager.initialize();
    });

    it('should return active sessions for user', async () => {
      const mockSessions = [
        {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'student',
          schoolId: 'school-1',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          expiresAt: Date.now() + 4 * 60 * 60 * 1000
        }
      ];

      mockRedis.sMembers.mockResolvedValue(['token-1']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSessions[0]));

      const sessions = await SessionManager.getUserSessions('user-1');

      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toEqual(mockSessions[0]);
    });

    it('should filter out expired sessions', async () => {
      const expiredSession: SessionData = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'student',
        schoolId: 'school-1',
        createdAt: Date.now() - 5 * 60 * 60 * 1000,
        lastActivity: Date.now() - 5 * 60 * 60 * 1000,
        expiresAt: Date.now() - 60 * 60 * 1000 // Expired
      };

      mockRedis.sMembers.mockResolvedValue(['expired-token']);
      mockRedis.get.mockResolvedValue(JSON.stringify(expiredSession));
      mockRedis.del.mockResolvedValue(1);

      const sessions = await SessionManager.getUserSessions('user-1');

      expect(sessions).toHaveLength(0);
    });
  });

  describe('invalidateAllUserSessions', () => {
    beforeEach(async () => {
      await SessionManager.initialize();
    });

    it('should invalidate all sessions for user', async () => {
      mockRedis.sMembers.mockResolvedValue(['token-1', 'token-2']);
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId: 'user-1',
        email: 'test@example.com',
        role: 'student',
        schoolId: 'school-1',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 4 * 60 * 60 * 1000
      }));
      mockRedis.sRem.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      const count = await SessionManager.invalidateAllUserSessions('user-1');

      expect(count).toBe(2);
      expect(mockRedis.sMembers).toHaveBeenCalledWith('user_sessions:user-1');
    });
  });

  describe('getSessionStats', () => {
    beforeEach(async () => {
      await SessionManager.initialize();
    });

    it('should return session statistics', async () => {
      const stats = await SessionManager.getSessionStats();

      expect(stats).toEqual({
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0
      });
    });
  });
}); 