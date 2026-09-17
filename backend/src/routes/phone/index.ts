// ==============================================
// Phone Number Search & Provisioning Routes
// ==============================================

import { FastifyPluginAsync } from 'fastify';
import { createLogger } from '@/lib/logger';
import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { normalizePhoneNumber } from '@/lib/phone';
import { searchAvailablePhoneNumbers, purchasePhoneNumber } from '@/services/twilio';
import { setOrganizationCache } from '@/services/cache';
import { getOrganizationById } from '@/services/database';
import { getWalletSummary, debitWallet, creditWallet } from '@/services/database/wallet.service';

const logger = createLogger('routes:phone');

// Dedicated phone number price ($6.00/month flat)
const TOTAL_NUMBER_PRICE = 6.00;

export const phoneRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/phone/search - Search available phone numbers via Twilio API
  fastify.get<{
    Querystring: {
      country?: string;
      areaCode?: string;
      limit?: string;
    };
  }>('/search', async (request, reply) => {
    const { country = 'US', areaCode, limit } = request.query;

    logger.info({ country, areaCode }, 'Searching available phone numbers');

    try {
      const numbers = await searchAvailablePhoneNumbers({
        countryCode: country,
        areaCode: areaCode || undefined,
        limit: limit ? parseInt(limit, 10) : 10,
      });

      return reply.status(200).send({
        numbers,
        total: numbers.length,
        pricing: {
          price: TOTAL_NUMBER_PRICE,
          currency: 'USD',
          period: 'monthly',
        },
      });
    } catch (err: any) {
      logger.error({ err, country, areaCode }, 'Failed to search available numbers');
      return reply.status(500).send({
        error: 'Search Failed',
        message: err.message || 'Failed to search available phone numbers',
      });
    }
  });

  // POST /api/v1/phone/provision - Purchase phone number from Twilio and bind to merchant organization
  fastify.post<{
    Body: {
      phoneNumber: string;
      organizationId: string;
    };
  }>('/provision', async (request, reply) => {
    const { phoneNumber, organizationId } = request.body || {};

    if (!phoneNumber || !organizationId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'phoneNumber and organizationId are required',
      });
    }

    const normalizedNumber = normalizePhoneNumber(phoneNumber);

    logger.info(
      { phoneNumber: normalizedNumber, organizationId },
      'Provisioning dedicated phone number for organization'
    );

    // 1. Verify organization wallet has sufficient balance ($6.00 USD)
    const wallet = await getWalletSummary(organizationId);
    if (wallet.balance < TOTAL_NUMBER_PRICE) {
      return reply.status(402).send({
        error: 'Payment Required',
        requiredAmount: TOTAL_NUMBER_PRICE,
        currentBalance: wallet.balance,
        message: `Dedicated business phone number requires $${TOTAL_NUMBER_PRICE.toFixed(2)} USD/month. Your current balance is $${wallet.balance.toFixed(2)}. Please recharge your wallet.`,
      });
    }

    // 2. Debit wallet
    await debitWallet({
      organizationId,
      amount: TOTAL_NUMBER_PRICE,
      type: 'number_purchase',
      description: `Dedicated Business Phone (${normalizedNumber})`,
      metadata: {
        phoneNumber: normalizedNumber,
        price: TOTAL_NUMBER_PRICE,
      },
    });

    try {
      const host = (request.headers['x-forwarded-host'] as string) || request.headers.host;
      const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
      const effectiveBaseUrl =
        host && !host.includes('localhost') && !host.includes('127.0.0.1')
          ? `${proto}://${host}`
          : config.baseUrl && !config.baseUrl.includes('localhost')
          ? config.baseUrl
          : 'https://vertext.site';

      // 3. Purchase phone number on Twilio with webhooks configured
      let purchaseResult;
      try {
        purchaseResult = await purchasePhoneNumber({
          phoneNumber: normalizedNumber,
          organizationId,
          webhookBaseUrl: effectiveBaseUrl,
        });
      } catch (purchaseErr: any) {
        // Refund wallet if Twilio purchase failed
        await creditWallet({
          organizationId,
          amount: TOTAL_NUMBER_PRICE,
          paymentGateway: 'wallet',
          description: `Refund: Dedicated Phone Provisioning failed for ${normalizedNumber}`,
        });
        throw purchaseErr;
      }

      // 2. Fetch existing organization metadata
      const org = await getOrganizationById(organizationId);
      const existingMeta = (org as any)?.metadata || {};

      // 3. Update organization's twilio_phone_number in Supabase
      const { data: updatedOrg, error: updateErr } = await supabase
        .from('organizations')
        .update({
          twilio_phone_number: purchaseResult.phoneNumber,
          metadata: {
            ...existingMeta,
            dedicated_number: true,
            dedicated_phone: purchaseResult.phoneNumber,
            twilio_number_sid: purchaseResult.sid,
            provisioned_at: new Date().toISOString(),
            monthly_number_fee: TOTAL_NUMBER_PRICE,
            next_number_billing_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            number_billing_status: 'active',
          },
        })
        .eq('id', organizationId)
        .select()
        .single();

      if (updateErr) {
        logger.error({ updateErr, organizationId }, 'Error updating organization with purchased number');
        // Still return success since the number was purchased
      } else if (updatedOrg) {
        await setOrganizationCache(updatedOrg);
      }

      logger.info(
        { organizationId, phoneNumber: purchaseResult.phoneNumber },
        'Dedicated phone number provisioned and bound successfully'
      );

      return reply.status(200).send({
        success: true,
        phoneNumber: purchaseResult.phoneNumber,
        sid: purchaseResult.sid,
        organizationId,
        message: `Successfully provisioned ${purchaseResult.phoneNumber} as your dedicated business line.`,
      });
    } catch (err: any) {
      logger.error({ err, phoneNumber, organizationId }, 'Failed to provision phone number');
      return reply.status(500).send({
        error: 'Provisioning Failed',
        message: err.message || 'Failed to purchase and configure phone number on Twilio',
      });
    }
  });

  // POST /api/v1/phone/set-number - Directly assign a phone number to organization
  fastify.post<{
    Body: {
      phoneNumber: string;
      organizationId: string;
    };
  }>('/set-number', async (request, reply) => {
    const { phoneNumber, organizationId } = request.body || {};

    if (!phoneNumber || !organizationId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'phoneNumber and organizationId are required',
      });
    }

    const normalizedNumber = normalizePhoneNumber(phoneNumber);

    try {
      const { data: updatedOrg, error } = await supabase
        .from('organizations')
        .update({
          twilio_phone_number: normalizedNumber,
        })
        .eq('id', organizationId)
        .select()
        .single();

      if (error) throw error;
      if (updatedOrg) await setOrganizationCache(updatedOrg);

      return reply.status(200).send({
        success: true,
        phoneNumber: normalizedNumber,
        organizationId,
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Failed to update phone number',
        message: err.message,
      });
    }
  });
};
