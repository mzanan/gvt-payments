import { supabase } from '../client';
import { logger } from '@/lib/logger';
import { queryCache } from '@/utils/cache';

/**
 * Get payment details by order ID
 * Implements caching to reduce database calls
 * 
 * @param orderId - The unique order identifier
 * @returns The payment record or null if not found
 */
export async function getPaymentByOrderId(orderId: string) {
  // Generate a cache key for this query
  const cacheKey = `payment:${orderId}`;
  
  // Try to get from cache first
  const cachedPayment = queryCache.get(cacheKey);
  if (cachedPayment) {
    logger.debug({
      flow: 'db_operation',
      operation: 'getPaymentByOrderId',
      stage: 'cache_hit',
      orderId
    }, '🔍 Payment found in cache');
    return cachedPayment;
  }

  // If not in cache, query the database
  logger.info({
    flow: 'db_operation',
    operation: 'getPaymentByOrderId',
    stage: 'initiated',
    orderId
  }, '🔍 Querying payment by order ID');

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No record found
      logger.warn({
        flow: 'db_operation',
        operation: 'getPaymentByOrderId',
        stage: 'not_found',
        orderId
      }, '⚠️ Payment not found');
      return null;
    }

    logger.error({
      flow: 'db_operation',
      operation: 'getPaymentByOrderId',
      stage: 'error',
      orderId,
      error
    }, '❌ Error fetching payment');
    throw new Error(`Error fetching payment: ${error.message}`);
  }

  // Store in cache for future queries
  queryCache.set(cacheKey, data, 60); // Cache for 60 seconds

  logger.info({
    flow: 'db_operation',
    operation: 'getPaymentByOrderId',
    stage: 'completed',
    orderId
  }, '✅ Payment retrieved');

  return data;
}

/**
 * List payments with optional filters and pagination
 * 
 * @param filters - Optional filters for the query
 * @param page - Page number for pagination (starting from 1)
 * @param pageSize - Number of items per page
 * @returns Object containing payment records and pagination info
 */
export async function listPayments({
  filters = {},
  page = 1,
  pageSize = 20
}: {
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
}) {
  logger.info({
    flow: 'db_operation',
    operation: 'listPayments',
    stage: 'initiated',
    filters,
    page,
    pageSize
  }, '📋 Listing payments');

  // Calculate offset based on page and pageSize
  const offset = (page - 1) * pageSize;

  // Start building the query
  let query = supabase
    .from('payments')
    .select('*', { count: 'exact' });

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value);
    }
  });

  // Apply pagination
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  // Execute the query
  const { data, error, count } = await query;

  if (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'listPayments',
      stage: 'error',
      filters,
      page,
      pageSize,
      error
    }, '❌ Error listing payments');
    throw new Error(`Error listing payments: ${error.message}`);
  }

  logger.info({
    flow: 'db_operation',
    operation: 'listPayments',
    stage: 'completed',
    count: count || 0
  }, '✅ Payments listed');

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: count || 0,
      totalPages: count ? Math.ceil(count / pageSize) : 0
    }
  };
} 