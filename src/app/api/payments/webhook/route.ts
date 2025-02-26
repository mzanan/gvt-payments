import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { updatePaymentStatus } from '@/db/payment';
import { PaymentStatus } from '@/types/payment';
import { WebhookEvent } from '@/types/lemonsqueezy';
import { getOrderId } from '@/store/orderStore';

export async function POST(request: NextRequest) {
  try {
    logger.info({}, '🚨 WEBHOOK RECEIVED 🚨');
    
    const body = await request.json();
    const event = body as WebhookEvent;
    
    // Extraer identifier_id y numeric_id del webhook
    const identifier_id = event.data?.attributes?.identifier;
    const numeric_id = event.data?.id;
    
    // Obtener order_id del store global
    const orderId = getOrderId('1');
    
    if (!orderId) {
      logger.error({
        flow: 'webhook',
        stage: 'order_id_missing',
        identifier_id,
        numeric_id
      }, '❌ No se pudo encontrar el order_id en el store global');
      
      return NextResponse.json(
        { error: 'Order ID not found in global store' },
        { status: 400 }
      );
    }
    
    logger.info({
      flow: 'webhook',
      stage: 'order_id_found',
      orderId,
      identifier_id,
      numeric_id
    }, '✅ Order ID encontrado en el store global');
    
    // Extraer el estado del webhook
    const status = event.data?.attributes?.status;
    
    // Mapear el estado de LemonSqueezy a nuestro sistema
    let mappedStatus: PaymentStatus;
    
    switch(status) {
      case 'paid':
      case 'completed':
      case 'success':
        mappedStatus = PaymentStatus.PAID;
        break;
      case 'refunded':
      case 'cancelled':
      case 'canceled':
      case 'void':
        mappedStatus = PaymentStatus.VOIDED;
        break;
      default:
        mappedStatus = PaymentStatus.PENDING;
    }
    
    // Actualizar el registro existente con los nuevos IDs
    await updatePaymentStatus(orderId, mappedStatus, {
      numeric_id,
      identifier_id
    });
    
    logger.info({
      flow: 'webhook',
      stage: 'status_updated',
      orderId,
      numeric_id,
      identifier_id,
      status,
      mappedStatus
    }, `✅ Registro actualizado con éxito: ${status} → ${mappedStatus}`);
    
    return NextResponse.json({ status: 'success' });
    
  } catch (error) {
    logger.error({
      flow: 'webhook',
      stage: 'error',
      error
    }, '❌ Error procesando webhook');
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}