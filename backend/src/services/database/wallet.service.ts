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

/**
 * EXACT VOICE RATE FORMULA (per user requirement):
 * Twilio carrier charge for 49 minutes = $10.54 USD ($0.215102 / min)
 * Required platform net profit for 49 minutes = $5.00 USD ($0.102041 / min)
 * Total charged to user for 49 minutes = $15.54 USD ($0.317143 / min)
 * Customer rate: $0.3172 / minute (47.44% markup)
 */
export const KENYA_TWILIO_CARRIER_COST_PER_MIN = 0.215102;
export const KENYA_PLATFORM_PROFIT_PER_MIN = 0.102041;
export const KENYA_BILLED_RATE_PER_MIN = 0.317143; // $0.317143 / min (~$0.3172/min, $0.0052857/sec)

// USA Voice Calling: Twilio carrier cost ($0.0140/min) + platform profit ($0.0070/min)
export const USA_TWILIO_CARRIER_COST_PER_MIN = 0.0140;
export const USA_PLATFORM_PROFIT_PER_MIN = 0.0070;
export const USA_BILLED_RATE_PER_MIN = 0.0210; // $0.0210 / min ($0.000350/sec)

export const BASE_TWILIO_RATE_PER_MIN = KENYA_TWILIO_CARRIER_COST_PER_MIN;
export const PLATFORM_PROFIT_MARGIN = 0.4744; // 47.44% markup ensures $5.00 profit per $10.54 carrier cost

export interface VoiceCallRateInfo {
  baseCarrierRatePerMin: number;
  profitMarginPerMin: number;
  billedRatePerMin: number;
  ratePerSecond: number;
  carrierRatePerSecond: number;
  profitRatePerSecond: number;
  country: string;
  destination: string;
}

/**
 * Resolve rate per minute & per second based on destination phone number
 */
export function getCallBillingRate(destinationPhone?: string): VoiceCallRateInfo {
  const cleaned = (destinationPhone || '').replace(/\D/g, '');

  // Kenyan numbers: +254..., 07..., 01..., 254...
  if (
    cleaned.startsWith('254') ||
    cleaned.startsWith('07') ||
    cleaned.startsWith('01') ||
    (cleaned.length === 9 && (cleaned.startsWith('7') || cleaned.startsWith('1')))
  ) {
    return {
      baseCarrierRatePerMin: KENYA_TWILIO_CARRIER_COST_PER_MIN,
      profitMarginPerMin: KENYA_PLATFORM_PROFIT_PER_MIN,
      billedRatePerMin: KENYA_BILLED_RATE_PER_MIN,
      ratePerSecond: KENYA_BILLED_RATE_PER_MIN / 60,
      carrierRatePerSecond: KENYA_TWILIO_CARRIER_COST_PER_MIN / 60,
      profitRatePerSecond: KENYA_PLATFORM_PROFIT_PER_MIN / 60,
      country: 'KE',
      destination: 'Kenya',
    };
  }

  // Domestic US/Canada numbers (+1...)
  if (cleaned.startsWith('1') && (cleaned.length === 11 || cleaned.length === 10)) {
    return {
      baseCarrierRatePerMin: USA_TWILIO_CARRIER_COST_PER_MIN,
      profitMarginPerMin: USA_PLATFORM_PROFIT_PER_MIN,
      billedRatePerMin: USA_BILLED_RATE_PER_MIN,
      ratePerSecond: USA_BILLED_RATE_PER_MIN / 60,
      carrierRatePerSecond: USA_TWILIO_CARRIER_COST_PER_MIN / 60,
      profitRatePerSecond: USA_PLATFORM_PROFIT_PER_MIN / 60,
      country: 'US',
      destination: 'United States',
    };
  }

  // Default international rate matching user's profit ratio
  return {
    baseCarrierRatePerMin: KENYA_TWILIO_CARRIER_COST_PER_MIN,
    profitMarginPerMin: KENYA_PLATFORM_PROFIT_PER_MIN,
    billedRatePerMin: KENYA_BILLED_RATE_PER_MIN,
    ratePerSecond: KENYA_BILLED_RATE_PER_MIN / 60,
    carrierRatePerSecond: KENYA_TWILIO_CARRIER_COST_PER_MIN / 60,
    profitRatePerSecond: KENYA_PLATFORM_PROFIT_PER_MIN / 60,
    country: 'INTL',
    destination: 'International',
  };
}

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
 * Process monthly recurring fee deductions for dedicated numbers ($6.00/mo)
 */
export async function processMonthlyNumberRenewals(): Promise<{
  processed: number;
  renewed: number;
  failed: number;
}> {
  const MONTHLY_NUMBER_FEE = 6.00;
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
            description: `Monthly Renewal for Dedicated Phone (${phone})`,
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
 * Calculate maximum call duration and verify whether organization can place a call
 * based on free minutes, wallet balance, and destination country rate.
 */
export async function calculateCallLimit(
  organizationId: string,
  destinationPhone?: string
): Promise<{
  allowed: boolean;
  reason?: string;
  remainingFreeMinutes: number;
  remainingFreeSeconds: number;
  balance: number;
  ratePerMinute: number;
  ratePerSecond: number;
  maxDurationSeconds: number;
  rateInfo: VoiceCallRateInfo;
}> {
  const summary = await getWalletSummary(organizationId);
  const remainingFreeMin = Math.max(0, summary.monthlyFreeMinutesLimit - summary.monthlyFreeMinutesUsed);
  const remainingFreeSeconds = Math.round(remainingFreeMin * 60);
  const rateInfo = getCallBillingRate(destinationPhone);
  const ratePerSec = rateInfo.ratePerSecond;

  // 1. If organization has monthly free trial seconds remaining
  if (remainingFreeSeconds > 0) {
    const paidSeconds = Math.floor(summary.balance / ratePerSec);
    const maxDurationSeconds = Math.max(30, remainingFreeSeconds + Math.max(0, paidSeconds));

    return {
      allowed: true,
      remainingFreeMinutes: Number((remainingFreeSeconds / 60).toFixed(2)),
      remainingFreeSeconds,
      balance: summary.balance,
      ratePerMinute: rateInfo.billedRatePerMin,
      ratePerSecond: ratePerSec,
      maxDurationSeconds,
      rateInfo,
    };
  }

  // 2. If free minutes are used up, check if wallet has balance for at least 5 seconds
  if (summary.balance >= ratePerSec) {
    const paidSeconds = Math.floor(summary.balance / ratePerSec);
    if (paidSeconds >= 5) {
      return {
        allowed: true,
        remainingFreeMinutes: 0,
        remainingFreeSeconds: 0,
        balance: summary.balance,
        ratePerMinute: rateInfo.billedRatePerMin,
        ratePerSecond: ratePerSec,
        maxDurationSeconds: paidSeconds,
        rateInfo,
      };
    }
  }

  // 3. Free minutes used up and balance is insufficient
  return {
    allowed: false,
    reason: `Your wallet balance ($${summary.balance.toFixed(
      2
    )}) is insufficient for this call to ${rateInfo.destination}. Please top up your wallet.`,
    remainingFreeMinutes: 0,
    remainingFreeSeconds: 0,
    balance: summary.balance,
    ratePerMinute: rateInfo.billedRatePerMin,
    ratePerSecond: ratePerSec,
    maxDurationSeconds: 0,
    rateInfo,
  };
}

/**
 * Backward-compatible helper checking if call is allowed
 */
export async function checkCanMakeCall(
  organizationId: string,
  destinationPhone?: string
): Promise<{
  allowed: boolean;
  reason?: string;
  remainingFreeMinutes: number;
  balance: number;
  maxDurationSeconds: number;
}> {
  const limit = await calculateCallLimit(organizationId, destinationPhone);
  return {
    allowed: limit.allowed,
    reason: limit.reason,
    remainingFreeMinutes: limit.remainingFreeMinutes,
    balance: limit.balance,
    maxDurationSeconds: limit.maxDurationSeconds,
  };
}

/**
 * Mid-call Incremental Voice Billing:
 * Billed in REAL-TIME seconds as the user speaks!
 * Deducts ONLY what is used down to the exact second.
 * If wallet balance depletes and free trial is exhausted, signals shouldDisconnect = true
 */
export async function billIncrementalCallUsage(params: {
  organizationId: string;
  callSid: string;
  elapsedSeconds: number;
  previouslyBilledSeconds?: number;
  previouslyBilledMinutes?: number;
  destinationPhone?: string;
}): Promise<{
  newBilledSeconds: number;
  newBilledMinutes: number;
  incrementalSecondsBilled: number;
  incrementalMinutesBilled: number;
  amountChargedNow: number;
  remainingBalance: number;
  shouldDisconnect: boolean;
  reason?: string;
}> {
  const { organizationId, callSid, elapsedSeconds, destinationPhone } = params;

  const prevSeconds =
    params.previouslyBilledSeconds !== undefined
      ? params.previouslyBilledSeconds
      : (params.previouslyBilledMinutes ?? 0) * 60;

  if (elapsedSeconds <= 0) {
    const s = await getWalletSummary(organizationId);
    return {
      newBilledSeconds: 0,
      newBilledMinutes: 0,
      incrementalSecondsBilled: 0,
      incrementalMinutesBilled: 0,
      amountChargedNow: 0,
      remainingBalance: s.balance,
      shouldDisconnect: false,
    };
  }

  const secondsToBillNow = Math.max(0, elapsedSeconds - prevSeconds);

  if (secondsToBillNow <= 0) {
    const s = await getWalletSummary(organizationId);
    const freeSec = Math.max(0, (s.monthlyFreeMinutesLimit - s.monthlyFreeMinutesUsed) * 60);
    return {
      newBilledSeconds: prevSeconds,
      newBilledMinutes: Math.ceil(prevSeconds / 60),
      incrementalSecondsBilled: 0,
      incrementalMinutesBilled: 0,
      amountChargedNow: 0,
      remainingBalance: s.balance,
      shouldDisconnect: s.balance <= 0 && freeSec <= 0,
    };
  }

  const summary = await getWalletSummary(organizationId);
  const rateInfo = getCallBillingRate(destinationPhone);

  const availableFreeSeconds = Math.max(0, (summary.monthlyFreeMinutesLimit - summary.monthlyFreeMinutesUsed) * 60);
  const freeSecondsToApply = Math.min(secondsToBillNow, availableFreeSeconds);
  const paidSecondsNow = Math.max(0, secondsToBillNow - freeSecondsToApply);

  // Consume free seconds proportionally
  if (freeSecondsToApply > 0) {
    const updatedFreeMinutesUsed = Number(
      (summary.monthlyFreeMinutesUsed + freeSecondsToApply / 60).toFixed(4)
    );
    await supabase
      .from('organizations')
      .update({
        monthly_free_minutes_used: updatedFreeMinutesUsed,
        last_free_minutes_reset: new Date().toISOString(),
      })
      .eq('id', organizationId);
  }

  const costNow = parseFloat((paidSecondsNow * rateInfo.ratePerSecond).toFixed(4));
  let remainingBalance = summary.balance;
  let shouldDisconnect = false;
  let reason: string | undefined;

  if (costNow > 0) {
    if (summary.balance < costNow) {
      // Balance cannot cover the current seconds! Disconnect immediately!
      shouldDisconnect = true;
      reason = 'Wallet balance depleted.';

      if (summary.balance > 0) {
        try {
          const debitRes = await debitWallet({
            organizationId,
            amount: summary.balance,
            type: 'call_usage',
            description: `Voice Call to ${rateInfo.destination}`,
            paymentReference: callSid,
            metadata: {
              callSid,
              elapsedSeconds,
              paidSecondsNow,
              ratePerSecond: rateInfo.ratePerSecond,
              country: rateInfo.country,
              midCallDepleted: true,
            },
          });
          remainingBalance = debitRes.newBalance;
        } catch {}
      }
    } else {
      try {
        const debitRes = await debitWallet({
          organizationId,
          amount: costNow,
          type: 'call_usage',
          description: `Voice Call to ${rateInfo.destination}`,
          paymentReference: callSid,
          metadata: {
            callSid,
            elapsedSeconds,
            paidSeconds: paidSecondsNow,
            ratePerSecond: rateInfo.ratePerSecond,
            country: rateInfo.country,
            destinationPhone,
          },
        });
        remainingBalance = debitRes.newBalance;
        if (remainingBalance <= 0) {
          shouldDisconnect = true;
          reason = 'Wallet balance depleted.';
        }
      } catch (err: any) {
        logger.warn({ err: err.message, callSid }, 'Error executing mid-call debit');
      }
    }
  }

  return {
    newBilledSeconds: elapsedSeconds,
    newBilledMinutes: Math.ceil(elapsedSeconds / 60),
    incrementalSecondsBilled: secondsToBillNow,
    incrementalMinutesBilled: Number((secondsToBillNow / 60).toFixed(2)),
    amountChargedNow: costNow,
    remainingBalance,
    shouldDisconnect,
    reason,
  };
}

/**
 * Final Real-time Voice Call Usage Settlement:
 * Billed in exact seconds! Only deducts what was actually used.
 * Deducts pro-rated: (durationSeconds - freeSecondsApplied) * ratePerSecond minus any already-debited amount.
 */
export async function billCallUsage(params: {
  organizationId: string;
  durationSeconds: number;
  callSid: string;
  destinationPhone?: string;
  customBaseRate?: number;
  carrierCost?: number;
  alreadyDebitedAmount?: number;
}): Promise<{
  totalDurationSeconds: number;
  totalMinutes: number;
  freeSecondsApplied: number;
  freeMinutesApplied: number;
  billableSeconds: number;
  billableMinutes: number;
  totalAmountCharged: number;
  incrementalAmountCharged: number;
  remainingBalance: number;
}> {
  const {
    organizationId,
    durationSeconds,
    callSid,
    destinationPhone,
    customBaseRate,
    alreadyDebitedAmount = 0,
  } = params;

  const summary = await getWalletSummary(organizationId);

  if (durationSeconds <= 0) {
    return {
      totalDurationSeconds: 0,
      totalMinutes: 0,
      freeSecondsApplied: 0,
      freeMinutesApplied: 0,
      billableSeconds: 0,
      billableMinutes: 0,
      totalAmountCharged: alreadyDebitedAmount,
      incrementalAmountCharged: 0,
      remainingBalance: summary.balance,
    };
  }

  const rateInfo = getCallBillingRate(destinationPhone);
  const ratePerSecond = customBaseRate
    ? (customBaseRate * (1 + PLATFORM_PROFIT_MARGIN)) / 60
    : rateInfo.ratePerSecond;

  const availableFreeSeconds = Math.max(0, (summary.monthlyFreeMinutesLimit - summary.monthlyFreeMinutesUsed) * 60);
  const freeSecondsApplied = Math.min(durationSeconds, availableFreeSeconds);
  const billableSeconds = Math.max(0, durationSeconds - freeSecondsApplied);

  // Update free minutes used if any were applied
  if (freeSecondsApplied > 0) {
    const updatedFreeMinutesUsed = Number(
      (summary.monthlyFreeMinutesUsed + freeSecondsApplied / 60).toFixed(4)
    );
    await supabase
      .from('organizations')
      .update({
        monthly_free_minutes_used: updatedFreeMinutesUsed,
        last_free_minutes_reset: new Date().toISOString(),
      })
      .eq('id', organizationId);
  }

  // Exact second-by-second charge:
  const expectedTotalCharge = parseFloat((billableSeconds * ratePerSecond).toFixed(4));
  const incrementalAmountToDebit = Math.max(0, parseFloat((expectedTotalCharge - alreadyDebitedAmount).toFixed(4)));

  let remainingBalance = summary.balance;

  if (incrementalAmountToDebit > 0) {
    const amountToDebit = Math.min(summary.balance, incrementalAmountToDebit);
    if (amountToDebit > 0) {
      try {
        const debitRes = await debitWallet({
          organizationId,
          amount: amountToDebit,
          type: 'call_usage',
          description: `Voice Call to ${rateInfo.destination} (${durationSeconds}s)`,
          paymentReference: callSid,
          metadata: {
            callSid,
            durationSeconds,
            freeSecondsApplied,
            billableSeconds,
            ratePerSecond,
            country: rateInfo.country,
            destinationPhone,
            totalCharge: expectedTotalCharge,
            alreadyDebitedAmount,
            finalDebit: amountToDebit,
          },
        });
        remainingBalance = debitRes.newBalance;
      } catch (debitErr: any) {
        logger.warn(
          { debitErr: debitErr.message, organizationId, callSid },
          'Note processing final call usage debit'
        );
      }
    }
  }

  logger.info(
    {
      organizationId,
      callSid,
      destinationPhone,
      durationSeconds,
      freeSecondsApplied,
      billableSeconds,
      expectedTotalCharge,
      alreadyDebitedAmount,
      incrementalAmountToDebit,
      remainingBalance,
    },
    'Final voice call usage settled successfully'
  );

  return {
    totalDurationSeconds: durationSeconds,
    totalMinutes: Number((durationSeconds / 60).toFixed(2)),
    freeSecondsApplied,
    freeMinutesApplied: Number((freeSecondsApplied / 60).toFixed(2)),
    billableSeconds,
    billableMinutes: Number((billableSeconds / 60).toFixed(2)),
    totalAmountCharged: expectedTotalCharge,
    incrementalAmountCharged: incrementalAmountToDebit,
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
