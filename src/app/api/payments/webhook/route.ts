import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { webhookEventSchema, PaymentServiceError, WebhookEvent } from '@/types/lemonsqueezy';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-signature');

    if (!signature) {
      throw new PaymentServiceError(
        'Missing signature header',
        'MISSING_SIGNATURE',
        401
      );
    }

    if (!verifyWebhookSignature(body, signature)) {
      throw new PaymentServiceError(
        'Invalid webhook signature',
        'INVALID_SIGNATURE',
        401
      );
    }

    const rawEvent = JSON.parse(body);
    const validatedEvent = webhookEventSchema.safeParse(rawEvent);

    if (!validatedEvent.success) {
      throw new PaymentServiceError(
        'Invalid webhook payload',
        'INVALID_PAYLOAD',
        400,
        validatedEvent.error
      );
    }

    const event = validatedEvent.data;
    
    logger.info({
      eventType: event.meta.event_name,
      eventId: event.data.id
    }, 'Processing webhook event');

    // Check product ID only for relevant events
    if (
      ['order_created', 'subscription_created', 'subscription_payment_success'].includes(event.meta.event_name) && 
      event.data.attributes.product_id !== process.env.LEMONSQUEEZY_PRODUCT_ID
    ) {
      throw new PaymentServiceError(
        'Invalid product',
        'INVALID_PRODUCT',
        403
      );
    }

    let eventResponse;

    switch (event.meta.event_name) {
      case 'order_created':
        logger.info({
          event: 'order_created',
          orderId: event.data.id,
          timestamp: new Date().toISOString()
        }, '🛒 Processing new order');
        eventResponse = await handleOrderCreated(event);
        break;

      case 'subscription_created':
        logger.info({
          event: 'subscription_created',
          subscriptionId: event.data.id,
          customerId: event.data.attributes.customer_id,
          timestamp: new Date().toISOString()
        }, '✨ New subscription created');
        eventResponse = await handleSubscriptionCreated(event);
        break;

      case 'subscription_updated':
        logger.info({
          event: 'subscription_updated',
          subscriptionId: event.data.id,
          status: event.data.attributes.status,
          timestamp: new Date().toISOString()
        }, '📝 Subscription updated');
        eventResponse = await handleSubscriptionUpdated(event);
        break;

      case 'subscription_payment_success':
        logger.info({
          event: 'subscription_payment_success',
          subscriptionId: event.data.id,
          nextRenewal: event.data.attributes.renews_at,
          timestamp: new Date().toISOString()
        }, '💰 Payment successful');
        eventResponse = await handleSubscriptionPaymentSuccess(event);
        break;

      case 'subscription_payment_failed':
        logger.error({
          event: 'subscription_payment_failed',
          subscriptionId: event.data.id,
          timestamp: new Date().toISOString()
        }, '❌ Payment failed');
        eventResponse = await handleSubscriptionPaymentFailed(event);
        break;

      case 'subscription_cancelled':
        logger.warn({
          event: 'subscription_cancelled',
          subscriptionId: event.data.id,
          timestamp: new Date().toISOString()
        }, '🚫 Subscription cancelled');
        eventResponse = await handleSubscriptionCancelled(event);
        break;
    }

    return NextResponse.json({ 
      received: true,
      event: event.meta.event_name,
      data: eventResponse 
    });
    
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      logger.error({
        code: error.code,
        message: error.message,
        originalError: error.originalError
      }, 'Webhook processing failed');
      
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    logger.error(error, 'Unexpected error processing webhook');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET is not defined');

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

async function handleOrderCreated(event: WebhookEvent) {
  const { order_number, total, currency, billing, test_mode } = event.data.attributes;
  
  if (!billing?.email) {
    logger.warn({
      orderId: event.data.id,
      orderNumber: order_number,
      isTestMode: test_mode
    }, 'Test mode webhook received');
  }

  logger.info({ 
    orderId: event.data.id,
    orderNumber: order_number,
    total,
    currency,
    customerEmail: billing?.email
  }, 'New order created');

  return {
    type: 'order.created',
    orderId: event.data.id,
    orderNumber: order_number,
    total,
    currency,
    billingInfo: billing ? {
      email: billing.email,
      name: billing.name,
      country: billing.country
    } : null
  };
}

async function handleSubscriptionCreated(event: WebhookEvent) {
  logger.info({
    subscriptionId: event.data.id,
    customerId: event.data.attributes.customer_id,
    status: 'active'
  }, 'New subscription created');
}

async function handleSubscriptionUpdated(event: WebhookEvent) {
  logger.info({
    subscriptionId: event.data.id,
    status: event.data.attributes.status
  }, 'Subscription updated');
}

async function handleSubscriptionPaymentSuccess(event: WebhookEvent) {
  const { renews_at, status, product_id, variant_id } = event.data.attributes;
  
  logger.info({
    subscriptionId: event.data.id,
    productId: product_id,
    variantId: variant_id,
    nextRenewalDate: renews_at,
    status: 'active'
  }, 'Subscription payment successful');

  return {
    type: 'subscription.payment.success',
    subscriptionId: event.data.id,
    status: 'active',
    nextRenewalDate: renews_at,
    productId: product_id,
    variantId: variant_id
  };
}

async function handleSubscriptionPaymentFailed(event: WebhookEvent) {
  logger.warn({
    subscriptionId: event.data.id,
    status: 'past_due'
  }, 'Subscription payment failed');

  return {
    type: 'subscription.payment.failed',
    subscriptionId: event.data.id,
    status: 'past_due'
  };
}

async function handleSubscriptionCancelled(event: WebhookEvent) {
  logger.warn({
    subscriptionId: event.data.id,
    status: 'cancelled'
  }, 'Subscription cancelled');

  return {
    type: 'subscription.cancelled',
    subscriptionId: event.data.id,
    status: 'cancelled'
  };
}
