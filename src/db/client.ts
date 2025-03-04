/**
 * Supabase client configuration
 * Uses centralized environment validation
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

/**
 * Creates and exports a singleton Supabase client
 * Environment variables are validated through the centralized env module
 */
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
    // Global error handling
    global: {
      fetch: async (url, options) => {
        // Start timer for performance logging
        const startTime = performance.now();
        
        try {
          const response = await fetch(url, options);
          
          // Log slow queries (>500ms)
          const duration = performance.now() - startTime;
          if (duration > 500) {
            logger.warn({
              flow: 'db_operation',
              operation: 'slow_query',
              duration: Math.round(duration),
              url: typeof url === 'string' 
                ? url.split('?')[0] // Don't log query params for security
                : String(url)
            }, '⚠️ Slow Supabase query detected');
          }
          
          return response;
        } catch (error) {
          // Log fetch errors
          logger.error({
            flow: 'db_operation',
            operation: 'fetch_error',
            error,
            url: typeof url === 'string' 
              ? url.split('?')[0] 
              : String(url)
          }, '❌ Supabase fetch error');
          throw error;
        }
      }
    }
  }
);

// Log client initialization
logger.info({
  flow: 'initialization',
  operation: 'supabase_client'
}, '✅ Supabase client initialized');