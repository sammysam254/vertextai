import { FastifyPluginAsync } from 'fastify';
import { createLogger } from '@/lib/logger';
import { config } from '@/lib/config';
import {
  getWalletSummary,
  creditWallet,
  recordPendingDeposit,
  confirmPendingDeposit,
  processMonthlyNumberRenewals,
  listWalletTransactions,
} from '@/services/database/wallet.service';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from '@/services/billing/paystack.service';
import {
  createNowPaymentsInvoice,
  getNowPaymentsPaymentStatus,
  verifyNowPaymentsSignature,
} from '@/services/billing/nowpayments.service';

const logger = createLogger('routes:billing');

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/billing/wallet - Retrieve wallet summary and transaction history
  fastify.get<{
    Querystring: { organizationId: string; limit?: string; offset?: string };
  }>('/wallet', async (request, reply) => {
    const { organizationId, limit = '20', offset = '0' } = request.query;

    if (!organizationId) {
      return reply.status(400).send({ error: 'organizationId is required' });
    }

    try {
      // Check and process any due monthly number renewals
      try {
        await processMonthlyNumberRenewals();
      } catch (renewalErr) {
        logger.debug({ renewalErr }, 'Background renewal check completed');
      }

      const summary = await getWalletSummary(organizationId);
      const { transactions, total } = await listWalletTransactions(
        organizationId,
        parseInt(limit, 10),
        parseInt(offset, 10)
      );

      return reply.status(200).send({
        ...summary,
        transactions,
        totalTransactions: total,
      });
    } catch (err: any) {
      logger.error({ err, organizationId }, 'Failed to fetch wallet info');
      return reply.status(500).send({ error: 'Failed to retrieve wallet information' });
    }
  });

  // POST /api/v1/billing/paystack/initialize - Start Card / M-Pesa checkout
  fastify.post<{
    Body: {
      organizationId: string;
      amountUSD: number;
      email: string;
      callbackUrl?: string;
    };
  }>('/paystack/initialize', async (request, reply) => {
    const { organizationId, amountUSD, email, callbackUrl } = request.body || {};

    if (!organizationId || !amountUSD || !email) {
      return reply.status(400).send({
        error: 'organizationId, amountUSD, and email are required',
      });
    }

    if (amountUSD < 1) {
      return reply.status(400).send({
        error: 'Minimum top-up amount is $1.00 USD',
      });
    }

    try {
      const result = await initializePaystackTransaction({
        organizationId,
        amountUSD: Number(amountUSD),
        email,
        callbackUrl,
      });

      // Record pending deposit in ledger (not credited until confirmed)
      await recordPendingDeposit({
        organizationId,
        amount: Number(amountUSD),
        paymentGateway: 'paystack',
        paymentReference: result.reference,
        description: `Paystack Deposit ($${Number(amountUSD).toFixed(2)} USD) (Pending Confirmation)`,
        metadata: {
          accessCode: result.access_code,
          email,
        },
      });

      return reply.status(200).send({
        success: true,
        ...result,
      });
    } catch (err: any) {
      logger.error({ err, organizationId, amountUSD }, 'Failed to initialize Paystack checkout');
      return reply.status(500).send({
        error: 'Failed to initiate checkout with Paystack',
        message: err.message,
      });
    }
  });

  // POST /api/v1/billing/paystack/verify - Verify and credit wallet upon checkout completion
  // ONLY credits wallet when Paystack API returns status === 'success'
  fastify.post<{
    Body: {
      reference: string;
      organizationId: string;
    };
  }>('/paystack/verify', async (request, reply) => {
    const { reference, organizationId } = request.body || {};

    if (!reference || !organizationId) {
      return reply.status(400).send({ error: 'reference and organizationId are required' });
    }

    try {
      const verification = await verifyPaystackTransaction(reference);

      if (!verification.success) {
        return reply.status(400).send({
          error: 'Verification Failed',
          message: verification.error || 'Payment was not confirmed as successful by Paystack. No funds have been added to your wallet.',
        });
      }

      // Strictly credit wallet only after verified success
      const creditRes = await creditWallet({
        organizationId,
        amount: verification.amountUSD,
        paymentGateway: 'paystack',
        paymentReference: reference,
        description: `Paystack Top-up ($${verification.amountUSD.toFixed(2)} USD via ${verification.channel || 'card'}) (Confirmed)`,
        metadata: {
          gateway: 'paystack',
          reference,
          channel: verification.channel,
          verifiedAt: new Date().toISOString(),
        },
      });

      return reply.status(200).send({
        success: true,
        amountCredited: verification.amountUSD,
        newBalance: creditRes.newBalance,
        message: `Payment confirmed! Successfully credited $${verification.amountUSD.toFixed(2)} USD to your wallet!`,
      });
    } catch (err: any) {
      logger.error({ err, reference, organizationId }, 'Failed to verify Paystack payment');
      return reply.status(500).send({
        error: 'Payment verification failed',
        message: err.message,
      });
    }
  });

  // POST /api/v1/billing/paystack/webhook - Webhook listener for Paystack
  fastify.post('/paystack/webhook', async (request, reply) => {
    const signature = (request.headers['x-paystack-signature'] as string) || '';
    const rawBody = (request as any).rawBody || JSON.stringify(request.body || {});

    // Verify webhook signature if secret key is present
    if (process.env.PAYSTACK_SECRET_KEY) {
      const isSigValid = verifyPaystackWebhookSignature(rawBody, signature);
      if (!isSigValid) {
        logger.warn({ signature }, 'Invalid Paystack webhook signature');
        return reply.status(400).send({ error: 'Invalid webhook signature' });
      }
    }

    const body = (request.body as any) || {};
    const event = body.event;

    // ONLY credit on successful confirmed charge
    if (event === 'charge.success' && body.data?.status === 'success') {
      const data = body.data;
      const reference = data.reference;
      const orgId = data.metadata?.organizationId;
      const amountUSD = data.metadata?.amountUSD
        ? parseFloat(data.metadata.amountUSD)
        : data.amount / 100;

      if (orgId && reference) {
        try {
          await creditWallet({
            organizationId: orgId,
            amount: amountUSD,
            paymentGateway: 'paystack',
            paymentReference: reference,
            description: `Paystack Webhook Top-up ($${amountUSD.toFixed(2)} USD) (Confirmed)`,
            metadata: { webhookEvent: event, ...data.metadata, confirmedAt: new Date().toISOString() },
          });
          logger.info({ reference, orgId, amountUSD }, 'Wallet credited via confirmed Paystack webhook');
        } catch (creditErr) {
          logger.warn({ creditErr, reference }, 'Note processing Paystack webhook credit');
        }
      }
    }

    return reply.status(200).send({ received: true });
  });

  // POST /api/v1/billing/nowpayments/invoice - Generate Crypto invoice
  fastify.post<{
    Body: {
      organizationId: string;
      amountUSD: number;
      successUrl?: string;
      cancelUrl?: string;
    };
  }>('/nowpayments/invoice', async (request, reply) => {
    const { organizationId, amountUSD, successUrl, cancelUrl } = request.body || {};

    if (!organizationId || !amountUSD) {
      return reply.status(400).send({ error: 'organizationId and amountUSD are required' });
    }

    if (amountUSD < 2) {
      return reply.status(400).send({ error: 'Minimum crypto top-up amount is $2.00 USD' });
    }

    try {
      const host = (request.headers['x-forwarded-host'] as string) || request.headers.host;
      const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
      const effectiveBaseUrl =
        host && !host.includes('localhost') && !host.includes('127.0.0.1')
          ? `${proto}://${host}`
          : config.baseUrl && !config.baseUrl.includes('localhost')
          ? config.baseUrl
          : 'https://vertext.site';

      const invoice = await createNowPaymentsInvoice({
        amountUSD: Number(amountUSD),
        organizationId,
        orderDescription: `CallPulse Wallet Top-up ($${Number(amountUSD).toFixed(2)})`,
        ipnCallbackUrl: `${effectiveBaseUrl}/api/v1/billing/nowpayments/webhook`,
        successUrl,
        cancelUrl,
      });

      // Record pending deposit in ledger (wallet balance NOT credited yet)
      await recordPendingDeposit({
        organizationId,
        amount: Number(amountUSD),
        paymentGateway: 'nowpayments',
        paymentReference: String(invoice.id),
        description: `NOWPayments Crypto Deposit ($${Number(amountUSD).toFixed(2)} USD) (Pending Confirmation)`,
        metadata: {
          invoiceId: invoice.id,
          orderId: invoice.order_id,
          invoiceUrl: invoice.invoice_url,
        },
      });

      return reply.status(200).send({
        success: true,
        ...invoice,
      });
    } catch (err: any) {
      logger.error({ err, organizationId, amountUSD }, 'Failed to create NOWPayments invoice');
      return reply.status(500).send({
        error: 'Failed to create crypto invoice',
        message: err.message,
      });
    }
  });

  // GET /api/v1/billing/nowpayments/verify/:invoiceId - Check crypto payment status and credit if confirmed
  fastify.get<{
    Params: { invoiceId: string };
  }>('/nowpayments/verify/:invoiceId', async (request, reply) => {
    const { invoiceId } = request.params;

    if (!invoiceId) {
      return reply.status(400).send({ error: 'invoiceId is required' });
    }

    try {
      const statusRes = await getNowPaymentsPaymentStatus(invoiceId);

      if (!statusRes.confirmed) {
        return reply.status(200).send({
          confirmed: false,
          status: statusRes.status,
          message: `Payment status is '${statusRes.status}'. Balance will be credited once confirmed on blockchain.`,
        });
      }

      // Payment confirmed on blockchain -> credit wallet
      const confirmRes = await confirmPendingDeposit({
        paymentReference: invoiceId,
        confirmedAmount: statusRes.priceAmount,
        metadata: {
          nowpaymentsStatus: statusRes.status,
          actuallyPaid: statusRes.actuallyPaid,
          payCurrency: statusRes.payCurrency,
        },
      });

      if (!confirmRes.success) {
        return reply.status(400).send({
          confirmed: false,
          error: confirmRes.error || 'Failed to confirm deposit',
        });
      }

      return reply.status(200).send({
        confirmed: true,
        status: statusRes.status,
        newBalance: confirmRes.newBalance,
        message: 'Crypto deposit confirmed on blockchain! Wallet credited.',
      });
    } catch (err: any) {
      logger.error({ err, invoiceId }, 'Error verifying NOWPayments status');
      return reply.status(500).send({
        error: 'Failed to check crypto payment confirmation',
        message: err.message,
      });
    }
  });

  // POST /api/v1/billing/nowpayments/webhook - IPN Webhook for NOWPayments
  // ONLY credits wallet when signature matches AND payment_status is 'finished' or 'confirmed'
  fastify.post('/nowpayments/webhook', async (request, reply) => {
    const sig = (request.headers['x-nowpayments-sig'] as string) || '';
    const body = (request.body as any) || {};

    const isValid = verifyNowPaymentsSignature(body, sig);
    if (!isValid) {
      logger.warn({ sig }, 'Invalid NOWPayments IPN signature; rejecting webhook');
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    const { payment_status, actually_paid, price_amount, invoice_id, order_id } = body;

    // NOWPayments statuses for verified payment: 'finished' or 'confirmed'
    if (['finished', 'confirmed'].includes(payment_status)) {
      const creditedAmount = price_amount || actually_paid || 0;
      logger.info({ order_id, invoice_id, creditedAmount, payment_status }, 'NOWPayments payment confirmed by webhook');

      const ref = String(invoice_id || order_id);
      if (ref) {
        await confirmPendingDeposit({
          paymentReference: ref,
          confirmedAmount: Number(creditedAmount),
          metadata: {
            nowpaymentsWebhook: body,
            confirmedAt: new Date().toISOString(),
          },
        });
      }
    }

    return reply.status(200).send({ received: true });
  });

  // POST /api/v1/billing/renewals/trigger - Process monthly phone number renewals
  fastify.post('/renewals/trigger', async (request, reply) => {
    try {
      const res = await processMonthlyNumberRenewals();
      return reply.status(200).send({ success: true, ...res });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
};

