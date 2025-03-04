/**
 * Validation functions for checkout API requests
 * Extracts validation logic from main route handler for better separation of concerns
 */

import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { checkoutRequestSchema } from '@/types/lemonsqueezy';

/**
 * Validates a checkout request
 * @param body - The request body to validate
 * @returns Success result with validated data or error response
 */
export function validateCheckoutRequest(body: unknown) {
  try {
    // Parse and validate request data
    const validationResult = checkoutRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      logger.warn({
        flow: 'api_validation',
        operation: 'validateCheckoutRequest',
        errors: validationResult.error.format()
      }, '⚠️ Invalid checkout request data');
      
      return {
        success: false,
        response: NextResponse.json(
          { 
            error: 'Invalid request data', 
            details: validationResult.error.format() 
          },
          { status: 400 }
        )
      };
    }
    
    // Additional custom validations can go here
    const { variantId, customData } = validationResult.data;
    
    if (!variantId) {
      logger.warn({
        flow: 'api_validation',
        operation: 'validateCheckoutRequest',
        error: 'Missing variant ID'
      }, '⚠️ Missing variant ID in checkout request');
      
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Missing variant ID' },
          { status: 400 }
        )
      };
    }
    
    if (!customData.userEmail) {
      logger.warn({
        flow: 'api_validation',
        operation: 'validateCheckoutRequest',
        error: 'Missing user email'
      }, '⚠️ Missing user email in checkout request');
      
      return {
        success: false,
        response: NextResponse.json(
          { error: 'User email is required' },
          { status: 400 }
        )
      };
    }
    
    // Extract and validate time slots if present
    const timeSlots = [
      customData.firstSlot?.date,
      customData.secondSlot?.date
    ].filter(Boolean) as string[];
    
    return {
      success: true,
      data: {
        ...validationResult.data,
        timeSlots
      }
    };
  } catch (error) {
    logger.error({
      flow: 'api_validation',
      operation: 'validateCheckoutRequest',
      error
    }, '❌ Unexpected error during checkout validation');
    
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Validation error' },
        { status: 500 }
      )
    };
  }
}

/**
 * Validates environment variables required for checkout
 * @returns Success result or error response
 */
export function validateCheckoutEnvironment() {
  try {
    const requiredEnvVars = [
      'LEMONSQUEEZY_API_KEY',
      'LEMONSQUEEZY_STORE_ID',
      'NEXT_PUBLIC_APP_URL',
    ];
    
    const missingVars = requiredEnvVars.filter(
      varName => !process.env[varName]
    );
    
    if (missingVars.length > 0) {
      logger.error({
        flow: 'api_validation',
        operation: 'validateCheckoutEnvironment',
        missingVars
      }, '❌ Missing required environment variables');
      
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        )
      };
    }
    
    return { success: true };
  } catch (error) {
    logger.error({
      flow: 'api_validation',
      operation: 'validateCheckoutEnvironment',
      error
    }, '❌ Error validating checkout environment');
    
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    };
  }
} 