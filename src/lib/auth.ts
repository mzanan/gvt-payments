import * as jose from 'jose';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

// Use the validated JWT_SECRET from env module
const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Verifies a JWT token's validity
 * @param token - The JWT token to verify
 * @returns True if the token is valid
 */
export async function verifyAuth(token: string): Promise<boolean> {
  try {
    await jose.jwtVerify(token, secret);
    return true;
  } catch (error) {
    logger.warn({
      flow: 'auth',
      operation: 'verifyAuth',
      error
    }, '🔒 Token verification failed');
    return false;
  }
}

/**
 * Generates a new JWT token
 * @param payload - Data to include in the token
 * @returns The generated token
 */
export async function generateToken(payload: jose.JWTPayload): Promise<string> {
  try {
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(env.JWT_EXPIRY)
      .sign(secret);
    
    logger.debug({
      flow: 'auth',
      operation: 'generateToken',
      payload
    }, '🔑 Token generated successfully');
    
    return token;
  } catch (error) {
    logger.error({
      flow: 'auth',
      operation: 'generateToken',
      error
    }, '❌ Token generation failed');
    throw error;
  }
}

/**
 * Gets a service token for internal API calls
 * @returns A JWT token for service-to-service authentication
 */
export async function getToken(): Promise<string> {
  const payload = { 
    type: 'service_token', 
    iat: Date.now(),
    service: 'gvt-payments'
  };
  return generateToken(payload);
} 