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

// Webhook Event Schema
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
    attributes: z.object({
      // Common fields - Make these optional since not all events include them
      product_id: z.union([z.string(), z.number()]).optional(),
      store_id: z.union([z.string(), z.number()]).optional(),
      customer_id: z.union([z.string(), z.number()]).optional(),
      user_id: z.union([z.string(), z.number()]).optional(),
      variant_id: z.union([z.string(), z.number()]).optional(),
      identifier: z.string().optional(),
      status: z.string().optional(),
      
      // Order fields
      order_number: z.number().optional(),
      total: z.number().optional(),
      currency: z.string().optional(),
      billing: z.object({
        email: z.string(),
        name: z.string().optional(),
        country: z.string().optional()
      }).optional(),
      
      // Subscription fields
      renews_at: z.string().datetime().nullable().optional(),
      cancelled_at: z.string().datetime().nullable().optional(),
      pause_starts_at: z.string().datetime().nullable().optional(),
      pause_resumes_at: z.string().datetime().nullable().optional(),
      ends_at: z.string().datetime().nullable().optional(),
      trial_ends_at: z.string().datetime().nullable().optional(),
      
      // Payment fields
      card_brand: z.string().optional(),
      card_last_four: z.string().optional(),
      payment_method: z.string().optional(),
      test_mode: z.boolean().optional(),
    }),
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