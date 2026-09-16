// ==============================================
// Outbound Call Route
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import { initiateOutboundCall } from '@/services/twilio/client.service';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/phone';

const logger = createLogger('routes:voice:outbound');

export const outboundCallRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/voice/outbound - Initiate outbound call
  fastify.post<{
    Body: { to: string; from?: string };
  }>('/outbound', {
    schema: {
      body: {
        type: 'object',
        required: ['to'],
        properties: {
          to: { type: 'string' },
          from: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { to, from } = request.body;

      if (!to || !to.trim()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Phone number to call is required',
          statusCode: 400,
        });
      }

      // Sanitize and normalize the numbers
      const toNumber = normalizePhoneNumber(to);
      const fromNumber = normalizePhoneNumber(from || config.twilioPhoneNumber || '');

      if (!fromNumber) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No caller ID configured. Set TWILIO_PHONE_NUMBER or NEXT_PUBLIC_TWILIO_PHONE.',
          statusCode: 400,
        });
      }

      logger.info({ to: toNumber, from: fromNumber }, 'Outbound call request');

      try {
        const result = await initiateOutboundCall({
          to: toNumber,
          from: fromNumber,
          url: `${config.baseUrl}/api/v1/voice/twiml/outbound`,
          statusCallback: `${config.baseUrl}/api/v1/voice/status`,
        });

        return reply.status(200).send({
          success: true,
          callSid: result.callSid,
          status: result.status,
          to: toNumber,
          from: fromNumber,
        });
      } catch (error: any) {
        logger.error({ error, to: toNumber }, 'Failed to initiate outbound call');

        let message = error.message || 'Failed to initiate call';
        if (message.includes('21215') || message.includes('not authorized to call')) {
          message = `Twilio Error 21215: Account not authorized to call ${toNumber}. International permissions are required in Twilio Console. Enable Kenya in Voice Geo-Permissions: https://www.twilio.com/console/voice/calls/geo-permissions/low-risk. Full detail: ${error.message}`;
        }

        return reply.status(500).send({
          error: 'Failed to initiate call',
          message,
          statusCode: 500,
        });
      }
    },
  });

  // POST /api/v1/voice/twiml/outbound - TwiML for outbound call
  fastify.post('/twiml/outbound', async (request, reply) => {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call. Please wait.</Say>
  <Dial callerId="${config.twilioPhoneNumber}">
    <Number>${(request.body as any)?.To || ''}</Number>
  </Dial>
</Response>`;

    reply.header('Content-Type', 'text/xml');
    return reply.send(twiml);
  });
};
