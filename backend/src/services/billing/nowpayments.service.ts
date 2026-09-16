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

export type UsdtNetwork = 'TRC20' | 'BEP20' | 'SOL' | 'POLYGON' | 'ERC20' | 'TON' | 'ARBITRUM';

export const USDT_NETWORK_CONFIG: Record<
  UsdtNetwork,
  { currency: string; label: string; networkName: string; memoRequired?: boolean }
> = {
  TRC20: { currency: 'usdttrc20', label: 'USDT (TRC20)', networkName: 'Tron' },
  BEP20: { currency: 'usdtbsc', label: 'USDT (BEP20)', networkName: 'BNB Smart Chain' },
  SOL: { currency: 'usdtsol', label: 'USDT (Solana)', networkName: 'Solana' },
  POLYGON: { currency: 'usdtmatic', label: 'USDT (Polygon)', networkName: 'Polygon (MATIC)' },
  ERC20: { currency: 'usdterc20', label: 'USDT (ERC20)', networkName: 'Ethereum' },
  TON: { currency: 'usdtton', label: 'USDT (TON)', networkName: 'The Open Network' },
  ARBITRUM: { currency: 'usdtarb', label: 'USDT (Arbitrum)', networkName: 'Arbitrum One' },
};

export interface NowPaymentsInvoiceResponse {
  id: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: string;
  invoice_url: string;
  created_at: string;
}

export interface NowPaymentsUsdtPaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  network: UsdtNetwork;
  networkName: string;
  qrCodeUrl: string;
  price_amount: number;
  order_id: string;
  invoice_url?: string;
  created_at: string;
}

/**
 * Create a direct USDT cryptocurrency deposit with address and QR code
 * Exclusively supports USDT across all major blockchains (TRC20, BEP20, SOL, MATIC, ERC20, TON, ARB)
 */
export async function createNowPaymentsUsdtPayment(params: {
  amountUSD: number;
  organizationId: string;
  network: UsdtNetwork;
  ipnCallbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<NowPaymentsUsdtPaymentResponse> {
  const { amountUSD, organizationId, network, ipnCallbackUrl, successUrl, cancelUrl } = params;
  const netConfig = USDT_NETWORK_CONFIG[network] || USDT_NETWORK_CONFIG.TRC20;
  const orderId = `CP_USDT_${network}_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (!NOWPAYMENTS_API_KEY || NOWPAYMENTS_API_KEY.includes('dummy')) {
    logger.warn({ orderId, amountUSD, network }, 'NOWPAYMENTS_API_KEY is not configured on server');
    throw new Error(
      'NOWPayments crypto gateway is not configured. Please add NOWPAYMENTS_API_KEY to your Render environment variables.'
    );
  }

  try {
    // 1. Attempt direct payment endpoint to obtain dedicated deposit address
    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amountUSD,
        price_currency: 'usd',
        pay_currency: netConfig.currency,
        order_id: orderId,
        order_description: `CallPulse Wallet Top-up ($${amountUSD.toFixed(2)} USD via ${netConfig.label})`,
        ipn_callback_url: ipnCallbackUrl,
      }),
    });

    const data = (await response.json()) as any;

    if (response.ok && data.pay_address) {
      const payAddress = data.pay_address;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        payAddress
      )}`;

      logger.info(
        { orderId, paymentId: data.payment_id, network, payAddress },
        'NOWPayments direct USDT payment generated'
      );

      return {
        payment_id: String(data.payment_id),
        payment_status: data.payment_status || 'waiting',
        pay_address: payAddress,
        pay_amount: data.pay_amount || amountUSD,
        pay_currency: netConfig.currency,
        network,
        networkName: netConfig.networkName,
        qrCodeUrl,
        price_amount: amountUSD,
        order_id: orderId,
        created_at: data.created_at || new Date().toISOString(),
      };
    }

    // 2. Fallback to invoice endpoint if custody payment is not enabled on account
    logger.info({ orderId, network, data }, 'Fallback to NOWPayments invoice for USDT payment');
    const invRes = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amountUSD,
        price_currency: 'usd',
        pay_currency: netConfig.currency,
        order_id: orderId,
        order_description: `CallPulse Wallet Top-up ($${amountUSD.toFixed(2)} USD via ${netConfig.label})`,
        ipn_callback_url: ipnCallbackUrl,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    const invData = (await invRes.json()) as any;
    if (!invRes.ok || !invData.invoice_url) {
      throw new Error(invData.message || data.message || 'Failed to create USDT payment');
    }

    const payAddress = invData.pay_address || invData.invoice_url;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
      invData.invoice_url
    )}`;

    return {
      payment_id: String(invData.id),
      payment_status: 'waiting',
      pay_address: payAddress,
      pay_amount: amountUSD,
      pay_currency: netConfig.currency,
      network,
      networkName: netConfig.networkName,
      qrCodeUrl,
      price_amount: amountUSD,
      order_id: orderId,
      invoice_url: invData.invoice_url,
      created_at: invData.created_at || new Date().toISOString(),
    };
  } catch (err: any) {
    logger.error({ err: err.message, orderId, network }, 'NOWPayments USDT payment request failed');
    throw err;
  }
}

/**
 * Create a crypto invoice via NOWPayments (Legacy helper)
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
        pay_currency: 'usdttrc20',
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

