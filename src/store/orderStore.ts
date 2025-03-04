/**
 * In-memory store for order-related data
 * Used to maintain state across API requests
 */

import { logger } from '@/lib/logger';

interface OrderData {
  orderId: string;
  userId?: string;
  timeSlots?: string[];
  createdAt: Date;
}

// In-memory storage for order data
const orderStore = new Map<string, OrderData>();

/**
 * Stores an order ID with optional user ID and time slots
 * 
 * @param orderId - LemonSqueezy order ID
 * @param timeSlots - Optional array of time slot dates
 * @param userId - Optional user ID
 */
export function storeOrderId(orderId: string, timeSlots?: string[] | string, userId?: string) {
  // Handle legacy signature where timeSlots could be a string (userId)
  let slots: string[] | undefined;
  let user = userId;
  
  if (typeof timeSlots === 'string') {
    // Legacy usage where second param was userId
    user = timeSlots;
    slots = undefined;
  } else {
    // New usage where second param is array of time slots
    slots = timeSlots;
  }
  
  const orderData: OrderData = {
    orderId,
    userId: user,
    timeSlots: slots,
    createdAt: new Date()
  };
  
  orderStore.set(orderId, orderData);
  
  logger.info({
    flow: 'store',
    operation: 'storeOrderId',
    orderId,
    userId: user,
    hasTimeSlots: Boolean(slots && slots.length)
  }, '💾 Order ID stored in global store');
}

/**
 * Retrieves order data by order ID
 * 
 * @param orderId - LemonSqueezy order ID
 * @returns Order data or undefined if not found
 */
export function getOrderData(orderId: string): OrderData | undefined {
  return orderStore.get(orderId);
}

/**
 * Removes order data by order ID
 * 
 * @param orderId - LemonSqueezy order ID
 * @returns true if the order was found and deleted, false otherwise
 */
export function removeOrderData(orderId: string): boolean {
  return orderStore.delete(orderId);
}

/**
 * Retrieves order ID by LemonSqueezy ID (legacy support)
 * @deprecated Use getOrderData instead
 */
export function getOrderId(lemonSqueezyId: string): string | undefined {
  const data = orderStore.get(lemonSqueezyId);
  return data?.orderId;
}

/**
 * Cleans up old entries from the store
 * 
 * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 */
export function cleanupOldEntries(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  
  for (const [orderId, data] of orderStore.entries()) {
    const age = now - data.createdAt.getTime();
    
    if (age > maxAgeMs) {
      orderStore.delete(orderId);
      
      logger.debug({
        flow: 'store',
        operation: 'cleanupOldEntries',
        orderId,
        age: Math.round(age / 1000 / 60) + ' minutes'
      }, '🧹 Removed old order data from store');
    }
  }
}