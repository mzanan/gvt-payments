export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  VOID = 'void',
  REFUNDED = 'refunded'
}

export type PaymentStatusData = {
  id: string;
  order_id: string;
  status: PaymentStatus;
  updated_at: Date;
  created_at: Date;
};