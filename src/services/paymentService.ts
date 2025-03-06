import axios from 'axios';
import { getToken } from '@/lib/auth';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

// Crear una instancia reutilizable de axios con configuración optimizada
const apiClient = axios.create({
  timeout: 10000, // 10 segundos de timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Función de reintento con backoff exponencial
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 300
): Promise<T> {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      
      if (retries > maxRetries) {
        throw error;
      }
      
      // Solo reintentar en errores de red o 5xx
      const isNetworkError = !axios.isAxiosError(error) || !error.response;
      const isServerError = axios.isAxiosError(error) && 
                           error.response && 
                           error.response.status >= 500;
      
      if (!isNetworkError && !isServerError) {
        throw error;
      }
      
      // Backoff exponencial con jitter para evitar tormentas de reintentos
      const delay = baseDelay * Math.pow(2, retries - 1) + Math.random() * 100;
      
      logger.warn({
        flow: 'payment',
        operation: 'retryWithBackoff',
        retryCount: retries,
        maxRetries,
        delay,
        error: error instanceof Error ? error.message : String(error)
      }, `Reintentando operación (intento ${retries}/${maxRetries}) en ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

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
    
    // Call checkout API with retry logic
    const response = await retryWithBackoff(() => 
      apiClient.post(
        `${env.NEXT_PUBLIC_APP_URL}/api/checkout`,
        params,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
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