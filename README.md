# GVT Payments Service

A secure payment microservice built with Next.js 15, LemonSqueezy, and Supabase.

## Features

- 🔒 Secure payment processing with LemonSqueezy
- 📦 Data storage in Supabase
- ✅ Request validation using Zod
- 📝 Detailed logging of all operations
- 🔍 Typed webhook handling
- ⏱️ Robust timeout and error management
- 🔄 Payment status verification system
- 🚀 Easy integration with any application

## Project Structure

```
src/
├── app/                   # Next.js App Router routes
│   ├── api/               # API endpoints
│   │   ├── auth/          # Authentication
│   │   ├── checkout/      # Checkout creation
│   │   └── payments/      # Payment management
│   ├── layout.tsx         # Main layout
│   └── page.tsx           # Main page
├── db/                    # Data access layer
├── services/              # External services (LemonSqueezy)
├── config/                # Global configuration
├── utils/                 # Utilities
├── lib/                   # Libraries (logging, auth)
├── hooks/                 # React hooks
├── types/                 # Type definitions
└── store/                 # Application global store
```

## Configuration

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in `.env.local`:
```env
# Lemonqueezy Keys
LEMONSQUEEZY_API_KEY=your_api_key
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret
LEMONSQUEEZY_STORE_ID=your_store_id

# JWT for authentication
JWT_SECRET=your_jwt_secret

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Client credentials
ALLOWED_CLIENT_ID=your_client_id
ALLOWED_CLIENT_SECRET=your_client_secret

# Client application URL
NEXT_PUBLIC_APP_URL=https://your-frontend-app.com
```

## API Reference

### Authentication

#### POST /api/auth/token

Obtains a JWT token for use in authenticated requests.

**Request Body:**
```typescript
{
  client_id: string;
  client_secret: string;
}
```

**Response:**
```typescript
{
  token: string;
  expires_in: number;
}
```

### Payments

#### POST /api/checkout

Creates a new payment session and returns the URL.

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
  success: boolean;
  data: {
    id: string;
    checkout_url: string;
    order_id: string;
  };
}
```

#### GET /api/payments/status

Gets the current status of a payment.

**Query Parameters:**
- `orderId`: Order ID

**Response:**
```typescript
{
  status: "PENDING" | "PAID" | "REFUNDED" | "VOID";
  order_id: string;
  updated_at: string;
}
```

#### POST /api/payments/webhook

Endpoint for receiving LemonSqueezy webhooks. Processes events like `order_created` and updates the payment status in the database.

### Error Handling

All API endpoints return standardized error responses:

```typescript
{
  error: string;
  message?: string;
  code?: string;
}
```

Common error codes:
- `INVALID_REQUEST`: Request validation error
- `INVALID_CREDENTIALS`: Invalid authentication credentials
- `INVALID_SIGNATURE`: Invalid webhook signature
- `INTERNAL_SERVER_ERROR`: Unexpected server error

## Webhook Monitoring

The system includes robust webhook monitoring that:

1. Logs all received webhooks
2. Maintains metrics on reception and errors
3. Provides service health information
4. Saves detailed logs for diagnosis

## Payment Status Management

Payments can have one of the following statuses:
- `PENDING`: Payment pending completion
- `PAID`: Payment completed successfully
- `REFUNDED`: Payment refunded
- `VOID`: Payment voided

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

The service uses a custom logging system to log all operations. In development, logs are printed with formatting in the console. In production, they are in JSON format for better integration with logging services.

## Security

- All API routes are protected with JWT authentication
- Webhook endpoints verify LemonSqueezy signatures
- Request validation prevents invalid data
- Environment variables protect sensitive data
- Timeouts on all critical operations to prevent blocking
- Proper error handling to prevent information leaks

## Frontend Integration

To integrate with a frontend, you must:

1. Obtain an authentication token from `/api/auth/token`
2. Create a checkout using `/api/checkout`
3. Periodically check the payment status using `/api/payments/status`
4. Display the success page when the status changes to `PAID`

## Webhook Testing

To test webhooks locally:
1. Use [ngrok](https://ngrok.com/) or [localtunnel](https://theboroer.github.io/localtunnel-www/) to expose your local server
2. Configure the generated URL in your LemonSqueezy panel
3. Make a test purchase
4. Check the logs to verify that the webhook was processed correctly

## Troubleshooting

- **CORS Error**: Verify that `NEXT_PUBLIC_APP_URL` is configured correctly
- **Webhook not received**: Verify the webhook configuration in LemonSqueezy
- **Authentication error**: Verify client credentials
- **Payment status issue**: Check the logs in `debug_logs.txt`
