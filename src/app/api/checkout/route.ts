import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { checkoutRequestSchema } from '@/types/lemonsqueezy';

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
            name: customData.userName,
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

    return NextResponse.json(response.data);
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