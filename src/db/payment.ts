import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { PaymentStatus } from '@/types/payment';
import { memoize } from '@/utils/memoize';

// Inicializar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Tipo para las entradas del caché
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache de pagos en memoria con TTL de 30 segundos
const paymentStatusCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30 * 1000; // 30 segundos

// Función para limpiar entradas antiguas del caché
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, entry] of paymentStatusCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      paymentStatusCache.delete(key);
    }
  }
};

// Configurar limpieza periódica del caché
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 60 * 1000); // Limpiar cada minuto
}

export async function getPaymentStatus(orderId: string) {
  logger.info({
    flow: 'db_operation',
    operation: 'getPaymentStatus',
    stage: 'initiated',
    orderId
  }, '🔍 Buscando estado de pago');

  // Verificar caché
  const cacheKey = `payment_status_${orderId}`;
  const cachedEntry = paymentStatusCache.get(cacheKey);
  
  if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
    logger.info({
      flow: 'db_operation',
      operation: 'getPaymentStatus',
      stage: 'cache_hit',
      orderId
    }, '🚀 Usando datos en caché para el estado de pago');
    
    return cachedEntry.data;
  }

  const { data, error } = await supabase
    .from('payments_status')
    .select('*')
    .eq('order_id', orderId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No se encontró ningún registro
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
    }, '❌ Error al buscar estado de pago');
    throw error;
  }

  logger.info({
    flow: 'db_operation',
    operation: 'getPaymentStatus',
    stage: 'found',
    orderId,
    status: data.status
  }, '✅ Estado de pago encontrado');

  // Almacenar en caché
  paymentStatusCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
}

/**
 * Actualiza el estado de un pago en la base de datos
 */
export async function updatePaymentStatus(
  orderId: string, 
  status: PaymentStatus,
  additionalIds?: {
    numeric_id?: string | number;
    identifier_id?: string;
  }
) {
  logger.info({
    flow: 'db_operation',
    operation: 'updatePaymentStatus',
    stage: 'initiated',
    orderId,
    status,
    additionalIds
  }, '🔄 Actualizando estado de pago');

  try {
    // Verificar que el estado es uno de los permitidos
    if (!Object.values(PaymentStatus).includes(status)) {
      logger.warn({
        flow: 'db_operation',
        operation: 'updatePaymentStatus',
        stage: 'invalid_status',
        orderId,
        status
      }, '⚠️ Estado de pago inválido, usando PENDING como fallback');
      
      // Usar PENDING como estado por defecto si el valor proporcionado no es válido
      status = PaymentStatus.PENDING;
    }

    // Comprobar si ya existe un registro para esta orden
    const { data: existingRecord } = await supabase
      .from('payments_status')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (existingRecord) {
      // Actualizar registro existente
      const { error } = await supabase
        .from('payments_status')
        .update({ 
          status: String(status),
          updated_at: new Date(),
          numeric_id: additionalIds?.numeric_id || existingRecord.numeric_id,
          identifier_id: additionalIds?.identifier_id || existingRecord.identifier_id
        })
        .eq('order_id', orderId);

      if (error) {
        logger.error({
          flow: 'db_operation',
          operation: 'updatePaymentStatus',
          stage: 'update_error',
          orderId,
          status,
          statusType: typeof status,
          statusValue: String(status),
          error
        }, '❌ Error al actualizar estado de pago');
        
        // Registramos el error pero no lo lanzamos para permitir que el flujo continúe
        return { success: false, error };
      }

      // Invalidar caché después de actualizar
      const cacheKey = `payment_status_${orderId}`;
      paymentStatusCache.delete(cacheKey);
      
      // También limpiar caché de la función memoizada
      // Convierte a unknown primero para evitar errores de tipo
      const memoizedFn = findPaymentByOrderId as unknown;
      if (typeof (memoizedFn as { clearCache?: () => void }).clearCache === 'function') {
        (memoizedFn as { clearCache: () => void }).clearCache();
      }

      logger.info({
        flow: 'db_operation',
        operation: 'updatePaymentStatus',
        stage: 'updated',
        orderId,
        status
      }, '✅ Estado de pago actualizado con éxito');
      
      return { success: true };
    } else {
      // Intentar insertar nuevo registro
      const { error } = await supabase
        .from('payments_status')
        .insert({
          order_id: orderId,
          status: String(status),
          created_at: new Date(),
          updated_at: new Date(),
          numeric_id: additionalIds?.numeric_id || null,
          identifier_id: additionalIds?.identifier_id || null
        });

      if (error) {
        logger.error({
          flow: 'db_operation',
          operation: 'updatePaymentStatus',
          stage: 'insert_error',
          orderId,
          status,
          statusType: typeof status,
          statusValue: String(status),
          error
        }, '❌ Error al insertar estado de pago');
        
        // Intento directo con valor literal para diagnóstico
        if (error.code === '23514') {
          logger.warn({
            flow: 'db_operation',
            operation: 'updatePaymentStatus',
            stage: 'trying_literal',
            orderId
          }, '🔄 Intentando con valor literal "PENDING"');
          
          const { error: literalError } = await supabase
            .from('payments_status')
            .insert({
              order_id: orderId,
              status: 'PENDING',
              created_at: new Date(),
              updated_at: new Date(),
              numeric_id: additionalIds?.numeric_id || null,
              identifier_id: additionalIds?.identifier_id || null
            });
            
          if (!literalError) {
            logger.info({
              flow: 'db_operation',
              operation: 'updatePaymentStatus',
              stage: 'literal_success',
              orderId
            }, '✅ El valor literal "PENDING" funcionó correctamente');
            
            return { 
              success: true, 
              literalValue: true
            };
          } else {
            logger.error({
              flow: 'db_operation',
              operation: 'updatePaymentStatus',
              stage: 'literal_failed',
              orderId,
              error: literalError
            }, '❌ Incluso el valor literal "PENDING" falló');
            
            // En este punto, probablemente haya otra restricción o problema
            // Vamos a intentar una inserción sin algunos campos para ver si eso ayuda
            const { error: minimalError } = await supabase
              .from('payments_status')
              .insert({
                order_id: orderId,
                status: 'PENDING'
              });
              
            if (!minimalError) {
              logger.info({
                flow: 'db_operation',
                operation: 'updatePaymentStatus',
                stage: 'minimal_success',
                orderId
              }, '✅ La inserción mínima funcionó, el problema podría estar en otros campos');
              
              return { success: true, minimal: true };
            } else {
              logger.error({
                flow: 'db_operation',
                operation: 'updatePaymentStatus',
                stage: 'minimal_failed',
                orderId,
                error: minimalError
              }, '❌ La inserción mínima también falló');
            }
          }
        }
        
        return { success: false, error };
      }

      logger.info({
        flow: 'db_operation',
        operation: 'updatePaymentStatus',
        stage: 'inserted',
        orderId,
        status
      }, '✅ Estado de pago insertado con éxito');
      
      return { success: true };
    }
  } catch (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'updatePaymentStatus',
      stage: 'exception',
      orderId,
      status,
      error
    }, '💥 Exception in updatePaymentStatus');
    
    return { success: false, error };
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

/**
 * Busca pagos pendientes en la base de datos
 * Útil para asociar webhooks que llegan sin una referencia clara al order_id original
 */
export async function findPendingPayments() {
  try {
    logger.info({
      flow: 'db_operation',
      operation: 'findPendingPayments',
      stage: 'initiated'
    }, '🔍 Buscando pagos pendientes');

    const { data, error } = await supabase
      .from('payments_status')
      .select('*')
      .eq('status', 'PENDING')
      .is('numeric_id', null)  // Solo aquellos que aún no tienen numeric_id
      .order('created_at', { ascending: false })
      .limit(5);  // Limitamos a los 5 más recientes para reducir falsos positivos

    if (error) {
      logger.error({
        flow: 'db_operation',
        operation: 'findPendingPayments',
        stage: 'error',
        error
      }, '❌ Error al buscar pagos pendientes');
      throw error;
    }

    if (!data || data.length === 0) {
      logger.warn({
        flow: 'db_operation',
        operation: 'findPendingPayments',
        stage: 'not_found'
      }, '⚠️ No se encontraron pagos pendientes sin numeric_id');
      return [];
    }

    logger.info({
      flow: 'db_operation',
      operation: 'findPendingPayments',
      stage: 'success',
      count: data.length
    }, `✅ Se encontraron ${data.length} pagos pendientes`);

    return data;
  } catch (error) {
    logger.error({
      flow: 'db_operation',
      operation: 'findPendingPayments',
      stage: 'exception',
      error
    }, '💥 Excepción en findPendingPayments');
    throw error;
  }
}

// Versión memoizada de findPaymentByOrderId para evitar consultas repetidas
export const findPaymentByOrderId = memoize(async (orderId: string) => {
  logger.info({
    flow: 'db_operation',
    operation: 'findPaymentByOrderId',
    stage: 'initiated',
    orderId
  }, '🔍 Buscando pago por ID de orden');

  const { data, error } = await supabase
    .from('payments_status')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No record found - not an error for this function
      logger.info({
        flow: 'db_operation',
        operation: 'findPaymentByOrderId',
        stage: 'not_found',
        orderId
      }, '⚪ No se encontró ningún pago');
      return null;
    }

    logger.error({
      flow: 'db_operation',
      operation: 'findPaymentByOrderId',
      stage: 'error',
      orderId,
      error
    }, '❌ Error al buscar pago por ID de orden');
    throw error;
  }

  logger.info({
    flow: 'db_operation',
    operation: 'findPaymentByOrderId',
    stage: 'success',
    orderId
  }, '✅ Pago encontrado por ID de orden');

  return data;
}, (orderId: string) => `payment_${orderId}`);
