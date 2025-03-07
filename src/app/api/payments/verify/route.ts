import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { logger } from '@/lib/logger';
import { updatePaymentStatus, getPaymentStatus } from '@/db/payment';
import { PaymentStatus } from '@/types/payment';

// Cache para almacenar las últimas verificaciones y evitar consultas repetidas
interface VerificationCache {
  [orderId: string]: {
    timestamp: number;
    result: {
      success: boolean;
      orderId: string;
      originalStatus: string;
      mappedStatus: string;
      verifiedAt: string;
    };
  }
}

// Tiempo mínimo entre verificaciones para el mismo orderId (5 minutos)
const MIN_VERIFICATION_INTERVAL_MS = 5 * 60 * 1000;

// Caché de verificaciones recientes
const verificationsCache: VerificationCache = {};

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId');
    
    if (!orderId) {
      logger.error({
        flow: 'payment_verify',
        stage: 'validation_error',
        error: 'Missing orderId parameter'
      }, '❌ Error: Falta parámetro orderId');
      
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }
    
    // Verificación de formato
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const isNumericId = /^\d+$/.test(orderId);
    
    // Comprobamos si hay una verificación reciente en caché para este orderId
    const cachedVerification = verificationsCache[orderId];
    const now = Date.now();
    
    if (cachedVerification && (now - cachedVerification.timestamp) < MIN_VERIFICATION_INTERVAL_MS) {
      logger.info({
        flow: 'payment_verify',
        stage: 'cache_hit',
        orderId,
        cacheAge: Math.round((now - cachedVerification.timestamp) / 1000),
        maxAge: MIN_VERIFICATION_INTERVAL_MS / 1000
      }, '🔄 Usando verificación en caché (para evitar consultas excesivas)');
      
      return NextResponse.json({
        ...cachedVerification.result,
        fromCache: true,
        cacheAge: Math.round((now - cachedVerification.timestamp) / 1000),
        verifiedAt: new Date(cachedVerification.timestamp).toISOString()
      });
    }
    
    logger.info({
      flow: 'payment_verify',
      stage: 'initiated',
      orderId,
      idFormat: {
        isUuid,
        isNumericId
      }
    }, '🔍 Verificando pago directamente con LemonSqueezy');
    
    try {
      // Utilizamos el endpoint correcto según el formato del ID
      const endpoint = isNumericId 
        ? `https://api.lemonsqueezy.com/v1/orders/${orderId}`
        : `https://api.lemonsqueezy.com/v1/checkouts/${orderId}`;
        
      logger.info({
        flow: 'payment_verify',
        stage: 'api_request',
        endpoint
      }, '🔄 Consultando endpoint LemonSqueezy');
      
      // Consultamos la API de LemonSqueezy para obtener el estado actualizado
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.data || !response.data.data) {
        logger.warn({
          flow: 'payment_verify',
          stage: 'invalid_response',
          orderId,
        }, '⚠️ Respuesta inválida de LemonSqueezy API');
        return NextResponse.json({ error: 'Invalid response from LemonSqueezy' }, { status: 500 });
      }
      
      const orderData = response.data.data;
      const status = orderData.attributes.status;
      const lemonSqueezyIdentifier = orderData.attributes.identifier;
      const lemonSqueezyNumericId = orderData.id;
      
      logger.info({
        flow: 'payment_verify',
        stage: 'status_retrieved',
        orderId,
        lemonSqueezyStatus: status,
        orderData: JSON.stringify(orderData.attributes).substring(0, 200),
      }, `✅ Estado recuperado de LemonSqueezy: ${status}`);
      
      // Mapeamos el estado de LemonSqueezy a nuestro sistema
      let mappedStatus: PaymentStatus;
      
      if (status === 'paid') {
        mappedStatus = PaymentStatus.PAID;
      } else if (status === 'refunded' || status === 'cancelled' || status === 'canceled' || status === 'void') {
        mappedStatus = PaymentStatus.VOID;
      } else {
        mappedStatus = PaymentStatus.PENDING;
      }
      
      // Actualizamos nuestro estado local con todos los IDs
      await updatePaymentStatus(
        orderId, 
        mappedStatus, 
        {
          numeric_id: lemonSqueezyNumericId,
          identifier_id: lemonSqueezyIdentifier
        }
      );
      
      logger.info({
        flow: 'payment_verify',
        stage: 'status_updated',
        orderId,
        originalStatus: status,
        mappedStatus,
      }, `✅ Estado actualizado desde verificación: ${status} → ${mappedStatus}`);
      
      // Preparamos la respuesta
      const result = {
        success: true,
        orderId,
        originalStatus: status,
        mappedStatus,
        verifiedAt: new Date().toISOString()
      };
      
      // Guardamos en caché
      verificationsCache[orderId] = {
        timestamp: now,
        result
      };
      
      // Registramos si el webhook dio respuesta o no
      if (mappedStatus === PaymentStatus.PAID) {
        logger.info({
          flow: 'payment_verify',
          stage: 'webhook_check',
          orderId,
          status: mappedStatus
        }, '✅ WEBHOOK FUNCIONÓ: El pago ya está marcado como PAID');
      } else {
        // Verificamos si el pago debería estar pagado (verificamos primero en la BD)
        const payment = await getPaymentStatus(orderId);
        if (payment && payment.status === PaymentStatus.PENDING && status === 'paid') {
          logger.warn({
            flow: 'payment_verify',
            stage: 'webhook_check',
            orderId,
            lemonsqueezy_status: status,
            local_status: payment.status
          }, '⚠️ WEBHOOK NO FUNCIONÓ: El pago está marcado como pagado en LemonSqueezy pero no localmente');
        }
      }
      
      return NextResponse.json(result);
      
    } catch (error) {
      logger.error({
        flow: 'payment_verify',
        stage: 'error',
        orderId: request.nextUrl.searchParams.get('orderId'),
        error
      }, '❌ Error verificando pago con LemonSqueezy');
      
      return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
    }
  } catch (error) {
    logger.error({
      flow: 'payment_verify',
      stage: 'error',
      orderId: request.nextUrl.searchParams.get('orderId'),
      error
    }, '❌ Error verificando pago con LemonSqueezy');
    
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
} 