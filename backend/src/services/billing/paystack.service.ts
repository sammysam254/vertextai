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

// Hardcoded exchange rate: 1 USD = 134 KES
export const USD_TO_KES_RATE = 134;

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
  amountKES?: number;
  amountUSD?: number;
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
 * STRICT REQUIREMENT: Amount sent to Paystack is strictly converted to KES (1 USD = 134 KES)
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amountUSD: number;
  organizationId: string;
  callbackUrl?: string;
}): Promise<PaystackInitResponse> {
  const { email, amountUSD, organizationId, callbackUrl } = params;

  // Convert USD to KES: 1 USD = 134 KES
  const amountKES = Math.round(amountUSD * USD_TO_KES_RATE);
  // Paystack expects amount in minor subunits (1 KES = 100 cents/kobo)
  const amountSubunits = amountKES * 100;
  const reference = `CP_PAY_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('dummy')) {
    logger.warn({ reference, amountUSD, amountKES }, 'PAYSTACK_SECRET_KEY is not configured on server');
    throw new Error(
      'Paystack is not configured on the server. Please add PAYSTACK_SECRET_KEY in Render environment variables.'
    );
  }

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountSubunits,
        currency: 'KES',
        reference,
        callback_url: callbackUrl,
        metadata: {
          organizationId,
          amountUSD,
          amountKES,
          exchangeRate: USD_TO_KES_RATE,
          service: 'CallPulse Wallet Top-up',
        },
        channels: ['card', 'mobile_money', 'bank'],
      }),
    });

    const resData = (await response.json()) as any;
    if (!response.ok || !resData.status) {
      throw new Error(resData.message || 'Paystack initialization failed');
    }

    logger.info(
      { reference, email, amountUSD, amountKES, rate: USD_TO_KES_RATE },
      'Paystack transaction initialized in KES via API'
    );

    return {
      ...resData.data,
      amountKES,
      amountUSD,
    };
  } catch (err: any) {
    logger.error({ err: err.message, reference }, 'Paystack API call failed');
    throw err;
  }
}

/**
 * Verify a Paystack transaction by reference
 * Converted from paid KES back to exact USD (1 USD = 134 KES)
 * ONLY confirms and returns success when Paystack API returns status === 'success'
 */
export async function verifyPaystackTransaction(reference: string): Promise<{
  success: boolean;
  amountUSD: number;
  amountKES?: number;
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

    // Strict confirmation check
    if (!response.ok || !resData.status || resData.data?.status !== 'success') {
      logger.warn(
        { reference, status: resData?.data?.status, message: resData?.message },
        'Paystack payment verification failed: not confirmed'
      );
      return {
        success: false,
        amountUSD: 0,
        currency: 'USD',
        error: resData?.message || `Payment status is '${resData?.data?.status || 'unconfirmed'}'`,
      };
    }

    // Paystack amounts in minor units (subunits)
    const paidMinorUnits = resData.data.amount;
    const paidKES = paidMinorUnits / 100;

    // If metadata stored original exact amountUSD, use that for 100% precision
    const metadataAmountUSD = resData.data.metadata?.amountUSD
      ? parseFloat(String(resData.data.metadata.amountUSD))
      : undefined;

    // Converted back to exact USD: paidKES / 134
    const calculatedAmountUSD = parseFloat((paidKES / USD_TO_KES_RATE).toFixed(2));
    const amountUSD = metadataAmountUSD && Math.abs(metadataAmountUSD - calculatedAmountUSD) < 0.2
      ? metadataAmountUSD
      : calculatedAmountUSD;

    logger.info(
      { reference, paidKES, amountUSD, channel: resData.data.channel },
      'Paystack KES payment strictly confirmed by API, converted to USD'
    );

    return {
      success: true,
      amountUSD,
      amountKES: paidKES,
      currency: 'USD',
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

