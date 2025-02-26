import { PaymentStatus } from '@/types/payment';

  export type Database = {
    public: {
      Tables: {
        payments_status: {
          Row: PaymentStatus;
          Insert: Omit<PaymentStatus, 'id' | 'created_at' | 'updated_at'>;
          Update: Partial<Omit<PaymentStatus, 'id' | 'created_at'>>;
        };
      };
    };
  };