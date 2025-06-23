import { createClient, RedisClientType } from 'redis';
import { monitoringService } from '../monitoringService';
import { logEvent } from '../eventLogger';

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  schoolId: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  error?: string;
  shouldRefresh?: boolean;
}

export class SessionManager {
  private static redis: RedisClientType | null = null;
  private static isConnected = false;
  
  // Configuration
  private static readonly CONFIG = {
    SESSION_DURATION: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
    REFRESH_THRESHOLD: 30 * 60 * 1000, // 30 minutes before expiry
    MAX_SESSIONS_PER_USER: 3, // Maximum concurrent sessions per user
    INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes of inactivity
  };

  /**
   * Initialize Redis connection
   */
  static async initialize(): Promise<void> {
    try {
      if (this.redis) {
        return; // Already initialized
      }

      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis connection failed after 10 retries');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.redis.on('error', (err) => {
        console.error('Redis session manager error:', err);
        this.isConnected = false;
        monitoringService.logError('Redis session manager error', {
          error: err.message,
          timestamp: new Date().toISOString()
        });
      });

      this.redis.on('connect', () => {
        console.log('Redis session manager connected successfully');
        this.isConnected = true;
      });

      this.redis.on('reconnecting', () => {
        console.log('Redis session manager reconnecting...');
        this.isConnected = false;
      });

      await this.redis.connect();
      
    } catch (error) {
      console.error('Failed to initialize Redis session manager:', error);
      this.isConnected = false;
      monitoringService.logError('Redis session manager initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Create a new session for a user
   */
  static async createSession(
    userId: string,
    email: string,
    role: string,
    schoolId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<string> {
    try {
      await this.initialize();
      
      if (!this.isConnected || !this.redis) {
        throw new Error('Redis not available for session management');
      }

      const sessionToken = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + this.CONFIG.SESSION_DURATION;

      const sessionData: SessionData = {
        userId,
        email,
        role,
        schoolId,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        userAgent,
        ipAddress
      };

      // Check for existing sessions and enforce limit
      await this.enforceSessionLimit(userId);

      // Store session in Redis with expiration
      const sessionKey = `session:${sessionToken}`;
      const userSessionsKey = `user_sessions:${userId}`;
      
      await this.redis.setEx(
        sessionKey,
        Math.ceil(this.CONFIG.SESSION_DURATION / 1000),
        JSON.stringify(sessionData)
      );

      // Add to user's active sessions list
      await this.redis.sAdd(userSessionsKey, sessionToken);
      await this.redis.expire(userSessionsKey, Math.ceil(this.CONFIG.SESSION_DURATION / 1000));

      // Log session creation
      logEvent({
        eventType: 'SESSION_CREATED',
        userId,
        details: {
          sessionToken: sessionToken.substring(0, 8) + '...',
          userAgent,
          ipAddress,
          role
        },
        timestamp: new Date(now)
      });

      monitoringService.logInfo('Session created', {
        userId,
        sessionToken: sessionToken.substring(0, 8) + '...',
        role,
        timestamp: new Date(now).toISOString()
      });

      return sessionToken;

    } catch (error) {
      console.error('Session creation failed:', error);
      monitoringService.logError('Session creation failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Validate a session token
   */
  static async validateSession(token: string): Promise<SessionValidationResult> {
    try {
      await this.initialize();
      
      if (!this.isConnected || !this.redis) {
        return {
          valid: false,
          error: 'Session management unavailable'
        };
      }

      const sessionKey = `session:${token}`;
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) {
        return {
          valid: false,
          error: 'Session not found'
        };
      }

      const session: SessionData = JSON.parse(sessionData);
      const now = Date.now();

      // Check if session has expired
      if (now > session.expiresAt) {
        await this.invalidateSession(token);
        return {
          valid: false,
          error: 'Session expired'
        };
      }

      // Check for inactivity timeout
      if (now - session.lastActivity > this.CONFIG.INACTIVITY_TIMEOUT) {
        await this.invalidateSession(token);
        return {
          valid: false,
          error: 'Session inactive for too long'
        };
      }

      // Check if session should be refreshed
      const shouldRefresh = (session.expiresAt - now) < this.CONFIG.REFRESH_THRESHOLD;

      // Update last activity
      session.lastActivity = now;
      await this.redis.setEx(
        sessionKey,
        Math.ceil((session.expiresAt - now) / 1000),
        JSON.stringify(session)
      );

      return {
        valid: true,
        session,
        shouldRefresh
      };

    } catch (error) {
      console.error('Session validation failed:', error);
      monitoringService.logError('Session validation failed', {
        sessionToken: token.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      return {
        valid: false,
        error: 'Session validation error'
      };
    }
  }

  /**
   * Refresh a session (extend its lifetime)
   */
  static async refreshSession(token: string): Promise<boolean> {
    try {
      await this.initialize();
      
      if (!this.isConnected || !this.redis) {
        return false;
      }

      const sessionKey = `session:${token}`;
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) {
        return false;
      }

      const session: SessionData = JSON.parse(sessionData);
      const now = Date.now();

      // Update session with new expiration
      session.lastActivity = now;
      session.expiresAt = now + this.CONFIG.SESSION_DURATION;

      await this.redis.setEx(
        sessionKey,
        Math.ceil(this.CONFIG.SESSION_DURATION / 1000),
        JSON.stringify(session)
      );

      // Log session refresh
      logEvent({
        eventType: 'SESSION_REFRESHED',
        userId: session.userId,
        details: {
          sessionToken: token.substring(0, 8) + '...',
          newExpiresAt: new Date(session.expiresAt)
        },
        timestamp: new Date(now)
      });

      return true;

    } catch (error) {
      console.error('Session refresh failed:', error);
      monitoringService.logError('Session refresh failed', {
        sessionToken: token.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  /**
   * Invalidate a session (logout)
   */
  static async invalidateSession(token: string): Promise<boolean> {
    try {
      await this.initialize();
      
      if (!this.isConnected || !this.redis) {
        return false;
      }

      const sessionKey = `session:${token}`;
      const sessionData = await this.redis.get(sessionKey);

      if (sessionData) {
        const session: SessionData = JSON.parse(sessionData);
        
        // Remove from user's active sessions
        const userSessionsKey = `user_sessions:${session.userId}`;
        await this.redis.sRem(userSessionsKey, token);

        // Log session invalidation
        logEvent({
          eventType: 'SESSION_INVALIDATED',
          userId: session.userId,
          details: {
            sessionToken: token.substring(0, 8) + '...',
            reason: 'manual_logout'
          },
          timestamp: new Date()
        });
      }

      // Delete the session
      await this.redis.del(sessionKey);

      return true;

    } catch (error) {
      console.error('Session invalidation failed:', error);
      monitoringService.logError('Session invalidation failed', {
        sessionToken: token.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateAllUserSessions(userId: string): Promise<number> {
    try {
      await this.initialize();
      
      if (!this.isConnected || !this.redis) {
        return 0;
      }

      const userSessionsKey = `user_sessions:${userId}`;
      const sessionTokens = await this.redis.sMembers(userSessionsKey);

      let invalidatedCount = 0;
      for (const token of sessionTokens) {
        if (await this.invalidateSession(token)) {
          invalidatedCount++;
        }
      }

      // Log bulk session invalidation
      logEvent({
        eventType: 'ALL_SESSIONS_INVALIDATED',
        userId,
        details: {
          invalidatedCount,
          reason: 'security_measure'
        },
        timestamp: new Date()
      });

      return invalidatedCount;

    } catch (error) {
      console.error('Bulk session invalidation failed:', error);
      monitoringService.logError('Bulk session invalidation failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return 0;
    }
  }

  /**
   * Get active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      await this.initialize();
      
      if (!this.isConnected || !this.redis) {
        return [];
      }

      const userSessionsKey = `user_sessions:${userId}`;
      const sessionTokens = await this.redis.sMembers(userSessionsKey);

      const sessions: SessionData[] = [];
      for (const token of sessionTokens) {
        const sessionKey = `session:${token}`;
        const sessionData = await this.redis.get(sessionKey);
        
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          if (Date.now() < session.expiresAt) {
            sessions.push(session);
          } else {
            // Clean up expired session
            await this.invalidateSession(token);
          }
        }
      }

      return sessions;

    } catch (error) {
      console.error('Get user sessions failed:', error);
      monitoringService.logError('Get user sessions failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return [];
    }
  }

  /**
   * Enforce maximum sessions per user
   */
  private static async enforceSessionLimit(userId: string): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return;
    }

    const userSessionsKey = `user_sessions:${userId}`;
    const sessionTokens = await this.redis.sMembers(userSessionsKey);

    if (sessionTokens.length >= this.CONFIG.MAX_SESSIONS_PER_USER) {
      // Remove oldest session
      const oldestToken = sessionTokens[0];
      await this.invalidateSession(oldestToken);

      // Log session limit enforcement
      logEvent({
        eventType: 'SESSION_LIMIT_ENFORCED',
        userId,
        details: {
          maxSessions: this.CONFIG.MAX_SESSIONS_PER_USER,
          removedSession: oldestToken.substring(0, 8) + '...'
        },
        timestamp: new Date()
      });
    }
  }

  /**
   * Clean up expired sessions (called periodically)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      await this.initialize();
      
      if (!this.isConnected || !this.redis) {
        return 0;
      }

      // This is a simplified cleanup - in production, you might want to use
      // Redis SCAN to iterate through all sessions
      const now = Date.now();
      let cleanedCount = 0;

      // For now, we rely on Redis TTL to automatically expire sessions
      // This method can be enhanced with more sophisticated cleanup logic

      monitoringService.logInfo('Session cleanup completed', {
        cleanedCount,
        timestamp: new Date(now).toISOString()
      });

      return cleanedCount;

    } catch (error) {
      console.error('Session cleanup failed:', error);
      monitoringService.logError('Session cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  static async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    try {
      await this.initialize();
      
      if (!this.isConnected || !this.redis) {
        return {
          totalSessions: 0,
          activeSessions: 0,
          expiredSessions: 0
        };
      }

      // This is a simplified implementation
      // In production, you might want to maintain counters in Redis
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0
      };

    } catch (error) {
      console.error('Get session stats failed:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0
      };
    }
  }
}

// Auto-cleanup expired sessions every hour
if (typeof window === 'undefined') { // Only in Node.js environment
  setInterval(() => {
    SessionManager.cleanupExpiredSessions();
  }, 60 * 60 * 1000); // Every hour
} 