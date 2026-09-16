// ==============================================
// Outbound Call Route with Agent Branding & Hold Music
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import { initiateOutboundCall, hangupCall, getCallDetails } from '@/services/twilio/client.service';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/phone';
import { initializeCallState, clearCallState, setCallLatestStatus, getCallLatestStatus } from '@/services/cache';
import { findOrCreateContact, createCommunication, getCommunicationByTwilioSid, updateCommunication } from '@/services/database';

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
        const host = (request.headers['x-forwarded-host'] as string) || request.headers.host;
        const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
        const effectiveBaseUrl = (host && !host.includes('localhost') && !host.includes('127.0.0.1'))
          ? `${proto}://${host}`
          : (config.baseUrl && !config.baseUrl.includes('localhost') ? config.baseUrl : 'https://vertext.site');

        const queryParams = new URLSearchParams({
          agentName: agentName || 'Customer Specialist',
          companyName: companyName || 'Vertex AI',
          to: toNumber,
          orgId: organizationId || '',
        });

        const twimlUrl = `${effectiveBaseUrl}/api/v1/voice/twiml/outbound?${queryParams.toString()}`;

        const result = await initiateOutboundCall({
          to: toNumber,
          from: fromNumber,
          url: twimlUrl,
          statusCallback: `${effectiveBaseUrl}/api/v1/voice/status`,
        });

        // Initialize communication and call state for every call
        const targetOrgId = organizationId || '00000000-0000-0000-0000-000000000000';
        try {
          const contact = await findOrCreateContact(targetOrgId, toNumber);
          const comm = await createCommunication({
            organizationId: targetOrgId,
            contactId: contact.id,
            type: 'voice_out',
            twilioSid: result.callSid,
            fromNumber,
            toNumber,
            status: result.status || 'in-progress',
          });
          await initializeCallState(result.callSid, targetOrgId, contact.id, comm.id);
          await setCallLatestStatus(result.callSid, result.status || 'in-progress');
        } catch (err) {
          logger.debug({ err }, 'Note initializing DB record for outbound call');
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

  // POST /api/v1/voice/hangup - Terminate active call immediately (from dialer or dashboard)
  fastify.post<{
    Body: { callSid?: string; CallSid?: string };
  }>('/hangup', async (request, reply) => {
    const body = (request.body as any) || (request.query as any) || {};
    const callSid = body.callSid || body.CallSid;

    if (!callSid) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'callSid is required to terminate call',
        statusCode: 400,
      });
    }

    logger.info({ callSid }, 'Received immediate call hangup command');

    // 1. Terminate call leg on Twilio (disconnects phone carrier instantly)
    await hangupCall({ callSid });

    // 2. Set terminal state in cache & clear active context
    await setCallLatestStatus(callSid, 'completed');
    await clearCallState(callSid);

    // 3. Update communication record if found
    try {
      const comm = await getCommunicationByTwilioSid(callSid);
      if (comm) {
        await updateCommunication(comm.id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.debug({ err, callSid }, 'Note updating communication on hangup');
    }

    return reply.status(200).send({
      success: true,
      callSid,
      status: 'completed',
      message: 'Call ended immediately',
    });
  });

  // GET /api/v1/voice/call-status - Real-time call status poller for frontend
  fastify.get<{
    Querystring: { callSid: string };
  }>('/call-status', async (request, reply) => {
    const query = (request.query as any) || {};
    const callSid = query.callSid;

    if (!callSid) {
      return reply.status(400).send({ error: 'callSid is required' });
    }

    // 1. Check cached status
    const cachedStatus = await getCallLatestStatus(callSid);
    if (cachedStatus) {
      const isActive = ['queued', 'ringing', 'in-progress'].includes(cachedStatus);
      return reply.status(200).send({
        callSid,
        status: cachedStatus,
        active: isActive,
      });
    }

    // 2. Check Twilio live status
    try {
      const details = await getCallDetails({ callSid });
      const isActive = ['queued', 'ringing', 'in-progress'].includes(details.status);
      await setCallLatestStatus(callSid, details.status);
      return reply.status(200).send({
        callSid,
        status: details.status,
        active: isActive,
        duration: details.duration,
      });
    } catch {
      return reply.status(200).send({
        callSid,
        status: 'completed',
        active: false,
      });
    }
  });

  // TwiML for outbound call when recipient answers
  fastify.all('/twiml/outbound', async (request, reply) => {
    const query = (request.query as any) || {};
    const body = (request.body as any) || {};
    const agentName = query.agentName || body.agentName || 'Our specialist';
    const companyName = query.companyName || body.companyName || 'Vertex AI';
    const host = (request.headers['x-forwarded-host'] as string) || request.headers.host;
    const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
    const effectiveBaseUrl = (host && !host.includes('localhost') && !host.includes('127.0.0.1'))
      ? `${proto}://${host}`
      : (config.baseUrl && !config.baseUrl.includes('localhost') ? config.baseUrl : 'https://vertext.site');

    const turnUrl = `${effectiveBaseUrl}/api/v1/voice/turn`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Hello! This is ${escapeXml(agentName)} from ${escapeXml(companyName)} calling you.</Say>
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
