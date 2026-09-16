// ==============================================
// Outbound SMS Route
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import { sendSMS } from '@/services/twilio/client.service';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/phone';

const logger = createLogger('routes:sms:outbound');

export const outboundSmsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/sms/outbound - Send outbound SMS
  fastify.post<{
    Body: { to: string; body: string; from?: string };
  }>('/outbound', {
    schema: {
      body: {
        type: 'object',
        required: ['to', 'body'],
        properties: {
          to: { type: 'string' },
          body: { type: 'string' },
          from: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { to, body, from } = request.body;

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
      const fromNumber = normalizePhoneNumber(from || config.twilioPhoneNumber || '');

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
          body: body.trim(),
          statusCallback: `${config.baseUrl}/api/v1/sms/status`,
        });

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
