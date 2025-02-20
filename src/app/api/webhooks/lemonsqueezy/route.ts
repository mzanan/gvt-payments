import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { webhookEventSchema, PaymentServiceError, WebhookEvent } from '@/types/lemonsqueezy';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

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

    if ( event.data.attributes.product_id !== process.env.LEMONSQUEEZY_PRODUCT_ID ) {
      throw new PaymentServiceError(
        'Invalid product',
        'INVALID_PRODUCT',
        403
      );
    }

    switch (event.meta.event_name) {
      case 'order_created':
        await handleOrderCreated(event);
        break;
      case 'subscription_created':
        await handleSubscriptionCreated(event);
        break;
      case 'subscription_updated':
        await handleSubscriptionUpdated(event);
        break;
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(event);
        break;
    }

    return NextResponse.json({ received: true });
    
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
  logger.info({ orderId: event.data.id }, 'New order created');
}

async function handleSubscriptionCreated(event: WebhookEvent) {
  const { customer_id, user_id, variant_id, renews_at } = event.data.attributes;
  
  await prisma.subscription.create({
    data: {
      subscriptionId: event.data.id,
      customerId: customer_id,
      userId: user_id,
      variantId: variant_id,
      currentPeriodEnd: renews_at,
      status: 'active'
    }
  });
}

async function handleSubscriptionUpdated(event: WebhookEvent) {
  logger.info({ subscriptionId: event.data.id }, 'Subscription updated');
}

async function handleSubscriptionCancelled(event: WebhookEvent) {
  logger.info({ subscriptionId: event.data.id }, 'Subscription cancelled');
}
