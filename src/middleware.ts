import { NextResponse, type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  // Debug: Imprimir la URL que se está procesando
  console.log('Processing request for:', request.nextUrl.pathname);

  // Handle OPTIONS preflight requests
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

  // Skip auth for token and webhook endpoints
  if (
    request.nextUrl.pathname === '/api/webhooks/lemonsqueezy' ||
    request.nextUrl.pathname === '/api/auth/token'
  ) {
    console.log('Skipping auth for:', request.nextUrl.pathname);
    return NextResponse.next();
  }

  // Get the Authorization header
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid auth header format');
    return NextResponse.json(
      { error: 'Missing or invalid authorization token' },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  
  const isValid = await verifyAuth(token);
  console.log('Token validation result:', isValid);

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

// Configurar las rutas que deben pasar por el middleware
export const config = {
  matcher: '/api/:path*'
}; 