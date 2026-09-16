// ==============================================
// Outbound Call Route with Agent Branding & Hold Music
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import { initiateOutboundCall } from '@/services/twilio/client.service';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/phone';
import { initializeCallState } from '@/services/cache';
import { findOrCreateContact, createCommunication, getOrganizationById } from '@/services/database';

const logger = createLogger('routes:voice:outbound');

const HOLD_MUSIC_URL = 'http://com.twilio.sounds.music.s3.amazonaws.com/ClockworkWaltz.mp3';

export const outboundCallRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/voice/outbound - Initiate outbound call
  fastify.post<{
    Body: {
      to: string;
      from?: string;
      agentName?: string;
      companyName?: string;
      organizationId?: string;
    };
  }>('/outbound', {
    schema: {
      body: {
        type: 'object',
        required: ['to'],
        properties: {
          to: { type: 'string' },
          from: { type: 'string' },
          agentName: { type: 'string' },
          companyName: { type: 'string' },
          organizationId: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { to, from, agentName, companyName, organizationId } = request.body;

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

      logger.info({ to: toNumber, from: fromNumber, agentName, companyName }, 'Outbound call request');

      try {
        const queryParams = new URLSearchParams({
          agentName: agentName || 'Customer Specialist',
          companyName: companyName || 'Vertex AI',
          to: toNumber,
          orgId: organizationId || '',
        });

        const twimlUrl = `${config.baseUrl}/api/v1/voice/twiml/outbound?${queryParams.toString()}`;

        const result = await initiateOutboundCall({
          to: toNumber,
          from: fromNumber,
          url: twimlUrl,
          statusCallback: `${config.baseUrl}/api/v1/voice/status`,
        });

        // Initialize communication and call state if org context is provided
        if (organizationId) {
          try {
            const contact = await findOrCreateContact(organizationId, toNumber);
            const comm = await createCommunication({
              organizationId,
              contactId: contact.id,
              type: 'voice_out',
              twilioSid: result.callSid,
              fromNumber,
              toNumber,
              status: result.status || 'in-progress',
            });
            await initializeCallState(result.callSid, organizationId, contact.id, comm.id);
          } catch (err) {
            logger.warn({ err }, 'Could not initialize DB record for outbound call');
          }
        }

        return reply.status(200).send({
          success: true,
          callSid: result.callSid,
          status: result.status,
          to: toNumber,
          from: fromNumber,
          agentName,
          companyName,
        });
      } catch (error: any) {
        logger.error({ error, to: toNumber }, 'Failed to initiate outbound call');

        let message = error.message || 'Failed to initiate call';
        if (message.includes('21215') || message.includes('not authorized to call')) {
          message = `Twilio Error 21215: Account not authorized to call ${toNumber}. International permissions are required. Details: ${error.message}`;
        }

        return reply.status(500).send({
          error: 'Failed to initiate call',
          message,
          statusCode: 500,
        });
      }
    },
  });

  // TwiML for outbound call when recipient answers
  fastify.all('/twiml/outbound', async (request, reply) => {
    const query = (request.query as any) || {};
    const body = (request.body as any) || {};
    const agentName = query.agentName || body.agentName || 'Our specialist';
    const companyName = query.companyName || body.companyName || 'Vertex AI';
    const turnUrl = `${config.baseUrl}/api/v1/voice/turn`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Hello! This is ${escapeXml(agentName)} from ${escapeXml(companyName)} calling you. Please hold while we connect our live call.</Say>
  <Play>${HOLD_MUSIC_URL}</Play>
  <Gather action="${escapeXml(turnUrl)}" input="speech dtmf" method="POST" speechTimeout="auto" timeout="5" numDigits="1">
    <Say voice="Polly.Joanna-Neural">How can we assist you today? You can speak freely or press 0 to speak with a human agent.</Say>
  </Gather>
  <Redirect method="POST">${escapeXml(turnUrl)}</Redirect>
</Response>`;

    reply.header('Content-Type', 'text/xml');
    return reply.status(200).send(twiml);
  });
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
