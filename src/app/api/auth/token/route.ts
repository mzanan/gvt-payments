import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.clientId || !body.clientSecret) {
      return NextResponse.json(
        { error: 'Missing required credentials' },
        { status: 400 }
      );
    }

    const validClientId = process.env.ALLOWED_CLIENT_ID;
    const validClientSecret = process.env.ALLOWED_CLIENT_SECRET;

    if (!validClientId || !validClientSecret) {
      console.error('Missing environment variables for authentication');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    if (body.clientId !== validClientId || body.clientSecret !== validClientSecret) {
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

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
} 