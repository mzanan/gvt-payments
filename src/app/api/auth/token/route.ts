import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { env } from '@/config/env';

/**
 * Handles POST requests to generate authentication tokens
 */
export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      logger.error({
        flow: 'api_auth',
        operation: 'generateToken',
        stage: 'validate_request',
        error: 'Empty body'
      }, '❌ Empty request body');
      
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      logger.error({
        flow: 'api_auth',
        operation: 'generateToken',
        stage: 'validate_request',
        error: 'Invalid content type',
        contentType
      }, '❌ Invalid content type');
      
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    logger.info({
      flow: 'api_auth',
      operation: 'generateToken',
      stage: 'received_request',
      hasClientId: !!body.clientId,
      hasClientSecret: !!body.clientSecret
    }, '🔑 Received auth request');

    if (!body.clientId || !body.clientSecret) {
      logger.error({
        flow: 'api_auth',
        operation: 'generateToken',
        stage: 'validate_credentials',
        error: 'Missing credentials'
      }, '❌ Missing required credentials');
      
      return NextResponse.json(
        { error: 'Missing required credentials' },
        { status: 400 }
      );
    }

    // Use validated environment variables
    const validClientId = env.ALLOWED_CLIENT_ID;
    const validClientSecret = env.ALLOWED_CLIENT_SECRET;

    if (body.clientId !== validClientId || body.clientSecret !== validClientSecret) {
      logger.error({
        flow: 'api_auth',
        operation: 'generateToken',
        stage: 'validate_credentials',
        error: 'Invalid credentials',
        providedClientId: body.clientId
      }, '❌ Invalid credentials');
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await generateToken({
      clientId: body.clientId,
      type: 'access_token',
      iat: Date.now()
    });

    logger.info({
      flow: 'api_auth',
      operation: 'generateToken',
      stage: 'success',
      clientId: body.clientId
    }, '✅ Token generated successfully');
    
    return NextResponse.json({ token });

  } catch (error) {
    logger.error({
      flow: 'api_auth',
      operation: 'generateToken',
      stage: 'error',
      error
    }, '❌ Token generation error');
    
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}