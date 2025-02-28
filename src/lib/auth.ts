import * as jose from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function verifyAuth(token: string): Promise<boolean> {
  try {
    await jose.jwtVerify(token, secret);
    return true;
  } catch (error) {
    throw new Error('Invalid token ', { cause: error });
  }
}

export async function generateToken(payload: jose.JWTPayload): Promise<string> {
  try {
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret);
    return token;
  } catch (error) {
    throw error;
  }
}

export async function getToken(): Promise<string> {
  const payload = { type: 'service_token', iat: Date.now() };
  return generateToken(payload);
} 