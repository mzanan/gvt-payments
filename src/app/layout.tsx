import { Inter } from 'next/font/google'
import { configureLogger } from '@/lib/logger';

const inter = Inter({ subsets: ['latin'] })

// Configure logger to reduce verbosity
configureLogger({
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'warn',
  enabledFlows: [
    'api_auth',
    'security',
    'error',
    'payment_status',
    'checkout'
  ]
});

export const metadata = {
  title: 'GVT Payments Service',
  description: 'Payment processing service for GVT',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}