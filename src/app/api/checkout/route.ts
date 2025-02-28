import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { checkoutRequestSchema } from '@/types/lemonsqueezy';
import { updatePaymentStatus } from '@/db/payment';
import { PaymentStatus } from '@/types/payment';
import { storeOrderId, TIMEOUT_MINUTES } from '@/store/orderStore';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validatedData = checkoutRequestSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error },
        { status: 400 }
      );
    }

    const { variantId, customData } = validatedData.data;
    const timeSlots = [
      customData.firstSlot?.date,
      customData.secondSlot?.date
    ].filter(Boolean) as string[];
    
    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          store_id: process.env.LEMONSQUEEZY_STORE_ID,
          variant_id: variantId,
          product_options: {
            redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
          },
          checkout_data: {
            email: customData.userEmail,
            name: customData.userName
          }
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: process.env.LEMONSQUEEZY_STORE_ID
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: variantId
            }
          },
          
        }
      }
    };

    const response = await axios.post(
      'https://api.lemonsqueezy.com/v1/checkouts',
      checkoutData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    const orderId = response.data.data.id;
    const identifierId = response.data.data.attributes.identifier;

    // Store with time slots
    storeOrderId('1', orderId, timeSlots);

    // Store everything in a single table
    try {
      const result = await updatePaymentStatus(
        orderId,
        PaymentStatus.PENDING,
        {
          identifier_id: identifierId
        }
      );
      
      if (!result.success) {
        logger.warn({
          flow: 'checkout',
          stage: 'db_warning',
          orderId,
          error: result.error
        }, '⚠️ No se pudo actualizar el estado del pago, pero se continuará con el checkout');
      } else if (result.literalValue || result.minimal) {
        logger.info({
          flow: 'checkout',
          stage: 'db_fallback',
          orderId,
          literalValue: result.literalValue,
          minimal: result.minimal
        }, '⚠️ Se usó un método alternativo para el registro del pago, pero se continuará con el checkout');
      }
    } catch (dbError) {
      logger.error({
        flow: 'checkout',
        stage: 'db_error',
        orderId,
        error: dbError
      }, '⚠️ Error updating payment status, but continuing with checkout');
    }

    logger.info({
      flow: 'checkout',
      stage: 'created',
      orderId,
      timestamp: new Date().toISOString(),
      checkoutUrl: response.data.data.attributes.url
    }, '🛒 Checkout created with LemonSqueezy');

    logger.info({
      flow: 'checkout',
      stage: 'initialized',
      orderId,
      initialStatus: PaymentStatus.PENDING
    }, '💳 Payment tracking initialized');

    logger.info({
      flow: 'checkout',
      stage: 'stored_order_id',
      orderId
    }, '💾 OrderId guardado en el store global');

    return NextResponse.json({
      checkoutUrl: response.data.data.attributes.url,
      orderId,
      expiresIn: TIMEOUT_MINUTES * 60,
      customData: validatedData.data.customData
    });

  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('LemonSqueezy error:', error.response?.data);
      return NextResponse.json(
        { 
          error: 'Checkout creation failed',
          details: error.response?.data 
        },
        { status: error.response?.status || 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}