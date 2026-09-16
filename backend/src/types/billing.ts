// ==============================================
// Billing & Wallet Types
// ==============================================

export type WalletTransactionType =
  | 'topup'
  | 'number_purchase'
  | 'call_usage'
  | 'refund'
  | 'adjustment';

export type WalletTransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type PaymentGateway = 'paystack' | 'nowpayments' | 'wallet' | 'system' | 'manual';

export interface WalletTransaction {
  id: string;
  organization_id: string;
  type: WalletTransactionType;
  amount: number;
  currency: string;
  status: WalletTransactionStatus;
  payment_gateway: PaymentGateway;
  payment_reference?: string | null;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface WalletSummary {
  organizationId: string;
  balance: number;
  monthlyFreeMinutesUsed: number;
  monthlyFreeMinutesLimit: number;
  currency: string;
}
