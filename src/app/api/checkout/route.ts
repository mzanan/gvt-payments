/**
 * Checkout API endpoint handler
 * Implements best practices for API design and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { updatePaymentStatus } from '@/db/payments/status';
import { PaymentStatus } from '@/types/payment';
import { storeOrderId } from '@/store/orderStore';
import { logger } from '@/lib/logger';
import { validateCheckoutRequest, validateCheckoutEnvironment } from './validators';
import { env } from '@/config/env';

/**
 * Handles POST requests to create a checkout session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { variantId, customData } = body;

    // Check for required fields
    if (!variantId) {
      logger.warn({
        flow: 'checkout',
        operation: 'createCheckout',
        error: 'missing_variant_id'
      }, 'Missing variant ID in checkout request');
      
      return NextResponse.json(
        { error: 'variantId is required' },
        { status: 400 }
      );
    }

    logger.info({
      flow: 'checkout',
      operation: 'createCheckout',
      variantId
    }, 'Creating checkout');

    // Validate environment variables
    const envValidation = validateCheckoutEnvironment();
    if (!envValidation.success) {
      return envValidation.response;
    }

    // Validate request data
    const validation = validateCheckoutRequest(body);
    if (!validation.success) {
      return validation.response;
    }

    // Destructure validated data
    if (!validation.data) {
      logger.error({
        flow: 'checkout',
        operation: 'createCheckout',
        stage: 'validation',
        error: 'Missing validated data'
      }, '❌ Validation data is missing');
      
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { timeSlots } = validation.data;
    
    // Prepare checkout data for LemonSqueezy
    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          store_id: env.LEMONSQUEEZY_STORE_ID,
          variant_id: variantId,
          product_options: {
            redirect_url: `${env.NEXT_PUBLIC_APP_URL}/payment/success`,
          },
          checkout_data: {
            email: customData.userEmail
          }
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: env.LEMONSQUEEZY_STORE_ID
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: String(variantId)
            }
          }
        }
      }
    };

    // Call LemonSqueezy API
    const response = await axios.post(
      'https://api.lemonsqueezy.com/v1/checkouts',
      checkoutData,
      {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${env.LEMONSQUEEZY_API_KEY}`
        }
      }
    );

    // Extract checkout URL and order ID
    const checkoutUrl = response.data?.data?.attributes?.url;
    const orderId = response.data?.data?.id;

    if (!checkoutUrl || !orderId) {
      logger.error({
        flow: 'checkout',
        operation: 'createCheckout',
        stage: 'invalidResponse',
        responseData: response.data
      }, '❌ Invalid checkout response');
      
      return NextResponse.json(
        { error: 'Failed to create checkout' },
        { status: 500 }
      );
    }

    // Store the order ID in memory for this session
    storeOrderId(orderId, timeSlots);

    // Create initial payment status record
    await updatePaymentStatus(orderId, PaymentStatus.PENDING);

    logger.info({
      flow: 'checkout',
      operation: 'createCheckout',
      status: 'success',
      orderId
    }, 'Checkout created successfully');

    // Return the response in the expected format
    return NextResponse.json({
      checkoutUrl: response.data.data.attributes.url,
      orderId,
      customData: validation.data.customData
    });

  } catch (error) {
    logger.error({
      flow: 'checkout',
      operation: 'createCheckout',
      error: error instanceof Error ? error.message : String(error)
    }, 'Error creating checkout');
    
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}