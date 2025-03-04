import { supabase } from '../client';
import { logger } from '@/lib/logger';
import { PaymentStatus } from '@/types/payment';

/**
 * Creates a new payment record in the database
 * @param paymentData - The payment data to be stored
 * @returns The created payment record
 */
export async function createPayment(paymentData: {
  order_id: string;
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  customer_email?: string;
  custom_data?: Record<string, unknown>;
}) {
  logger.info({
    flow: 'db_operation',
    operation: 'createPayment',
    stage: 'initiated',
    orderId: paymentData.order_id
  }, '➕ Creating new payment record');

  const { data, error } = await supabase
    .from('payments')
    .insert({
      ...paymentData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'createPayment',
      stage: 'error',
      orderId: paymentData.order_id,
      error
    }, '❌ Error creating payment record');
    throw new Error(`Error creating payment: ${error.message}`);
  }

  logger.info({
    flow: 'db_operation',
    operation: 'createPayment',
    stage: 'completed',
    orderId: paymentData.order_id
  }, '✅ Payment record created');

  return data;
}

/**
 * Creates initial payment status for a new order
 * @param orderId - The unique order identifier
 * @returns The created payment status record
 */
export async function createInitialPaymentStatus(orderId: string) {
  return await supabase
    .from('payments_status')
    .insert({
      order_id: orderId,
      status: PaymentStatus.PENDING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) {
        logger.error({
          flow: 'db_operation',
          operation: 'createInitialPaymentStatus',
          stage: 'error',
          orderId,
          error
        }, '❌ Error creating initial payment status');
        throw new Error(`Error creating initial payment status: ${error.message}`);
      }
      return data;
    });
} 