export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  VOID = 'VOID',
  REFUNDED = 'REFUNDED',
  TIMEOUT = 'TIMEOUT'
}

export type PaymentStatusData = {
  id: string;
  order_id: string;
  status: PaymentStatus;
  updated_at: Date;
  created_at: Date;
};