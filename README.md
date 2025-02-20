# GVT Payments Service

A secure payment microservice built with Next.js 15 and LemonSqueezy.

## Features

- 🔒 Secure payment processing with LemonSqueezy
- ✅ Request validation using Zod
- 📝 Comprehensive logging
- 🔍 Type-safe webhook handling
- 🚀 Easy integration with any application

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in `.env`:
```env
LEMONSQUEEZY_API_KEY=your_api_key
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret
JWT_SECRET=your_jwt_secret
ALLOWED_ORIGINS=https://your-app.com
```

## API Reference

### POST /api/checkout

Creates a new checkout session.

**Request Body:**
```typescript
{
  variantId: number | string;
  customData?: Record<string, unknown>;
  checkoutOptions?: {
    dark?: boolean;
    media?: boolean;
    logo?: string;
    buttonColor?: string;
  };
}
```

**Response:**
```typescript
{
  data: {
    id: string;
    attributes: {
      url: string;
      // ... other checkout attributes
    };
  };
}
```

### Webhook Events

The service handles webhook events at `/api/payments/webhook`. Configure this endpoint in your LemonSqueezy dashboard:

The service handles the following webhook events:
- `order_created`
- `order_refunded`
- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_resumed`
- `subscription_expired`
- `subscription_paused`
- `subscription_unpaused`
- `subscription_payment_failed`
- `subscription_payment_success`
- `license_key_created`
- `license_key_updated`

## Error Handling

All API endpoints return standardized error responses:

```typescript
{
  error: string;
  code: string;
}
```

Common error codes:
- `INVALID_REQUEST`: Request validation failed
- `INVALID_SIGNATURE`: Invalid webhook signature
- `INTERNAL_SERVER_ERROR`: Unexpected server error

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm run start
```

## Logging

The service uses Pino for logging. In development, logs are pretty-printed to the console. In production, they are in JSON format for better integration with logging services.

## Security

- All API routes are protected with JWT authentication
- Webhook endpoints verify LemonSqueezy signatures
- Request validation prevents invalid data
- Environment variables for sensitive data
