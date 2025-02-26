export const orderIdStore: { 
    [lemonSqueezyId: string]: {
      orderId: string;
      timestamp: number;
    }
  } = {};
  
  export function storeOrderId(lemonSqueezyId: string, orderId: string) {
    orderIdStore[lemonSqueezyId] = {
      orderId,
      timestamp: Date.now()
    };
  }
  
  export function getOrderId(lemonSqueezyId: string) {
    return orderIdStore[lemonSqueezyId]?.orderId;
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