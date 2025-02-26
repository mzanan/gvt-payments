import { supabase } from '@/db/client';
import { logger } from '@/lib/logger';

interface PaymentMapping {
  internal_order_id: string;
  lemon_squeezy_id: string;
  lemon_squeezy_identifier?: string;
}

export async function createPaymentMapping(mapping: PaymentMapping) {
  try {
    logger.info({
      flow: 'db_operation',
      operation: 'createPaymentMapping',
      stage: 'initiated',
      mapping
    }, '🔄 Creando mapeo de pago');

    const { data, error } = await supabase
      .from('payments_mapping')
      .insert([mapping])
      .select();

    if (error) {
      logger.error({
        flow: 'db_operation',
        operation: 'createPaymentMapping',
        stage: 'error',
        mapping,
        error
      }, '❌ Error al crear mapeo de pago');
      throw error;
    }

    logger.info({
      flow: 'db_operation',
      operation: 'createPaymentMapping',
      stage: 'success',
      mapping
    }, '✅ Mapeo de pago creado correctamente');

    return data[0];
  } catch (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'createPaymentMapping',
      stage: 'exception',
      mapping,
      error
    }, '💥 Excepción en createPaymentMapping');
    throw error;
  }
}

export async function getInternalOrderId(lemonSqueezyId: string): Promise<string | null> {
  try {
    logger.info({
      flow: 'db_operation',
      operation: 'getInternalOrderId',
      stage: 'initiated',
      lemonSqueezyId
    }, '🔍 Buscando orderId interno por lemonSqueezyId');

    const { data, error } = await supabase
      .from('payments_mapping')
      .select('internal_order_id')
      .eq('lemon_squeezy_id', lemonSqueezyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No encontrado
        logger.warn({
          flow: 'db_operation',
          operation: 'getInternalOrderId',
          stage: 'not_found',
          lemonSqueezyId
        }, '⚠️ No se encontró mapeo para lemonSqueezyId');
        return null;
      }
      
      logger.error({
        flow: 'db_operation',
        operation: 'getInternalOrderId',
        stage: 'error',
        lemonSqueezyId,
        error
      }, '❌ Error al buscar orderId interno');
      throw error;
    }

    logger.info({
      flow: 'db_operation',
      operation: 'getInternalOrderId',
      stage: 'success',
      lemonSqueezyId,
      internalOrderId: data.internal_order_id
    }, '✅ OrderId interno encontrado');

    return data.internal_order_id;
  } catch (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'getInternalOrderId',
      stage: 'exception',
      lemonSqueezyId,
      error
    }, '💥 Excepción en getInternalOrderId');
    throw error;
  }
} 