import { z } from 'zod';

// Checkout Request Schema
export const checkoutRequestSchema = z.object({
  variantId: z.string().or(z.number()),
  customData: z.object({
    userEmail: z.string().email(),
    userName: z.string(),
    frequency: z.enum(['once', 'weekly', 'twice-weekly']),
    duration: z.string(),
    firstSlot: z.object({
      date: z.string().datetime()
    }).nullable(),
    secondSlot: z.object({
      date: z.string().datetime()
    }).nullable(),
  }),
  test_mode: z.boolean().optional(),
  preview: z.boolean().optional()
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

// Webhook Event Types
export const webhookEventSchema = z.object({
  meta: z.object({
    event_name: z.enum([
      'order_created',
      'order_refunded',
      'subscription_created',
      'subscription_updated',
      'subscription_cancelled',
      'subscription_resumed',
      'subscription_expired',
      'subscription_paused',
      'subscription_unpaused',
      'subscription_payment_failed',
      'subscription_payment_success',
      'license_key_created',
      'license_key_updated',
    ]),
    custom_data: z.record(z.unknown()).optional(),
  }),
  data: z.object({
    id: z.string(),
    type: z.string(),
    attributes: z.record(z.unknown()),
    relationships: z.record(z.unknown()).optional(),
  }),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

// Error Types
export class PaymentServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'PaymentServiceError';
  }
}