import { supabase } from '@/db/client';
import { logger } from '@/lib/logger';
import { PaymentStatus } from '@/types/payment';

interface PaymentAdditionalIds {
  numeric_id?: string;
  identifier_id?: string;
}

export async function getPaymentStatus(orderId: string) {
  try {
    logger.info({
      flow: 'db_operation',
      operation: 'getPaymentStatus',
      stage: 'initiated',
      orderId
    }, '🔍 Buscando estado de pago');

    const { data, error } = await supabase
      .from('payments_status')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No encontrado
        logger.warn({
          flow: 'db_operation',
          operation: 'getPaymentStatus',
          stage: 'not_found',
          orderId
        }, '⚠️ Estado de pago no encontrado');
        return null;
      }
      
      logger.error({
        flow: 'db_operation',
        operation: 'getPaymentStatus',
        stage: 'error',
        orderId,
        error
      }, '❌ Error al obtener estado de pago');
      throw error;
    }

    logger.info({
      flow: 'db_operation',
      operation: 'getPaymentStatus',
      stage: 'success',
      orderId,
      status: data.status
    }, '✅ Estado de pago obtenido');

    return data;
  } catch (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'getPaymentStatus',
      stage: 'exception',
      orderId,
      error
    }, '💥 Excepción en getPaymentStatus');
    throw error;
  }
}

export async function updatePaymentStatus(
  orderId: string, 
  status: PaymentStatus,
  additionalIds?: PaymentAdditionalIds
): Promise<void> {
  try {
    logger.info({
      flow: 'db_operation',
      operation: 'updatePaymentStatus',
      stage: 'initiated',
      orderId,
      status,
      additionalIds
    }, '🔄 Actualizando estado de pago');

    // Construir el objeto de actualización
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString()
    };

    // Añadir IDs adicionales si se proporcionan
    if (additionalIds) {
      if (additionalIds.numeric_id) {
        updateData.numeric_id = additionalIds.numeric_id;
      }
      if (additionalIds.identifier_id) {
        updateData.identifier_id = additionalIds.identifier_id;
      }
    }

    // Verificar si ya existe un registro para este order_id
    const { data: existingData, error: checkError } = await supabase
      .from('payments_status')
      .select('order_id')
      .eq('order_id', orderId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error({
        flow: 'db_operation',
        operation: 'updatePaymentStatus',
        stage: 'check_existing',
        orderId,
        error: checkError
      }, '❌ Error al verificar existencia de registro');
      throw checkError;
    }

    // Si el registro existe, actualizar; si no, insertar
    if (existingData) {
      const { error } = await supabase
        .from('payments_status')
        .update(updateData)
        .eq('order_id', orderId);

      if (error) {
        logger.error({
          flow: 'db_operation',
          operation: 'updatePaymentStatus',
          stage: 'update_error',
          orderId,
          status,
          error
        }, '❌ Error al actualizar estado de pago');
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('payments_status')
        .insert([{ order_id: orderId, ...updateData }]);

      if (error) {
        logger.error({
          flow: 'db_operation',
          operation: 'updatePaymentStatus',
          stage: 'insert_error',
          orderId,
          status,
          error
        }, '❌ Error al insertar estado de pago');
        throw error;
      }
    }

    logger.info({
      flow: 'db_operation',
      operation: 'updatePaymentStatus',
      stage: 'success',
      orderId,
      status
    }, '✅ Estado de pago actualizado');

  } catch (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'updatePaymentStatus',
      stage: 'exception',
      orderId,
      status,
      error
    }, '💥 Exception in updatePaymentStatus');
    throw error;
  }
}

export async function getPaymentStatusByLemonSqueezyId(lemonSqueezyId: string) {
  try {
    logger.info({
      flow: 'db_operation',
      operation: 'getPaymentStatusByLemonSqueezyId',
      stage: 'initiated',
      lemonSqueezyId
    }, '🔍 Buscando pago por ID numérico de LemonSqueezy');

    const { data, error } = await supabase
      .from('payments_status')
      .select('*')
      .eq('numeric_id', lemonSqueezyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No encontrado
        logger.warn({
          flow: 'db_operation',
          operation: 'getPaymentStatusByLemonSqueezyId',
          stage: 'not_found',
          lemonSqueezyId
        }, '⚠️ No se encontró pago para el ID numérico de LemonSqueezy');
        return null;
      }
      
      logger.error({
        flow: 'db_operation',
        operation: 'getPaymentStatusByLemonSqueezyId',
        stage: 'error',
        lemonSqueezyId,
        error
      }, '❌ Error al buscar pago por ID de LemonSqueezy');
      throw error;
    }

    logger.info({
      flow: 'db_operation',
      operation: 'getPaymentStatusByLemonSqueezyId',
      stage: 'success',
      lemonSqueezyId,
      orderId: data.order_id,
      status: data.status
    }, '✅ Pago encontrado por ID de LemonSqueezy');

    return data;
  } catch (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'getPaymentStatusByLemonSqueezyId',
      stage: 'exception',
      lemonSqueezyId,
      error
    }, '💥 Excepción en getPaymentStatusByLemonSqueezyId');
    throw error;
  }
}
