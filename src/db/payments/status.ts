import { supabase } from '../client';
import { logger } from '@/lib/logger';
import { PaymentStatus } from '@/types/payment';

/**
 * Retrieves the current status of a payment by order ID
 * @param orderId - The unique order identifier
 * @returns The payment status record or null if not found
 */
export async function getPaymentStatus(orderId: string) {
  logger.info({
    flow: 'db_operation',
    operation: 'getPaymentStatus',
    stage: 'initiated',
    orderId
  }, '🔍 Searching payment status');

  const { data, error } = await supabase
    .from('payments_status')
    .select('*')
    .eq('order_id', orderId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No record found
      logger.warn({
        flow: 'db_operation',
        operation: 'getPaymentStatus',
        stage: 'not_found',
        orderId
      }, '⚠️ Payment status not found');
      return null;
    }

    logger.error({
      flow: 'db_operation',
      operation: 'getPaymentStatus',
      stage: 'error',
      orderId,
      error
    }, '❌ Error finding payment status');
    throw new Error(`Error querying payment status: ${error.message}`);
  }

  logger.info({
    flow: 'db_operation',
    operation: 'getPaymentStatus',
    stage: 'completed',
    orderId,
    status: data.status
  }, '✅ Payment status retrieved');

  return data;
}

/**
 * Updates the payment status for a given order ID
 * @param orderId - The unique order identifier
 * @param status - The new payment status
 * @param additionalIds - Optional additional identifiers
 * @returns The updated payment status record
 */
export async function updatePaymentStatus(
  orderId: string, 
  status: PaymentStatus,
  additionalIds?: { numeric_id?: string; identifier_id?: string }
) {
  logger.info({
    flow: 'db_operation',
    operation: 'updatePaymentStatus',
    stage: 'initiated',
    orderId,
    status
  }, '📝 Updating payment status');

  const updateData: Record<string, unknown> = {
    order_id: orderId,
    status,
    updated_at: new Date().toISOString(),
  };

  if (additionalIds) {
    if (additionalIds.numeric_id) updateData.numeric_id = additionalIds.numeric_id;
    if (additionalIds.identifier_id) updateData.identifier_id = additionalIds.identifier_id;
  }

  const { data, error } = await supabase
    .from('payments_status')
    .upsert(updateData, { onConflict: 'order_id' })
    .select()
    .single();

  if (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'updatePaymentStatus',
      stage: 'error',
      orderId,
      status,
      error
    }, '❌ Error updating payment status');
    throw new Error(`Error updating payment status: ${error.message}`);
  }

  logger.info({
    flow: 'db_operation',
    operation: 'updatePaymentStatus',
    stage: 'completed',
    orderId,
    status
  }, '✅ Payment status updated');

  return data;
} 