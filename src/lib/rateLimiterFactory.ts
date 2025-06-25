import { RateLimiter as InMemoryRateLimiter } from './rateLimiter';

// Importing Redis implementation lazily to avoid bundling Redis in browser builds
let RedisImpl: typeof import('./rateLimiter.redis') | null = null;
const useRedis = process.env.USE_REDIS_RATE_LIMITER === 'true';

if (useRedis) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RedisImpl = require('./rateLimiter.redis');
}

type RateLimitResult = {
  allowed: boolean;
  remaining?: number;
  resetTime?: number;
  error?: string;
};

export interface RateLimiterInterface {
  checkRateLimit: (
    userId: string,
    operation: 'PASS_CREATION' | 'PASS_UPDATE' | 'LOGIN_ATTEMPTS'
  ) => RateLimitResult | Promise<RateLimitResult>;
  resetRateLimit: (
    userId: string,
    operation?: 'PASS_CREATION' | 'PASS_UPDATE' | 'LOGIN_ATTEMPTS'
  ) => void | Promise<void>;
}

// Choose active implementation
const ActiveImpl = useRedis && RedisImpl ? (RedisImpl.RedisRateLimiter as unknown as RateLimiterInterface) : (InMemoryRateLimiter as unknown as RateLimiterInterface);

export const RateLimiter: RateLimiterInterface = ActiveImpl;

// Convenience helpers -------------------------------------------------------
export function checkPassCreationRateLimit(userId: string): Promise<RateLimitResult> | RateLimitResult {
  if (useRedis && RedisImpl?.checkPassCreationRateLimit) {
    return RedisImpl.checkPassCreationRateLimit(userId);
  }
  // Fallback to in-memory
  return InMemoryRateLimiter.checkRateLimit(userId, 'PASS_CREATION');
}

export function checkLoginRateLimit(userId: string): Promise<RateLimitResult> | RateLimitResult {
  if (useRedis && RedisImpl?.checkLoginRateLimit) {
    return RedisImpl.checkLoginRateLimit(userId);
  }
  return InMemoryRateLimiter.checkRateLimit(userId, 'LOGIN_ATTEMPTS');
} 