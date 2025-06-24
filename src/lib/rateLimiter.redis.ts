/**
 * Redis-based Rate Limiting Service for Eagle Pass
 * 
 * Implements persistent rate limiting using Redis to prevent abuse of pass creation 
 * and other critical operations. This ensures rate limits persist across server restarts.
 * 
 * This is a critical security measure for a school safety system.
 */

import { createClient, RedisClientType } from 'redis';
import { monitoringService } from './monitoringService';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: string;
}

export class RedisRateLimiter {
  private static redis: RedisClientType | null = null;
  private static isConnected = false;
  
  // Configuration
  private static readonly CONFIG = {
    PASS_CREATION: {
      maxRequests: 5,
      windowMs: 60000, // 1 minute
      operation: 'pass_creation'
    },
    PASS_UPDATE: {
      maxRequests: 10,
      windowMs: 60000, // 1 minute  
      operation: 'pass_update'
    },
    LOGIN_ATTEMPTS: {
      maxRequests: 5,
      windowMs: 300000, // 5 minutes
      operation: 'login'
    }
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
        console.error('Redis connection error:', err);
        this.isConnected = false;
        monitoringService.logError('Redis connection error', {
          error: err.message,
          timestamp: new Date().toISOString()
        });
      });

      this.redis.on('connect', () => {
        // Redis connected successfully
        this.isConnected = true;
      });

      this.redis.on('reconnecting', () => {
        // Redis reconnecting...
        this.isConnected = false;
      });

      await this.redis.connect();
      
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.isConnected = false;
      monitoringService.logError('Redis initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check if Redis is available
   */
  static isRedisAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Check if a user is rate limited for a specific operation
   */
  static async checkRateLimit(
    userId: string, 
    operation: keyof typeof RedisRateLimiter.CONFIG
  ): Promise<RateLimitResult> {
    const config = this.CONFIG[operation];
    const key = `rate_limit:${userId}:${operation}`;
    const now = Date.now();
    
    try {
      // Fallback to in-memory if Redis is not available
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, falling back to in-memory rate limiting');
        return this.fallbackRateLimit(userId, operation);
      }

      // Use Redis MULTI for atomic operations
      const multi = this.redis!.multi();
      
      // Increment counter
      multi.incr(key);
      
      // Set expiry if this is the first request
      multi.expire(key, Math.ceil(config.windowMs / 1000));
      
      // Get current count and TTL
      multi.get(key);
      multi.ttl(key);
      
      const results = await multi.exec();
      
      if (!results) {
        throw new Error('Redis transaction failed');
      }
      
      // Properly type the Redis transaction results
      const count = Number(results[0]);
      const ttl = Number(results[3]);
      
      const resetTime = now + (ttl * 1000);
      
      // Check if limit exceeded
      if (count > config.maxRequests) {
        // Check for suspicious rapid attempts
        const lastAttemptKey = `last_attempt:${userId}:${operation}`;
        const lastAttempt = await this.redis!.get(lastAttemptKey);
        
        if (lastAttempt) {
          const timeSinceLastAttempt = now - parseInt(lastAttempt);
          if (timeSinceLastAttempt < 1000) { // Less than 1 second
            // Extend the ban for rapid attempts (potential bot)
            await this.redis!.expire(key, Math.ceil((config.windowMs * 2) / 1000));
            this.logSecurityEvent(userId, operation, 'rapid_attempts', {
              attempts: count,
              timeSinceLastAttempt
            });
          }
        }
        
        // Update last attempt time
        await this.redis!.setEx(lastAttemptKey, Math.ceil(config.windowMs / 1000), now.toString());
        
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          error: `Rate limit exceeded for ${operation}. Try again after ${new Date(resetTime).toLocaleTimeString()}`
        };
      }
      
      // Update last attempt time
      const lastAttemptKey = `last_attempt:${userId}:${operation}`;
      await this.redis!.setEx(lastAttemptKey, Math.ceil(config.windowMs / 1000), now.toString());
      
      return {
        allowed: true,
        remaining: Math.max(0, config.maxRequests - count),
        resetTime
      };
      
    } catch (error) {
      console.error('Redis rate limit check failed:', error);
      monitoringService.logError('Redis rate limit check failed', {
        userId,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // Fallback to in-memory rate limiting
      return this.fallbackRateLimit(userId, operation);
    }
  }

  /**
   * Fallback in-memory rate limiting when Redis is unavailable
   */
  private static fallbackRateLimit(
    userId: string, 
    operation: keyof typeof RedisRateLimiter.CONFIG
  ): RateLimitResult {
    // Simple in-memory fallback
    const config = this.CONFIG[operation];
    const key = `fallback:${userId}:${operation}`;
    const now = Date.now();
    
    // This is a simplified fallback - in production, you might want a more robust solution
    const entry = (global as Record<string, unknown>)[key] as { count: number; resetTime: number } | undefined;
    
    if (!entry || now > entry.resetTime) {
      (global as Record<string, unknown>)[key] = {
        count: 1,
        resetTime: now + config.windowMs
      };
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs
      };
    }
    
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        error: `Rate limit exceeded for ${operation}. Try again after ${new Date(entry.resetTime).toLocaleTimeString()}`
      };
    }
    
    entry.count++;
    
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * Reset rate limit for a user (admin function)
   */
  static async resetRateLimit(
    userId: string, 
    operation?: keyof typeof RedisRateLimiter.CONFIG
  ): Promise<void> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, cannot reset rate limit');
        return;
      }

      if (operation) {
        const key = `rate_limit:${userId}:${operation}`;
        const lastAttemptKey = `last_attempt:${userId}:${operation}`;
        await this.redis!.del([key, lastAttemptKey]);
      } else {
        // Reset all operations for this user
        const keys = await this.redis!.keys(`rate_limit:${userId}:*`);
        const lastAttemptKeys = await this.redis!.keys(`last_attempt:${userId}:*`);
        
        if (keys.length > 0 || lastAttemptKeys.length > 0) {
          await this.redis!.del([...keys, ...lastAttemptKeys]);
        }
      }
      
      monitoringService.logInfo('Rate limit reset', {
        userId,
        operation: operation || 'all',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      monitoringService.logError('Rate limit reset failed', {
        userId,
        operation: operation || 'all',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get current rate limit status for a user
   */
  static async getRateLimitStatus(userId: string): Promise<Record<string, {
    count: number;
    maxRequests: number;
    resetTime: number;
    timeRemaining: number;
  }>> {
    const status: Record<string, {
      count: number;
      maxRequests: number;
      resetTime: number;
      timeRemaining: number;
    }> = {};
    const now = Date.now();
    
    try {
      if (!this.isRedisAvailable()) {
        // Return empty status for fallback mode
        for (const [operation, config] of Object.entries(this.CONFIG)) {
          status[operation] = {
            count: 0,
            maxRequests: config.maxRequests,
            resetTime: 0,
            timeRemaining: 0
          };
        }
        return status;
      }

      for (const [operation, config] of Object.entries(this.CONFIG)) {
        const key = `rate_limit:${userId}:${operation}`;
        const count = await this.redis!.get(key);
        const ttl = await this.redis!.ttl(key);
        
        if (count && ttl > 0) {
          const resetTime = now + (ttl * 1000);
          status[operation] = {
            count: parseInt(count),
            maxRequests: config.maxRequests,
            resetTime,
            timeRemaining: ttl * 1000
          };
        } else {
          status[operation] = {
            count: 0,
            maxRequests: config.maxRequests,
            resetTime: 0,
            timeRemaining: 0
          };
        }
      }
      
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      monitoringService.logError('Rate limit status check failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
    
    return status;
  }

  /**
   * Health check for Redis connection
   */
  static async healthCheck(): Promise<{ healthy: boolean; details: string }> {
    try {
      if (!this.isRedisAvailable()) {
        return {
          healthy: false,
          details: 'Redis not connected'
        };
      }

      await this.redis!.ping();
      return {
        healthy: true,
        details: 'Redis connected and responding'
      };
      
    } catch (error) {
      return {
        healthy: false,
        details: `Redis health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Log security events for monitoring
   */
  private static logSecurityEvent(
    userId: string, 
    operation: string, 
    eventType: string, 
    details: Record<string, unknown>
  ): void {
    console.error(`[SECURITY EVENT] ${eventType.toUpperCase()}`, {
      userId,
      operation,
      timestamp: new Date().toISOString(),
      ...details
    });
    
    monitoringService.logSecurityEvent('rate_limit_violation', {
      userId,
      operation,
      eventType,
      ...details
    });
  }

  /**
   * Cleanup Redis connection
   */
  static async cleanup(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
        this.isConnected = false;
      }
    } catch (error) {
      console.error('Error during Redis cleanup:', error);
    }
  }
}

// Auto-initialization removed to prevent client-side bundling issues
// Redis will be initialized on first use in server-side contexts only

// Convenience functions for backward compatibility
export async function checkPassCreationRateLimit(userId: string): Promise<RateLimitResult> {
  // Ensure Redis is initialized before use
  if (!RedisRateLimiter.isRedisAvailable()) {
    await RedisRateLimiter.initialize();
  }
  return RedisRateLimiter.checkRateLimit(userId, 'PASS_CREATION');
}

export async function checkLoginRateLimit(userId: string): Promise<RateLimitResult> {
  // Ensure Redis is initialized before use
  if (!RedisRateLimiter.isRedisAvailable()) {
    await RedisRateLimiter.initialize();
  }
  return RedisRateLimiter.checkRateLimit(userId, 'LOGIN_ATTEMPTS');
} 