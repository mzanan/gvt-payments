/**
 * API middleware for authentication, CORS, and request validation
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Middleware function that runs before API route handlers
 */
export async function middleware(request: NextRequest) {
  // Handle OPTIONS preflight requests for CORS
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      },
    });
  }

  // Add cache headers for GET requests that don't change often
  if (request.method === 'GET' && 
      request.nextUrl.pathname.startsWith('/api/payments/status/')) {
    const response = NextResponse.next();
    
    // Add cache headers for status endpoints
    response.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    
    return response;
  }

  // Skip auth for public endpoints
  if (
    request.nextUrl.pathname === '/api/payments/webhook' ||
    request.nextUrl.pathname === '/api/auth/token'
  ) {
    logger.debug({
      flow: 'middleware',
      operation: 'auth_check',
      path: request.nextUrl.pathname,
      result: 'skipped'
    }, '🔓 Skipping auth for public endpoint');
    
    return NextResponse.next();
  }

  // Validate Authorization header
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({
      flow: 'middleware',
      operation: 'auth_check',
      path: request.nextUrl.pathname,
      error: 'missing_token',
    }, '🔒 Missing or malformed authorization header');
    
    return NextResponse.json(
      { error: 'Missing or invalid authorization token' },
      { status: 401 }
    );
  }

  // Verify the token
  const token = authHeader.split(' ')[1];
  const isValid = await verifyAuth(token);

  if (!isValid) {
    logger.warn({
      flow: 'middleware',
      operation: 'auth_check',
      path: request.nextUrl.pathname,
      error: 'invalid_token',
    }, '🔒 Invalid or expired token');
    
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Token is valid, proceed to the route handler
  logger.debug({
    flow: 'middleware',
    operation: 'auth_check',
    path: request.nextUrl.pathname,
    result: 'success'
  }, '✅ Authentication successful');
  
  return NextResponse.next();
}

// Configure routes that should pass through this middleware
export const config = {
  matcher: '/api/:path*'
};