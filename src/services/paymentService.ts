import axios from 'axios';
import { getToken } from '@/lib/auth';

interface CheckoutParams {
  variantId: string | number;
  email?: string;
  name?: string;
  customData?: Record<string, unknown>;
  successUrl?: string;
  cancelUrl?: string;
}

export const createCheckout = async (params: CheckoutParams) => {
  try {
    const token = await getToken();
    
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/checkout`,
      params,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.data?.data?.attributes?.url) {
      throw new Error('Invalid checkout response');
    }

    return response.data.data.attributes.url;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.error || 'Failed to create checkout';
      throw new Error(errorMessage);
    }
    throw error;
  }
};