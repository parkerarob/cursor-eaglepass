/**
 * Rate Limiting Service for Eagle Pass
 * 
 * Implements rate limiting to prevent abuse of pass creation and other critical operations.
 * This is a critical security measure for a school safety system.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAttempt: number;
}

export class RateLimiter {
  private static limits = new Map<string, RateLimitEntry>();
  
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
   * Check if a user is rate limited for a specific operation
   */
  static checkRateLimit(userId: string, operation: keyof typeof RateLimiter.CONFIG): {
    allowed: boolean;
    remainingRequests?: number;
    resetTime?: number;
    error?: string;
  } {
    const config = this.CONFIG[operation];
    const key = `${userId}:${operation}`;
    const now = Date.now();
    
    const entry = this.limits.get(key);
    
    // No previous entry or window has expired
    if (!entry || now > entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
        lastAttempt: now
      });
      
      return {
        allowed: true,
        remainingRequests: config.maxRequests - 1,
        resetTime: now + config.windowMs
      };
    }
    
    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      // Check for suspicious rapid attempts
      const timeSinceLastAttempt = now - entry.lastAttempt;
      if (timeSinceLastAttempt < 1000) { // Less than 1 second
        // Extend the ban for rapid attempts (potential bot)
        entry.resetTime = now + (config.windowMs * 2);
        this.logSecurityEvent(userId, operation, 'rapid_attempts', {
          attempts: entry.count,
          timeSinceLastAttempt
        });
      }
      
      return {
        allowed: false,
        resetTime: entry.resetTime,
        error: `Rate limit exceeded for ${operation}. Try again after ${new Date(entry.resetTime).toLocaleTimeString()}`
      };
    }
    
    // Increment counter
    entry.count++;
    entry.lastAttempt = now;
    
    return {
      allowed: true,
      remainingRequests: config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * Reset rate limit for a user (admin function)
   */
  static resetRateLimit(userId: string, operation?: keyof typeof RateLimiter.CONFIG): void {
    if (operation) {
      const key = `${userId}:${operation}`;
      this.limits.delete(key);
    } else {
      // Reset all operations for this user
      for (const key of this.limits.keys()) {
        if (key.startsWith(userId + ':')) {
          this.limits.delete(key);
        }
      }
    }
  }

  /**
   * Get current rate limit status for a user
   */
  static getRateLimitStatus(userId: string): Record<string, {
    count: number;
    maxRequests: number;
    resetTime: number;
    timeRemaining: number;
  }> {
    const status: Record<string, {
      count: number;
      maxRequests: number;
      resetTime: number;
      timeRemaining: number;
    }> = {};
    const now = Date.now();
    
    for (const [operation, config] of Object.entries(this.CONFIG)) {
      const key = `${userId}:${operation}`;
      const entry = this.limits.get(key);
      
      if (entry && now <= entry.resetTime) {
        status[operation] = {
          count: entry.count,
          maxRequests: config.maxRequests,
          resetTime: entry.resetTime,
          timeRemaining: entry.resetTime - now
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
    
    return status;
  }

  /**
   * Clean up expired entries (should be called periodically)
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
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
    
    // In production, this would integrate with the monitoring service
    // and send alerts to security team
  }

  /**
   * Get rate limiting statistics for admin dashboard
   */
  static getStatistics(): {
    totalActiveEntries: number;
    entriesByOperation: Record<string, number>;
    recentViolations: Array<{
      userId: string;
      operation: string;
      count: number;
      resetTime: number;
    }>;
  } {
    const now = Date.now();
    const entriesByOperation: Record<string, number> = {};
    const recentViolations: Array<{
      userId: string;
      operation: string;
      count: number;
      resetTime: number;
    }> = [];
    
    for (const [key, entry] of this.limits.entries()) {
      if (now <= entry.resetTime) {
        const [userId, operation] = key.split(':');
        
        entriesByOperation[operation] = (entriesByOperation[operation] || 0) + 1;
        
        const config = this.CONFIG[operation as keyof typeof RateLimiter.CONFIG];
        if (config && entry.count >= config.maxRequests) {
          recentViolations.push({
            userId,
            operation,
            count: entry.count,
            resetTime: entry.resetTime
          });
        }
      }
    }
    
    return {
      totalActiveEntries: this.limits.size,
      entriesByOperation,
      recentViolations
    };
  }

  /**
   * Update configuration (admin function)
   */
  static updateConfig(
    operation: keyof typeof RateLimiter.CONFIG,
    updates: Partial<{ maxRequests: number; windowMs: number }>
  ): void {
    const config = this.CONFIG[operation];
    if (updates.maxRequests !== undefined) {
      config.maxRequests = updates.maxRequests;
    }
    if (updates.windowMs !== undefined) {
      config.windowMs = updates.windowMs;
    }
  }
}

// Utility function for easy integration
export function checkPassCreationRateLimit(userId: string) {
  return RateLimiter.checkRateLimit(userId, 'PASS_CREATION');
}

export function checkLoginRateLimit(userId: string) {
  return RateLimiter.checkRateLimit(userId, 'LOGIN_ATTEMPTS');
}

// Auto-cleanup expired entries every 5 minutes
if (typeof window === 'undefined') { // Only in Node.js environment
  setInterval(() => {
    RateLimiter.cleanup();
  }, 5 * 60 * 1000);
} 