// ==============================================
// Wallet & Billing Service
// ==============================================

import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import type {
  WalletSummary,
  WalletTransaction,
  WalletTransactionType,
  PaymentGateway,
} from '@/types/billing';

const logger = createLogger('service:wallet');

const MONTHLY_FREE_MINUTES_LIMIT = 3;
const BASE_TWILIO_RATE_PER_MIN = 0.014; // $0.014 per minute (standard Twilio US voice)
const PLATFORM_PROFIT_MARGIN = 0.20; // 20% markup

/**
 * Helper to check if date belongs to the current calendar month
 */
function isCurrentMonth(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}

/**
 * Retrieve organization wallet balance and free minutes status
 */
export async function getWalletSummary(organizationId: string): Promise<WalletSummary> {
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, wallet_balance, monthly_free_minutes_used, last_free_minutes_reset, metadata')
      .eq('id', organizationId)
      .maybeSingle();

    if (error || !org) {
      return {
        organizationId,
        balance: 0.0,
        monthlyFreeMinutesUsed: 0,
        monthlyFreeMinutesLimit: MONTHLY_FREE_MINUTES_LIMIT,
        currency: 'USD',
      };
    }

    // Monthly reset check
    let freeMinutesUsed = org.monthly_free_minutes_used || (org.metadata?.monthly_free_minutes_used as number) || 0;
    const lastReset = org.last_free_minutes_reset || (org.metadata?.last_free_minutes_reset as string);

    if (lastReset && !isCurrentMonth(lastReset)) {
      freeMinutesUsed = 0;
      await supabase
        .from('organizations')
        .update({
          monthly_free_minutes_used: 0,
          last_free_minutes_reset: new Date().toISOString(),
        })
        .eq('id', organizationId);
    }

    const balance = parseFloat(String(org.wallet_balance || (org.metadata?.wallet_balance as number) || 0));

    return {
      organizationId,
      balance: Math.max(0, balance),
      monthlyFreeMinutesUsed: freeMinutesUsed,
      monthlyFreeMinutesLimit: MONTHLY_FREE_MINUTES_LIMIT,
      currency: 'USD',
    };
  } catch (err: any) {
    logger.error({ err, organizationId }, 'Error retrieving wallet summary');
    return {
      organizationId,
      balance: 0.0,
      monthlyFreeMinutesUsed: 0,
      monthlyFreeMinutesLimit: MONTHLY_FREE_MINUTES_LIMIT,
      currency: 'USD',
    };
  }
}

/**
 * Credit an organization wallet (Top-Up)
 */
export async function creditWallet(params: {
  organizationId: string;
  amount: number;
  paymentGateway: PaymentGateway;
  paymentReference?: string;
  description: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; newBalance: number; transactionId?: string }> {
  const { organizationId, amount, paymentGateway, paymentReference, description, metadata = {} } = params;

  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  // Idempotency check: prevent duplicate credits for the same payment reference
  if (paymentReference) {
    try {
      const { data: existingTx } = await supabase
        .from('wallet_transactions')
        .select('id, status, amount')
        .eq('payment_reference', paymentReference)
        .eq('status', 'completed')
        .maybeSingle();

      if (existingTx) {
        logger.warn(
          { paymentReference, organizationId, txId: existingTx.id },
          'Payment reference already credited; skipping duplicate balance increment'
        );
        const currentSummary = await getWalletSummary(organizationId);
        return {
          success: true,
          newBalance: currentSummary.balance,
          transactionId: existingTx.id,
        };
      }
    } catch (checkErr) {
      logger.debug({ checkErr }, 'Idempotency check skipped');
    }
  }

  try {
    const summary = await getWalletSummary(organizationId);
    const newBalance = parseFloat((summary.balance + amount).toFixed(4));

    // 1. Update organization wallet_balance
    const { error: orgErr } = await supabase
      .from('organizations')
      .update({
        wallet_balance: newBalance,
      })
      .eq('id', organizationId);

    if (orgErr) {
      // Fallback: update in metadata if columns aren't migrated
      const { data: org } = await supabase.from('organizations').select('metadata').eq('id', organizationId).single();
      const meta = org?.metadata || {};
      await supabase
        .from('organizations')
        .update({
          metadata: { ...meta, wallet_balance: newBalance },
        })
        .eq('id', organizationId);
    }

    // 2. Log or update transaction ledger
    let transactionId: string | undefined;
    try {
      if (paymentReference) {
        // If a pending transaction existed for this reference, update it
        const { data: updatedTx } = await supabase
          .from('wallet_transactions')
          .update({
            status: 'completed',
            amount: amount,
            description,
            metadata: { ...metadata, previousBalance: summary.balance, newBalance },
          })
          .eq('payment_reference', paymentReference)
          .select('id')
          .maybeSingle();

        if (updatedTx) {
          transactionId = updatedTx.id;
        }
      }

      if (!transactionId) {
        const { data: tx, error: txErr } = await supabase
          .from('wallet_transactions')
          .insert({
            organization_id: organizationId,
            type: 'topup',
            amount: amount,
            currency: 'USD',
            status: 'completed',
            payment_gateway: paymentGateway,
            payment_reference: paymentReference || null,
            description,
            metadata: { ...metadata, previousBalance: summary.balance, newBalance },
          })
          .select('id')
          .maybeSingle();

        if (!txErr && tx) {
          transactionId = tx.id;
        }
      }
    } catch (txEx) {
      logger.debug({ txEx }, 'Note logging wallet transaction table');
    }

    logger.info(
      { organizationId, amount, newBalance, paymentGateway, paymentReference },
      'Wallet successfully credited'
    );

    return {
      success: true,
      newBalance,
      transactionId,
    };
  } catch (err: any) {
    logger.error({ err, organizationId, amount }, 'Failed to credit wallet');
    throw err;
  }
}

/**
 * Record a pending deposit in the ledger (wallet balance is NOT modified yet)
 */
export async function recordPendingDeposit(params: {
  organizationId: string;
  amount: number;
  paymentGateway: PaymentGateway;
  paymentReference: string;
  description: string;
  metadata?: Record<string, any>;
}): Promise<{ id?: string }> {
  const { organizationId, amount, paymentGateway, paymentReference, description, metadata = {} } = params;

  try {
    const { data: tx, error } = await supabase
      .from('wallet_transactions')
      .insert({
        organization_id: organizationId,
        type: 'topup',
        amount: amount,
        currency: 'USD',
        status: 'pending',
        payment_gateway: paymentGateway,
        payment_reference: paymentReference,
        description,
        metadata,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      logger.warn({ error, paymentReference }, 'Could not record pending deposit in table');
    }

    return { id: tx?.id };
  } catch (err) {
    logger.error({ err, paymentReference }, 'Error recording pending deposit');
    return {};
  }
}

/**
 * Confirm a pending deposit and credit the wallet balance
 */
export async function confirmPendingDeposit(params: {
  paymentReference: string;
  confirmedAmount?: number;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const { paymentReference, confirmedAmount, metadata = {} } = params;

  try {
    // 1. Locate the pending transaction
    const { data: tx, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('payment_reference', paymentReference)
      .maybeSingle();

    if (error || !tx) {
      return { success: false, error: 'Transaction reference not found' };
    }

    // If already completed, do nothing (idempotent)
    if (tx.status === 'completed') {
      const summary = await getWalletSummary(tx.organization_id);
      return { success: true, newBalance: summary.balance };
    }

    const finalAmount = confirmedAmount || tx.amount;
    const creditRes = await creditWallet({
      organizationId: tx.organization_id,
      amount: finalAmount,
      paymentGateway: tx.payment_gateway as PaymentGateway,
      paymentReference: paymentReference,
      description: tx.description.replace('(Pending Confirmation)', '(Confirmed)'),
      metadata: { ...tx.metadata, ...metadata, confirmedAt: new Date().toISOString() },
    });

    return { success: true, newBalance: creditRes.newBalance };
  } catch (err: any) {
    logger.error({ err, paymentReference }, 'Error confirming pending deposit');
    return { success: false, error: err.message };
  }
}

/**
 * Process monthly recurring fee deductions for dedicated numbers ($6.15/mo)
 * Twilio carrier: $1.15 + Platform Profit: $5.00
 */
export async function processMonthlyNumberRenewals(): Promise<{
  processed: number;
  renewed: number;
  failed: number;
}> {
  const MONTHLY_NUMBER_FEE = 6.15;
  const now = new Date().toISOString();
  let renewed = 0;
  let failed = 0;

  try {
    // Find organizations with dedicated numbers
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, metadata, wallet_balance, twilio_phone_number');

    if (error || !orgs) return { processed: 0, renewed: 0, failed: 0 };

    for (const org of orgs) {
      const meta = org.metadata || {};
      if (!meta.dedicated_number || !meta.next_number_billing_date) continue;

      const nextBilling = new Date(meta.next_number_billing_date);
      if (nextBilling <= new Date()) {
        const phone = org.twilio_phone_number || meta.dedicated_phone || 'dedicated phone';
        try {
          // Attempt debit
          await debitWallet({
            organizationId: org.id,
            amount: MONTHLY_NUMBER_FEE,
            type: 'number_purchase',
            description: `Monthly Renewal for Dedicated Phone (${phone}): $1.15 carrier + $5.00 platform fee`,
            metadata: {
              renewalMonth: new Date().toISOString().substring(0, 7),
              phoneNumber: phone,
            },
          });

          // Advance next billing date by 30 days
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + 30);

          await supabase
            .from('organizations')
            .update({
              metadata: {
                ...meta,
                next_number_billing_date: nextDate.toISOString(),
                number_billing_status: 'active',
                last_number_billed_at: now,
              },
            })
            .eq('id', org.id);

          renewed++;
          logger.info({ orgId: org.id, phone }, 'Successfully renewed dedicated phone monthly fee');
        } catch (debitErr: any) {
          failed++;
          logger.warn(
            { orgId: org.id, phone, err: debitErr.message },
            'Insufficient balance for monthly phone renewal'
          );

          // Mark as past due
          await supabase
            .from('organizations')
            .update({
              metadata: {
                ...meta,
                number_billing_status: 'past_due',
              },
            })
            .eq('id', org.id);
        }
      }
    }

    return { processed: renewed + failed, renewed, failed };
  } catch (err: any) {
    logger.error({ err }, 'Error running monthly number renewal routine');
    return { processed: 0, renewed, failed };
  }
}


/**
 * Debit an organization wallet
 */
export async function debitWallet(params: {
  organizationId: string;
  amount: number;
  type: WalletTransactionType;
  description: string;
  paymentReference?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; newBalance: number }> {
  const { organizationId, amount, type, description, paymentReference, metadata = {} } = params;

  if (amount <= 0) {
    return { success: true, newBalance: 0 };
  }

  try {
    const summary = await getWalletSummary(organizationId);

    if (summary.balance < amount) {
      throw new Error(
        `Insufficient wallet balance. Available: $${summary.balance.toFixed(2)}, Required: $${amount.toFixed(2)}`
      );
    }

    const newBalance = parseFloat((summary.balance - amount).toFixed(4));

    // 1. Update organization wallet_balance
    const { error: orgErr } = await supabase
      .from('organizations')
      .update({
        wallet_balance: newBalance,
      })
      .eq('id', organizationId);

    if (orgErr) {
      const { data: org } = await supabase.from('organizations').select('metadata').eq('id', organizationId).single();
      const meta = org?.metadata || {};
      await supabase
        .from('organizations')
        .update({
          metadata: { ...meta, wallet_balance: newBalance },
        })
        .eq('id', organizationId);
    }

    // 2. Log transaction in ledger (negative amount for debits)
    try {
      await supabase.from('wallet_transactions').insert({
        organization_id: organizationId,
        type,
        amount: -amount,
        currency: 'USD',
        status: 'completed',
        payment_gateway: 'wallet',
        payment_reference: paymentReference || null,
        description,
        metadata: { ...metadata, previousBalance: summary.balance, newBalance },
      });
    } catch (txEx) {
      logger.debug({ txEx }, 'Note recording debit transaction');
    }

    logger.info(
      { organizationId, amount, newBalance, type },
      'Wallet debited successfully'
    );

    return {
      success: true,
      newBalance,
    };
  } catch (err: any) {
    logger.error({ err, organizationId, amount }, 'Failed to debit wallet');
    throw err;
  }
}

/**
 * Check whether organization can place/receive calls based on free minutes and balance
 */
export async function checkCanMakeCall(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  remainingFreeMinutes: number;
  balance: number;
}> {
  const summary = await getWalletSummary(organizationId);
  const remainingFree = Math.max(0, summary.monthlyFreeMinutesLimit - summary.monthlyFreeMinutesUsed);

  if (remainingFree > 0) {
    return {
      allowed: true,
      remainingFreeMinutes: remainingFree,
      balance: summary.balance,
    };
  }

  // Minimum required balance to initiate a call leg (~1 minute)
  const minRequired = BASE_TWILIO_RATE_PER_MIN * (1 + PLATFORM_PROFIT_MARGIN);

  if (summary.balance >= minRequired) {
    return {
      allowed: true,
      remainingFreeMinutes: 0,
      balance: summary.balance,
    };
  }

  return {
    allowed: false,
    reason: `Your monthly 3 free minutes are exhausted and your wallet balance ($${summary.balance.toFixed(2)}) is insufficient. Please top up your wallet.`,
    remainingFreeMinutes: 0,
    balance: summary.balance,
  };
}

/**
 * Real-time voice call billing:
 * - 3 free minutes per month
 * - Paid minutes billed at Twilio rate + 20% platform profit
 */
export async function billCallUsage(params: {
  organizationId: string;
  durationSeconds: number;
  callSid: string;
  customBaseRate?: number;
}): Promise<{
  totalMinutes: number;
  freeMinutesApplied: number;
  billableMinutes: number;
  amountCharged: number;
  remainingBalance: number;
}> {
  const { organizationId, durationSeconds, callSid, customBaseRate } = params;

  if (durationSeconds <= 0) {
    const s = await getWalletSummary(organizationId);
    return {
      totalMinutes: 0,
      freeMinutesApplied: 0,
      billableMinutes: 0,
      amountCharged: 0,
      remainingBalance: s.balance,
    };
  }

  const totalMinutes = Math.ceil(durationSeconds / 60);
  const summary = await getWalletSummary(organizationId);

  const availableFree = Math.max(0, summary.monthlyFreeMinutesLimit - summary.monthlyFreeMinutesUsed);
  const freeMinutesApplied = Math.min(totalMinutes, availableFree);
  const billableMinutes = totalMinutes - freeMinutesApplied;

  // Update free minutes used if any were applied
  if (freeMinutesApplied > 0) {
    const updatedFreeUsed = summary.monthlyFreeMinutesUsed + freeMinutesApplied;
    await supabase
      .from('organizations')
      .update({
        monthly_free_minutes_used: updatedFreeUsed,
        last_free_minutes_reset: new Date().toISOString(),
      })
      .eq('id', organizationId);
  }

  // Calculate billable cost with 20% profit margin
  const baseRate = customBaseRate || BASE_TWILIO_RATE_PER_MIN;
  const billedRatePerMin = baseRate * (1 + PLATFORM_PROFIT_MARGIN);
  const amountCharged = parseFloat((billableMinutes * billedRatePerMin).toFixed(4));

  let remainingBalance = summary.balance;

  if (amountCharged > 0) {
    try {
      const debitRes = await debitWallet({
        organizationId,
        amount: amountCharged,
        type: 'call_usage',
        description: `Voice Call (${billableMinutes} min${billableMinutes > 1 ? 's' : ''} billed @ $${billedRatePerMin.toFixed(4)}/min incl. 20% margin)`,
        paymentReference: callSid,
        metadata: {
          callSid,
          durationSeconds,
          totalMinutes,
          freeMinutesApplied,
          billableMinutes,
          baseRatePerMin: baseRate,
          profitMargin: '20%',
          chargedRatePerMin: billedRatePerMin,
        },
      });
      remainingBalance = debitRes.newBalance;
    } catch (debitErr: any) {
      logger.warn(
        { debitErr: debitErr.message, organizationId, amountCharged, callSid },
        'Could not fully debit call usage from wallet balance'
      );
    }
  }

  logger.info(
    {
      organizationId,
      callSid,
      totalMinutes,
      freeMinutesApplied,
      billableMinutes,
      amountCharged,
      remainingBalance,
    },
    'Voice call usage processed'
  );

  return {
    totalMinutes,
    freeMinutesApplied,
    billableMinutes,
    amountCharged,
    remainingBalance,
  };
}

/**
 * List transaction ledger history for organization
 */
export async function listWalletTransactions(
  organizationId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ transactions: WalletTransaction[]; total: number }> {
  try {
    const { data, count, error } = await supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) {
      return { transactions: [], total: 0 };
    }

    return {
      transactions: data as WalletTransaction[],
      total: count || data.length,
    };
  } catch (err) {
    logger.error({ err, organizationId }, 'Error listing wallet transactions');
    return { transactions: [], total: 0 };
  }
}
