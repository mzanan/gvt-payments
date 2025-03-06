import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { 
  updatePaymentStatus, 
  findPendingPayments,
  findPaymentByOrderId
} from '@/db/payment';
import { PaymentStatus } from '@/types/payment';

// Tipo para los datos del webhook
interface WebhookData {
  meta?: {
    custom_data?: {
      order_id?: string;
    };
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
    };
  };
}

/**
 * Maps a LemonSqueezy payment status to our internal PaymentStatus enum
 */
function mapPaymentStatus(lsStatus: string): PaymentStatus {
  switch(lsStatus) {
    case 'paid':
    case 'completed':
    case 'success':
      return PaymentStatus.PAID;
    case 'refunded':
    case 'cancelled':
    case 'canceled':
    case 'void':
      return PaymentStatus.VOID;
    default:
      return PaymentStatus.PENDING;
  }
}

// Responder rápidamente para evitar timeouts
const sendSuccessResponse = () => {
  return NextResponse.json({ success: true });
};

// Procesar el webhook en segundo plano y registrar errores sin bloquear
const processWebhookAsync = async (jsonData: WebhookData, eventName: string | null) => {
  try {
    // Solo procesar eventos de tipo order_created
    if (eventName !== 'order_created') {
      logger.info({
        flow: 'webhook',
        operation: 'skip',
        eventName
      }, `Ignoring non-order event: ${eventName}`);
      return;
    }

    // Extraer IDs del webhook
    const identifier_id = jsonData?.meta?.custom_data?.order_id || 
                          jsonData?.data?.id;
    const numeric_id = jsonData?.data?.id;

    if (!identifier_id) {
      logger.warn({
        flow: 'webhook',
        operation: 'process',
        error: 'missing_identifier'
      }, 'Missing order identifier in webhook');
      return;
    }

    // Buscar pago por ID
    const payment = await findPaymentByOrderId(identifier_id);
    
    // Si no se encuentra el pago por el identificador, intentar buscar por estado pendiente
    let orderId = identifier_id;
    if (!payment) {
      const pendingPayments = await findPendingPayments();
      
      // Encontrar el pago pendiente más reciente (probablemente sea el que queremos)
      if (pendingPayments && pendingPayments.length > 0) {
        // Ordenar por fecha de creación (descendente) y tomar el primero
        const mostRecentPayment = pendingPayments.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        orderId = mostRecentPayment.order_id;
        
        logger.info({
          flow: 'webhook',
          operation: 'recovery',
          orderId
        }, 'Found pending payment to associate with webhook');
      }
    }

    // Mapear el estado de LemonSqueezy a nuestro estado interno
    const lsStatus = jsonData?.data?.attributes?.status;
    const status = mapPaymentStatus(lsStatus || '');

    // Actualizar el estado del pago en la base de datos
    await updatePaymentStatus(orderId, status, {
      numeric_id,
      identifier_id
    });

    logger.info({
      flow: 'webhook',
      operation: 'success',
      orderId,
      status
    }, 'Payment status updated successfully');
  } catch (error) {
    logger.error({
      flow: 'webhook',
      operation: 'error',
      error: error instanceof Error ? error.message : String(error)
    }, 'Error processing webhook in background');
  }
};

export async function POST(request: NextRequest) {
  try {
    const jsonData = await request.json() as WebhookData;
    const eventName = request.headers.get('x-event-name');
    
    logger.info({
      flow: 'webhook',
      operation: 'process',
      eventName
    }, 'Payment webhook received');

    // Enviar una respuesta inmediata para evitar timeouts
    const response = sendSuccessResponse();
    
    // Procesar el webhook de forma asíncrona en segundo plano
    // setTimeout garantiza que la respuesta se envía antes de iniciar el procesamiento pesado
    setTimeout(() => {
      processWebhookAsync(jsonData, eventName).catch(error => {
        logger.error({
          flow: 'webhook',
          operation: 'async_error',
          error: error instanceof Error ? error.message : String(error)
        }, 'Unhandled error in async webhook processing');
      });
    }, 0);
    
    return response;
  } catch (error) {
    logger.error({
      flow: 'webhook',
      operation: 'error',
      error: error instanceof Error ? error.message : String(error)
    }, 'Error processing webhook');
    
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}