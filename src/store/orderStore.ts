import { logger } from '@/lib/logger';
import { updatePaymentStatus } from '@/db/payment';
import { PaymentStatus } from '@/types/payment';

export const TIMEOUT_MINUTES = 15;

export const orderIdStore: { 
    [lemonSqueezyId: string]: {
      orderId: string;
      timestamp: number;
      timeSlots?: string[]; // Store time slots being reserved
    }
  } = {};
  
  export function storeOrderId(lemonSqueezyId: string, orderId: string, timeSlots?: string[]) {
    orderIdStore[lemonSqueezyId] = {
      orderId,
      timestamp: Date.now(),
      timeSlots
    };

    // Set timeout to clear the reservation and update payment status
    setTimeout(async () => {
      if (orderIdStore[lemonSqueezyId]) {
        try {
          // Actualizar el estado en la base de datos
          const result = await updatePaymentStatus(orderId, PaymentStatus.TIMEOUT);
          
          // Eliminar del store independientemente del resultado de la BD
          delete orderIdStore[lemonSqueezyId];
          
          if (!result.success) {
            logger.warn({
              flow: 'reservation',
              stage: 'timeout_warning',
              orderId,
              timeSlots,
              error: result.error
            }, '⚠️ No se pudo actualizar el estado a TIMEOUT pero los slots fueron liberados');
          } else {
            logger.info({
              flow: 'reservation',
              stage: 'timeout',
              orderId,
              timeSlots,
              status: PaymentStatus.TIMEOUT
            }, '⏰ Reservation timeout - payment status updated and slots released');
          }
        } catch (error) {
          // Aún eliminamos del store para liberar los slots
          delete orderIdStore[lemonSqueezyId];
          
          logger.error({
            flow: 'reservation',
            stage: 'timeout_error',
            orderId,
            error
          }, '❌ Error updating payment status on timeout, but slots were released');
        }
      }
    }, TIMEOUT_MINUTES * 60 * 1000);
  }
  
  export function getOrderId(lemonSqueezyId: string) {
    const order = orderIdStore[lemonSqueezyId];
    if (!order) return null;

    // Check if the reservation has expired
    if (Date.now() - order.timestamp > TIMEOUT_MINUTES * 60 * 1000) {
      delete orderIdStore[lemonSqueezyId];
      return null;
    }

    return order.orderId;
  }
  
  // Optional: Clean up old entries periodically
  export function cleanupOldEntries(maxAgeMs: number = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    Object.keys(orderIdStore).forEach(key => {
      if (now - orderIdStore[key].timestamp > maxAgeMs) {
        delete orderIdStore[key];
      }
    });
  }