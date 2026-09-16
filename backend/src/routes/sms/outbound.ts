// ==============================================
// Outbound SMS Route
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import { sendSMS } from '@/services/twilio/client.service';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/phone';
import { createCommunication, findOrCreateContact } from '@/services/database';

const logger = createLogger('routes:sms:outbound');
const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID || 'MG984675f67f60f82d8b1d647e94841e9b';

export const outboundSmsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/sms/outbound - Send outbound SMS
  fastify.post<{
    Body: { to: string; body: string; from?: string; organizationId?: string };
  }>('/outbound', {
    schema: {
      body: {
        type: 'object',
        required: ['to', 'body'],
        properties: {
          to: { type: 'string' },
          body: { type: 'string' },
          from: { type: 'string' },
          organizationId: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { to, body, from, organizationId } = request.body;

      if (!to || !to.trim()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Phone number (to) is required',
          statusCode: 400,
        });
      }

      if (!body || !body.trim()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'SMS message body cannot be empty',
          statusCode: 400,
        });
      }

      const toNumber = normalizePhoneNumber(to);
      const fromNumber = normalizePhoneNumber(from || config.twilioPhoneNumber || '+12513571708');

      if (!fromNumber) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No sender phone number configured. Set TWILIO_PHONE_NUMBER or NEXT_PUBLIC_TWILIO_PHONE.',
          statusCode: 400,
        });
      }

      logger.info({ to: toNumber, from: fromNumber, bodyLength: body.length }, 'Outbound SMS request');

      try {
        const result = await sendSMS({
          to: toNumber,
          from: fromNumber,
          messagingServiceSid: MESSAGING_SERVICE_SID,
          body: body.trim(),
          statusCallback: `${config.baseUrl}/api/v1/sms/status`,
        });

        // Record in database for inbox & history tracking
        try {
          const contact = await findOrCreateContact(organizationId || '', toNumber);
          await createCommunication({
            organizationId: organizationId || '',
            contactId: contact?.id,
            type: 'sms_out',
            twilioSid: result.messageSid,
            fromNumber,
            toNumber,
            status: result.status || 'sent',
          });
        } catch (dbErr: any) {
          logger.warn({ dbErr: dbErr?.message }, 'Failed to record outbound SMS to DB (non-fatal)');
        }

        return reply.status(200).send({
          success: true,
          messageSid: result.messageSid,
          status: result.status,
          to: toNumber,
          from: fromNumber,
        });
      } catch (error: any) {
        logger.error({ error, to: toNumber }, 'Failed to send outbound SMS');

        let message = error.message || 'Failed to send SMS';
        // Check for common Twilio Geo-permission or number restriction errors
        if (message.includes('21612') || message.includes('combination of')) {
          message = `Twilio Error 21612: Destination number cannot receive SMS from this Twilio number. For international destinations like Kenya (+254), enable SMS Geo-Permissions in Twilio Console (Messaging > Settings > Geo-Permissions). Details: ${error.message}`;
        }

        return reply.status(500).send({
          error: 'Failed to send SMS',
          message,
          statusCode: 500,
        });
      }
    },
  });
};
