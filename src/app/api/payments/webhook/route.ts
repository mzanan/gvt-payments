import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { 
  updatePaymentStatus, 
  findPendingPayments,
  findPaymentByOrderId
} from '@/db/payment';
import { PaymentStatus } from '@/types/payment';

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

export async function POST(request: NextRequest) {
  try {
    const jsonData = await request.json();
    const eventName = request.headers.get('x-event-name');
    
    logger.info({
      flow: 'webhook',
      operation: 'process',
      eventName
    }, 'Payment webhook received');

    // Only process order_created events
    if (eventName !== 'order_created') {
      logger.info({
        flow: 'webhook',
        operation: 'skip',
        eventName
      }, `Ignoring non-order event: ${eventName}`);
      
      return NextResponse.json({ success: true });
    }

    // Extract IDs from the webhook data
    const identifier_id = jsonData?.meta?.custom_data?.order_id || 
                          jsonData?.data?.id;
    const numeric_id = jsonData?.data?.id;

    if (!identifier_id) {
      logger.warn({
        flow: 'webhook',
        operation: 'process',
        error: 'missing_identifier'
      }, 'Missing order identifier in webhook');
      
      return NextResponse.json(
        { error: 'Missing order identifier' },
        { status: 400 }
      );
    }

    // Find payment by ID
    const payment = await findPaymentByOrderId(identifier_id);
    
    // If payment not found by identifier, try to find by pending status
    let orderId = identifier_id;
    if (!payment) {
      const pendingPayments = await findPendingPayments();
      
      // Find the most recent pending payment (likely to be the one we want)
      if (pendingPayments && pendingPayments.length > 0) {
        // Sort by creation date (descending) and take the first one
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

    // Map LemonSqueezy status to our internal status
    const lsStatus = jsonData?.data?.attributes?.status;
    const status = mapPaymentStatus(lsStatus);

    // Update payment status in database
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

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully'
    });
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