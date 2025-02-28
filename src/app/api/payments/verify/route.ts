import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { logger } from '@/lib/logger';
import { updatePaymentStatus } from '@/db/payment';
import { PaymentStatus } from '@/types/payment';

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
        
      console.log('🔍 Consultando endpoint:', endpoint);
      
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
      
      console.log('📊 Estado actual en LemonSqueezy:', status);
      logger.info({
        flow: 'payment_verify',
        stage: 'status_retrieved',
        orderId,
        lemonSqueezyStatus: status,
        orderData: JSON.stringify(orderData.attributes).substring(0, 200),
      }, `✅ Estado recuperado de LemonSqueezy: ${status}`);
      
      // Mapeamos el estado de LemonSqueezy a nuestro sistema
      let mappedStatus: PaymentStatus;
      
      if (status === 'paid' || status === 'completed' || status === 'success') {
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
      
      return NextResponse.json({
        success: true,
        orderId,
        originalStatus: status,
        mappedStatus,
        verifiedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error verificando pago:', error);
      logger.error({
        flow: 'payment_verify',
        stage: 'error',
        orderId: request.nextUrl.searchParams.get('orderId'),
        error
      }, '❌ Error verificando pago con LemonSqueezy');
      
      return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error verificando pago:', error);
    logger.error({
      flow: 'payment_verify',
      stage: 'error',
      orderId: request.nextUrl.searchParams.get('orderId'),
      error
    }, '❌ Error verificando pago con LemonSqueezy');
    
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
} 