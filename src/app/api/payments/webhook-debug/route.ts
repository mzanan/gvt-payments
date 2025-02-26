import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Capturar los datos brutos del webhook
    const rawPayload = await request.text();
    const payload = JSON.parse(rawPayload);
    
    // Registrar todos los headers para verificar firmas
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Registrar toda la información para depuración
    logger.info({
      webhookReceived: true,
      headers,
      payload,
      timestamp: new Date().toISOString(),
    }, '🔍 WEBHOOK DEBUG - Received raw webhook data');
    
    return NextResponse.json({ success: true, message: 'Webhook received and logged' });
  } catch (error) {
    logger.error({ error }, 'WEBHOOK DEBUG - Error processing webhook');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 