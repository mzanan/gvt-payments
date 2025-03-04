import { supabase } from '../client';
import { logger } from '@/lib/logger';

/**
 * Updates a payment record with new data
 * @param orderId - The unique order identifier
 * @param updateData - The data to update
 * @returns The updated payment record
 */
export async function updatePayment(
  orderId: string,
  updateData: Record<string, unknown>
) {
  logger.info({
    flow: 'db_operation',
    operation: 'updatePayment',
    stage: 'initiated',
    orderId
  }, '🔄 Updating payment record');

  const { data, error } = await supabase
    .from('payments')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('order_id', orderId)
    .select()
    .single();

  if (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'updatePayment',
      stage: 'error',
      orderId,
      error
    }, '❌ Error updating payment record');
    throw new Error(`Error updating payment: ${error.message}`);
  }

  logger.info({
    flow: 'db_operation',
    operation: 'updatePayment',
    stage: 'completed',
    orderId
  }, '✅ Payment record updated');

  return data;
}

/**
 * Updates payment metadata for a given order
 * @param orderId - The unique order identifier
 * @param metadata - The metadata to update
 * @returns The updated payment record
 */
export async function updatePaymentMetadata(
  orderId: string,
  metadata: Record<string, unknown>
) {
  logger.info({
    flow: 'db_operation',
    operation: 'updatePaymentMetadata',
    stage: 'initiated',
    orderId
  }, '📝 Updating payment metadata');

  // First, get the current metadata
  const { data: existingData, error: fetchError } = await supabase
    .from('payments')
    .select('metadata')
    .eq('order_id', orderId)
    .single();

  if (fetchError) {
    logger.error({
      flow: 'db_operation',
      operation: 'updatePaymentMetadata',
      stage: 'fetch_error',
      orderId,
      error: fetchError
    }, '❌ Error fetching existing metadata');
    throw new Error(`Error fetching existing metadata: ${fetchError.message}`);
  }

  // Merge the existing metadata with the new metadata
  const mergedMetadata = {
    ...(existingData.metadata || {}),
    ...metadata
  };

  // Update the record with the merged metadata
  const { data, error } = await supabase
    .from('payments')
    .update({
      metadata: mergedMetadata,
      updated_at: new Date().toISOString()
    })
    .eq('order_id', orderId)
    .select()
    .single();

  if (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'updatePaymentMetadata',
      stage: 'update_error',
      orderId,
      error
    }, '❌ Error updating payment metadata');
    throw new Error(`Error updating payment metadata: ${error.message}`);
  }

  logger.info({
    flow: 'db_operation',
    operation: 'updatePaymentMetadata',
    stage: 'completed',
    orderId
  }, '✅ Payment metadata updated');

  return data;
} 