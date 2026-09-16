// ==============================================
// Paystack Payment Integration Service
// Card, M-Pesa, Bank Transfer, Mobile Money
// ==============================================

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
 */
export async function verifyPaystackTransaction(reference: string): Promise<{
  success: boolean;
  amountUSD: number;
  currency: string;
  channel?: string;
  metadata?: Record<string, any>;
}> {
  if (PAYSTACK_SECRET_KEY && !PAYSTACK_SECRET_KEY.includes('dummy')) {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const resData = (await response.json()) as any;
      if (!response.ok || !resData.status || resData.data?.status !== 'success') {
        logger.warn({ reference, resData }, 'Paystack verification failed');
        return {
          success: false,
          amountUSD: 0,
          currency: 'USD',
        };
      }

      const amountUSD = resData.data.amount / 100;
      return {
        success: true,
        amountUSD: resData.data.metadata?.amountUSD ? parseFloat(resData.data.metadata.amountUSD) : amountUSD,
        currency: resData.data.currency || 'USD',
        channel: resData.data.channel,
        metadata: resData.data.metadata,
      };
    } catch (err: any) {
      logger.error({ err: err.message, reference }, 'Error verifying Paystack transaction');
      throw err;
    }
  }

  // Simulation mode fallback
  return {
    success: true,
    amountUSD: 10.0,
    currency: 'USD',
    channel: 'card_simulated',
  };
}
