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

  if (NOWPAYMENTS_API_KEY && !NOWPAYMENTS_API_KEY.includes('dummy')) {
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

  // Simulation / sandbox mode fallback
  logger.info(
    { orderId, amountUSD },
    'Using NOWPayments in simulation mode (set NOWPAYMENTS_API_KEY for live crypto processing)'
  );

  return {
    id: `mock_invoice_${orderId}`,
    order_id: orderId,
    order_description: `CallPulse Wallet Top-up ($${amountUSD.toFixed(2)})`,
    price_amount: amountUSD,
    price_currency: 'usd',
    invoice_url: successUrl ? `${successUrl}?invoice_id=${orderId}&status=simulated` : '#',
    created_at: new Date().toISOString(),
  };
}

/**
 * Verify NOWPayments IPN webhook signature (HMAC-SHA512)
 */
export function verifyNowPaymentsSignature(
  rawBody: string | Buffer | Record<string, any>,
  receivedSignature: string
): boolean {
  if (!NOWPAYMENTS_IPN_SECRET) {
    // If no secret configured in dev/testing, allow
    return true;
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

    return calculatedSignature === receivedSignature;
  } catch (err) {
    logger.error({ err }, 'Error verifying NOWPayments IPN signature');
    return false;
  }
}
