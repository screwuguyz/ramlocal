// Simple IP-based rate limiter
// No external dependencies, uses in-memory LRU cache

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

class RateLimiter {
  private cache: Map<string, RateLimitEntry>;
  private maxSize: number;

  constructor(maxSize = 500) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  // Clean up old entries
  private cleanup() {
    if (this.cache.size < this.maxSize) return;

    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.resetTime < now) {
        this.cache.delete(key);
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 100);
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  check(identifier: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetTime: number } {
    this.cleanup();

    const now = Date.now();
    const entry = this.cache.get(identifier);

    if (!entry || entry.resetTime < now) {
      // New window
      const resetTime = now + windowMs;
      this.cache.set(identifier, { count: 1, resetTime });
      return { allowed: true, remaining: limit - 1, resetTime };
    }

    if (entry.count >= limit) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    // Increment count
    entry.count++;
    this.cache.set(identifier, entry);
    return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime };
  }
}

// Global instance
const rateLimiter = new RateLimiter();

// Rate limit configurations
export const RATE_LIMITS = {
  LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  API: { limit: 60, windowMs: 60 * 1000 }, // 60 requests per minute
  UPLOAD: { limit: 10, windowMs: 60 * 1000 }, // 10 uploads per minute
  MUTATION: { limit: 30, windowMs: 60 * 1000 }, // 30 mutations per minute
};

export function checkRateLimit(
  identifier: string,
  config: { limit: number; windowMs: number }
): { allowed: boolean; remaining: number; resetTime: number } {
  return rateLimiter.check(identifier, config.limit, config.windowMs);
}

// Helper to get client IP from request
export function getClientIp(request: Request): string {
  // Check common headers for real IP (reverse proxy support)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to 'unknown' if we can't determine IP
  return 'unknown';
}
