/**
 * Environment variables validation and configuration
 * Ensures all required environment variables are present and valid
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

// Define schema for environment variables
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // App configuration
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid app URL'),
  
  // Database configuration
  SUPABASE_URL: z.string().url('Supabase URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  
  // Payment provider (LemonSqueezy)
  LEMONSQUEEZY_API_KEY: z.string().min(1, 'LemonSqueezy API key is required'),
  LEMONSQUEEZY_STORE_ID: z.string().min(1, 'LemonSqueezy store ID is required'),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().min(1, 'LemonSqueezy webhook secret is required'),
  
  // JWT configuration - Enforce length only in production
  JWT_SECRET: z.string().min(1, 'JWT secret is required'),
  JWT_EXPIRY: z.string().regex(/^\d+[smhd]$/, 'JWT expiry must be in format like 24h, 60m').default('24h'),
  
  // Client authentication
  ALLOWED_CLIENT_ID: z.string().min(1, 'Allowed client ID is required'),
  ALLOWED_CLIENT_SECRET: z.string().min(1, 'Allowed client secret is required'),
});

// Process.env has a different type definition than our schema
type Env = z.infer<typeof envSchema>;
type ProcessEnv = typeof process.env;

// Force cast process.env to match our schema type
const processEnv = process.env as unknown as ProcessEnv & Env;

/**
 * Validates all environment variables against the schema
 * @returns The validated environment variables
 * @throws Error if validation fails
 */
function validateEnv(): Env {
  try {
    const result = envSchema.safeParse(processEnv);
    
    if (!result.success) {
      // Format validation errors
      const formattedErrors = result.error.format();
      
      // Safely extract error messages from the Zod error format
      const errorMessages = Object.entries(formattedErrors)
        .filter(([key]) => key !== '_errors')
        .map(([key, value]) => {
          // Handle both possible formats of the error value
          const errorList = '_errors' in value && Array.isArray(value._errors)
            ? value._errors
            : Array.isArray(value) ? value : ['Invalid value'];
          
          return `${key}: ${errorList.join(', ')}`;
        })
        .join('\n');
      
      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }
    
    return result.data;
  } catch (error) {
    logger.fatal({ error }, '❌ Environment validation failed');
    throw error;
  }
}

/**
 * Safe access to validated environment variables
 */
export const env = validateEnv();

// Make env immutable to prevent accidental changes
Object.freeze(env); 