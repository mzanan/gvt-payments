import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { 
  updatePaymentStatus, 
  getPaymentStatusByLemonSqueezyId, 
  getPaymentStatus,
  findPendingPayments
} from '@/db/payment';
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
    
    logger.info({
      flow: 'webhook',
      stage: 'ids_received',
      identifier_id,
      numeric_id
    }, '✅ IDs recibidos en el webhook');
    
    // Intentar encontrar el pago usando numeric_id
    let payment = await getPaymentStatusByLemonSqueezyId(numeric_id);
    
    // Si no lo encontramos con numeric_id, debemos buscar de otra manera
    if (!payment) {
      logger.warn({
        flow: 'webhook',
        stage: 'payment_not_found_by_numeric_id',
        numeric_id
      }, '⚠️ No se encontró pago por numeric_id, intentando alternativas');
      
      // Intentar obtener order_id del store (flujo original)
      const orderId = getOrderId("1"); // Este es el ID fijo que se usa en el store
      
      if (orderId) {
        logger.info({
          flow: 'webhook',
          stage: 'order_id_found_in_store',
          orderId
        }, '✅ Order ID encontrado en el store');
        
        // Verificar que existe en la base de datos
        payment = await getPaymentStatus(orderId);
      }
      
      // Si aún no tenemos el pago, buscar pagos pendientes recientes
      if (!payment) {
        logger.info({
          flow: 'webhook',
          stage: 'looking_for_pending_payments'
        }, '🔍 Buscando pagos pendientes recientes');
        
        const pendingPayments = await findPendingPayments();
        
        if (pendingPayments.length > 0) {
          // Tomamos el pago pendiente más reciente (el primero del array)
          payment = pendingPayments[0];
          
          logger.info({
            flow: 'webhook',
            stage: 'found_pending_payment',
            order_id: payment.order_id,
            created_at: payment.created_at
          }, '✅ Encontrado pago pendiente que se asociará con este webhook');
        }
      }
      
      if (!payment) {
        logger.error({
          flow: 'webhook',
          stage: 'payment_not_found',
          identifier_id,
          numeric_id
        }, '❌ No se encontró ningún registro de pago por ningún método');
        
        return NextResponse.json(
          { error: 'Payment record not found for the provided IDs' },
          { status: 404 }
        );
      }
    }
    
    const orderId = payment.order_id;
    
    logger.info({
      flow: 'webhook',
      stage: 'order_id_found',
      orderId,
      identifier_id,
      numeric_id,
      payment_status: payment.status
    }, '✅ Order ID encontrado en la base de datos');
    
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
        mappedStatus = PaymentStatus.VOID;
        break;
      default:
        mappedStatus = PaymentStatus.PENDING;
    }
    
    // Actualizar el registro existente con los nuevos IDs manteniendo el order_id original
    const result = await updatePaymentStatus(orderId, mappedStatus, {
      numeric_id,
      identifier_id
    });
    
    if (!result.success) {
      logger.error({
        flow: 'webhook',
        stage: 'update_error',
        orderId,
        numeric_id,
        identifier_id,
        status,
        mappedStatus,
        error: result.error
      }, '❌ Error actualizando estado de pago');
      
      return NextResponse.json(
        { error: 'Error updating payment status', details: result.error },
        { status: 500 }
      );
    }
    
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