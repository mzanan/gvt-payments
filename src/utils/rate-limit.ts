/**
 * Rate limiting utility for API endpoints
 * Protects against abuse and denial of service attacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface RateLimitOptions {
  limit: number;        // Maximum number of requests allowed in the window
  windowMs: number;     // Time window in milliseconds
  keyGenerator?: (req: NextRequest) => string;  // Function to generate unique keys for requests
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup expired rate limit records every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Default key generator function that uses IP address
 */
const defaultKeyGenerator = (req: NextRequest): string => {
  // Get client IP from headers as req.ip is not available in NextRequest
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             '127.0.0.1';
  return `rate-limit:${ip}`;
};

/**
 * Rate limiting middleware for Next.js API routes
 * 
 * @param options - Rate limit configuration options
 * @returns Middleware function for rate limiting
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    limit,
    windowMs,
    keyGenerator = defaultKeyGenerator
  } = options;

  return async function rateLimitMiddleware(
    req: NextRequest,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get existing record or create a new one
    let record = rateLimitStore.get(key);
    
    if (!record || record.resetTime <= now) {
      // Create new record if none exists or the previous window expired
      record = {
        count: 0,
        resetTime: now + windowMs
      };
    }
    
    // Increment request count
    record.count += 1;
    rateLimitStore.set(key, record);
    
    // Check if limit is exceeded
    if (record.count > limit) {
      const timeToReset = Math.ceil((record.resetTime - now) / 1000);
      
      logger.warn({
        flow: 'rate_limit',
        stage: 'limit_exceeded',
        key,
        count: record.count,
        limit,
        timeToReset
      }, '⚠️ Rate limit exceeded');
      
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${timeToReset} seconds.`
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(timeToReset),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(record.resetTime / 1000))
          }
        }
      );
    }
    
    // Add rate limit headers to the response
    const response = await next();
    const remainingRequests = Math.max(0, limit - record.count);
    
    // Clone the response to add headers
    const newResponse = NextResponse.json(
      response.json(),
      {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remainingRequests),
          'X-RateLimit-Reset': String(Math.ceil(record.resetTime / 1000))
        }
      }
    );
    
    return newResponse;
  };
}