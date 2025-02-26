import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getPaymentStatus } from '@/db/payment';

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json(
        { 
          error: 'Order ID is required',
          code: 'MISSING_ORDER_ID'
        },
        { status: 400 }
      );
    }

    logger.info({
      flow: 'payment_status',
      stage: 'check_requested',
      orderId,
      timestamp: new Date().toISOString()
    }, '🔎 Payment status check requested');

    const paymentStatus = await getPaymentStatus(orderId);

    if (!paymentStatus) {
      logger.warn({
        flow: 'payment_status',
        stage: 'not_found',
        orderId
      }, '⚠️ Payment status not found for order');
      
      return NextResponse.json(
        { 
          error: 'Payment status not found',
          code: 'STATUS_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    logger.info({
      flow: 'payment_status',
      stage: 'retrieved',
      orderId,
      status: paymentStatus.status,
      lastUpdated: paymentStatus.updated_at
    }, '✅ Payment status retrieved');

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        status: paymentStatus.status,
        lastUpdated: paymentStatus.updated_at,
      }
    });

  } catch (error) {
    logger.error({
      flow: 'payment_status',
      stage: 'error',
      orderId: request.nextUrl.searchParams.get('orderId'),
      error
    }, '❌ Error checking payment status');
    
    return NextResponse.json(
      { 
        error: 'Failed to get payment status',
        code: 'STATUS_CHECK_FAILED'
      },
      { status: 500 }
    );
  }
}