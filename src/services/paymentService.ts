import axios from 'axios';
import { getToken } from '@/lib/auth';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

interface CheckoutParams {
  variantId: string | number;
  email?: string;
  name?: string;
  customData?: Record<string, unknown>;
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Creates a checkout session with the payment provider
 * @param params - Checkout parameters
 * @returns Checkout URL for redirection
 */
export const createCheckout = async (params: CheckoutParams) => {
  try {
    // Get authentication token
    const token = await getToken();
    
    logger.info({
      flow: 'payment',
      operation: 'createCheckout',
      variantId: params.variantId
    }, '🛒 Creating checkout session');
    
    // Call checkout API
    const response = await axios.post(
      `${env.NEXT_PUBLIC_APP_URL}/api/checkout`,
      params,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Verify we got a valid URL in the response
    const checkoutUrl = response.data?.data?.attributes?.url;
    
    if (!checkoutUrl || typeof checkoutUrl !== 'string' || !checkoutUrl.startsWith('http')) {
      logger.error({
        flow: 'payment',
        operation: 'createCheckout',
        error: 'invalidUrl',
        responseStructure: JSON.stringify(response.data)
      }, 'Invalid checkout URL received from server');
      throw new Error('Invalid checkout URL received from server');
    }

    logger.info({
      flow: 'payment',
      operation: 'createCheckout',
      status: 'success'
    }, 'Checkout created successfully');
    
    return {
      checkoutUrl,
      orderId: response.data?.data?.id
    };
  } catch (error) {
    // Only log critical errors
    logger.error({
      flow: 'payment',
      operation: 'createCheckout',
      error: error instanceof Error ? error.message : String(error),
      variantId: params.variantId
    }, 'Error creating checkout');
    
    throw error;
  }
};