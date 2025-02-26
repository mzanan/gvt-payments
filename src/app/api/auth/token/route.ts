import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      logger.error('Empty request body', 'Auth token generation failed');
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      logger.error('Invalid content type', 'Auth token generation failed');
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    logger.info({
      hasClientId: !!body.clientId,
      hasClientSecret: !!body.clientSecret
    }, 'Received auth request');

    if (!body.clientId || !body.clientSecret) {
      logger.error('Missing credentials', 'Auth token generation failed');
      return NextResponse.json(
        { error: 'Missing required credentials' },
        { status: 400 }
      );
    }

    const validClientId = process.env.ALLOWED_CLIENT_ID;
    const validClientSecret = process.env.ALLOWED_CLIENT_SECRET;

    if (!validClientId || !validClientSecret) {
      logger.error('Missing env variables', 'Auth token generation failed');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    if (body.clientId !== validClientId || body.clientSecret !== validClientSecret) {
      logger.error('Invalid credentials', 'Auth token generation failed');
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

    logger.info({ clientId: body.clientId }, 'Token generated successfully');
    return NextResponse.json({ token });

  } catch (error) {
    logger.error(error, 'Token generation error');
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}