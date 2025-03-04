import { logger } from '@/lib/logger';
import { updatePaymentStatus } from '@/db/payment';
import { PaymentStatus } from '@/types/payment';

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
    
    logger.info({
      flow: 'checkout',
      stage: 'stored_order_id',
      orderId
    }, '💾 OrderId guardado en el store global');
  }
  
  export function getOrderId(lemonSqueezyId: string) {
    const order = orderIdStore[lemonSqueezyId];
    if (!order) return null;
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