// ==============================================
// Paystack Payment Integration Service
// Card, M-Pesa, Bank Transfer, Mobile Money
// ==============================================

import crypto from 'crypto';
import { createLogger } from '@/lib/logger';

const logger = createLogger('service:billing:paystack');

const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY ||
  process.env.PAYSTACK_SECRET ||
  '';

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number; // in subunits (cents or kobo)
    currency: string;
    channel: string;
    metadata: Record<string, any>;
    customer: {
      email: string;
      customer_code?: string;
    };
  };
}

/**
 * Initialize a Paystack transaction
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amountUSD: number;
  organizationId: string;
  callbackUrl?: string;
}): Promise<PaystackInitResponse> {
  const { email, amountUSD, organizationId, callbackUrl } = params;

  // Paystack expects amount in minor units (e.g. cents: $10 = 1000)
  const amountCents = Math.round(amountUSD * 100);
  const reference = `CP_PAY_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // If live key is provided, use Paystack REST API
  if (PAYSTACK_SECRET_KEY && !PAYSTACK_SECRET_KEY.includes('dummy')) {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: amountCents,
          currency: 'USD',
          reference,
          callback_url: callbackUrl,
          metadata: {
            organizationId,
            amountUSD,
            service: 'CallPulse Wallet Top-up',
          },
          channels: ['card', 'bank', 'mobile_money'],
        }),
      });

      const resData = (await response.json()) as any;
      if (!response.ok || !resData.status) {
        throw new Error(resData.message || 'Paystack initialization failed');
      }

      logger.info({ reference, email, amountUSD }, 'Paystack transaction initialized via API');
      return resData.data;
    } catch (err: any) {
      logger.error({ err: err.message, reference }, 'Paystack API call failed');
      throw err;
    }
  }

  // Simulation / Sandbox fallback when PAYSTACK_SECRET_KEY is in test/setup mode
  logger.info(
    { reference, amountUSD, email },
    'Using Paystack in simulation mode (set PAYSTACK_SECRET_KEY for live processing)'
  );

  return {
    authorization_url: callbackUrl ? `${callbackUrl}?reference=${reference}&status=success` : '#',
    access_code: `mock_code_${reference}`,
    reference,
  };
}

/**
 * Verify a Paystack transaction by reference
 * ONLY confirms and returns success when Paystack API returns status === 'success'
 */
export async function verifyPaystackTransaction(reference: string): Promise<{
  success: boolean;
  amountUSD: number;
  currency: string;
  channel?: string;
  metadata?: Record<string, any>;
  error?: string;
}> {
  if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('dummy')) {
    logger.warn({ reference }, 'PAYSTACK_SECRET_KEY is not configured on server');
    return {
      success: false,
      amountUSD: 0,
      currency: 'USD',
      error: 'Paystack is not configured on the server. Please add PAYSTACK_SECRET_KEY in Render environment variables.',
    };
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const resData = (await response.json()) as any;
    
    // Strict confirmation check: response must be ok, status true, and data.status === 'success'
    if (!response.ok || !resData.status || resData.data?.status !== 'success') {
      logger.warn({ reference, status: resData?.data?.status, message: resData?.message }, 'Paystack payment verification failed: not confirmed');
      return {
        success: false,
        amountUSD: 0,
        currency: 'USD',
        error: resData?.message || `Payment status is '${resData?.data?.status || 'unconfirmed'}'`,
      };
    }

    const paidMinorUnits = resData.data.amount;
    const metadataAmountUSD = resData.data.metadata?.amountUSD ? parseFloat(resData.data.metadata.amountUSD) : undefined;
    const calculatedAmountUSD = paidMinorUnits / 100;
    const amountUSD = metadataAmountUSD && Math.abs(metadataAmountUSD - calculatedAmountUSD) < 0.1
      ? metadataAmountUSD
      : calculatedAmountUSD;

    logger.info({ reference, amountUSD, channel: resData.data.channel }, 'Paystack payment strictly confirmed by API');

    return {
      success: true,
      amountUSD,
      currency: resData.data.currency || 'USD',
      channel: resData.data.channel,
      metadata: resData.data.metadata,
    };
  } catch (err: any) {
    logger.error({ err: err.message, reference }, 'Error verifying Paystack transaction with Paystack API');
    return {
      success: false,
      amountUSD: 0,
      currency: 'USD',
      error: err.message || 'Error communicating with Paystack verification endpoint',
    };
  }
}

/**
 * Verify Paystack webhook signature (HMAC-SHA512)
 */
export function verifyPaystackWebhookSignature(
  rawBody: string | Buffer,
  signature: string
): boolean {
  if (!PAYSTACK_SECRET_KEY) return false;
  try {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
      .digest('hex');
    return hash === signature;
  } catch (err) {
    logger.error({ err }, 'Error checking Paystack webhook signature');
    return false;
  }
}

