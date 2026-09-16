// ==============================================
// NOWPayments Integration Service
// Cryptocurrency Payments (BTC, USDT, ETH, LTC, SOL)
// ==============================================

import crypto from 'crypto';
import { createLogger } from '@/lib/logger';

const logger = createLogger('service:billing:nowpayments');

const NOWPAYMENTS_API_KEY =
  process.env.NOWPAYMENTS_API_KEY ||
  process.env.NOWPAYMENTS_KEY ||
  '';

const NOWPAYMENTS_IPN_SECRET =
  process.env.NOWPAYMENTS_IPN_SECRET ||
  process.env.NOWPAYMENTS_SECRET ||
  '';

export interface NowPaymentsInvoiceResponse {
  id: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: string;
  invoice_url: string;
  created_at: string;
}

/**
 * Create a crypto invoice via NOWPayments
 */
export async function createNowPaymentsInvoice(params: {
  amountUSD: number;
  organizationId: string;
  orderDescription?: string;
  ipnCallbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<NowPaymentsInvoiceResponse> {
  const { amountUSD, organizationId, orderDescription, ipnCallbackUrl, successUrl, cancelUrl } = params;
  const orderId = `CP_CRYPTO_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (!NOWPAYMENTS_API_KEY || NOWPAYMENTS_API_KEY.includes('dummy')) {
    logger.warn({ orderId, amountUSD }, 'NOWPAYMENTS_API_KEY is not configured on server');
    throw new Error(
      'NOWPayments crypto gateway is not configured. Please add NOWPAYMENTS_API_KEY to your Render environment variables.'
    );
  }

  try {
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amountUSD,
        price_currency: 'usd',
        order_id: orderId,
        order_description: orderDescription || `CallPulse Wallet Top-up ($${amountUSD.toFixed(2)})`,
        ipn_callback_url: ipnCallbackUrl,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    const data = (await response.json()) as any;
    if (!response.ok || !data.invoice_url) {
      throw new Error(data.message || 'Failed to create NOWPayments invoice');
    }

    logger.info({ orderId, amountUSD, invoiceId: data.id }, 'NOWPayments invoice created');
    return data as NowPaymentsInvoiceResponse;
  } catch (err: any) {
    logger.error({ err: err.message, orderId }, 'NOWPayments API request failed');
    throw err;
  }
}

/**
 * Fetch payment status from NOWPayments API
 */
export async function getNowPaymentsPaymentStatus(paymentOrInvoiceId: string): Promise<{
  confirmed: boolean;
  status: string;
  priceAmount?: number;
  actuallyPaid?: number;
  payCurrency?: string;
  error?: string;
}> {
  if (!NOWPAYMENTS_API_KEY || NOWPAYMENTS_API_KEY.includes('dummy')) {
    return {
      confirmed: false,
      status: 'unconfigured',
      error: 'NOWPAYMENTS_API_KEY is not configured',
    };
  }

  try {
    // Check by payment ID or invoice ID
    const response = await fetch(
      `https://api.nowpayments.io/v1/payment/?invoice_id=${encodeURIComponent(paymentOrInvoiceId)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY,
        },
      }
    );

    const data = (await response.json()) as any;
    if (!response.ok) {
      // Try direct payment endpoint
      const directRes = await fetch(
        `https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentOrInvoiceId)}`,
        {
          method: 'GET',
          headers: { 'x-api-key': NOWPAYMENTS_API_KEY },
        }
      );
      const directData = (await directRes.json()) as any;
      if (directRes.ok && directData.payment_status) {
        const isConfirmed = ['finished', 'confirmed'].includes(directData.payment_status);
        return {
          confirmed: isConfirmed,
          status: directData.payment_status,
          priceAmount: directData.price_amount,
          actuallyPaid: directData.actually_paid,
          payCurrency: directData.pay_currency,
        };
      }

      return {
        confirmed: false,
        status: 'not_found',
        error: data.message || 'Payment not found on NOWPayments',
      };
    }

    // data can have data array or single payment object
    const payment = Array.isArray(data.data) && data.data.length > 0 ? data.data[0] : data;
    const paymentStatus = payment.payment_status || 'waiting';
    const isConfirmed = ['finished', 'confirmed'].includes(paymentStatus);

    return {
      confirmed: isConfirmed,
      status: paymentStatus,
      priceAmount: payment.price_amount,
      actuallyPaid: payment.actually_paid,
      payCurrency: payment.pay_currency,
    };
  } catch (err: any) {
    logger.error({ err: err.message, paymentOrInvoiceId }, 'Error checking NOWPayments payment status');
    return {
      confirmed: false,
      status: 'error',
      error: err.message,
    };
  }
}

/**
 * Verify NOWPayments IPN webhook signature (HMAC-SHA512)
 */
export function verifyNowPaymentsSignature(
  rawBody: string | Buffer | Record<string, any>,
  receivedSignature: string
): boolean {
  if (!NOWPAYMENTS_IPN_SECRET || !receivedSignature) {
    logger.warn('NOWPAYMENTS_IPN_SECRET or received signature missing; rejecting webhook');
    return false;
  }

  try {
    let payload: any = rawBody;
    if (typeof payload === 'object' && !Buffer.isBuffer(payload)) {
      // Sort keys alphabetically as required by NOWPayments IPN spec
      const sortedKeys = Object.keys(payload).sort();
      const sortedObj: Record<string, any> = {};
      for (const key of sortedKeys) {
        sortedObj[key] = (payload as any)[key];
      }
      payload = JSON.stringify(sortedObj);
    }

    const hmac = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET);
    hmac.update(String(payload));
    const calculatedSignature = hmac.digest('hex');

    return calculatedSignature.toLowerCase() === receivedSignature.toLowerCase();
  } catch (err) {
    logger.error({ err }, 'Error verifying NOWPayments IPN signature');
    return false;
  }
}

