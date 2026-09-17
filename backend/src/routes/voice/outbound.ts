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

      // Verify wallet balance and call authorization
      const targetOrgId = organizationId || '00000000-0000-0000-0000-000000000000';
      try {
        const { calculateCallLimit } = await import('@/services/database/wallet.service');
        const limit = await calculateCallLimit(targetOrgId, toNumber);
        if (!limit.allowed) {
          return reply.status(402).send({
            error: 'Payment Required',
            message: limit.reason || 'Your CallPulse wallet balance is insufficient to place this call.',
            balance: limit.balance,
            ratePerMinute: limit.ratePerMinute,
            statusCode: 402,
          });
        }
      } catch (limitErr: any) {
        logger.debug({ limitErr: limitErr?.message }, 'Note calculating outbound call limit');
      }

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
          orgId: targetOrgId,
        });

        const twimlUrl = `${effectiveBaseUrl}/api/v1/voice/twiml/outbound?${queryParams.toString()}`;

        const result = await initiateOutboundCall({
          to: toNumber,
          from: fromNumber,
          url: twimlUrl,
          statusCallback: `${effectiveBaseUrl}/api/v1/voice/status`,
        });

        // Initialize communication and call state for every call
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
        } catch (dbError) {
          logger.error({ dbError, callSid: result.callSid }, 'Failed to save communication record');
        }

        return reply.status(200).send({
          success: true,
          callSid: result.callSid,
          status: result.status,
          message: 'Call initiated successfully',
        });
      } catch (error: any) {
        logger.error({ error, to: toNumber, from: fromNumber }, 'Failed to initiate outbound call');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error.message || 'Failed to place outbound call',
          statusCode: 500,
        });
      }
    },
  });

  // POST /api/v1/voice/hangup - Hangup active call immediately
  fastify.post<{
    Body: { callSid: string };
  }>('/hangup', async (request, reply) => {
    const { callSid } = request.body || {};

    if (!callSid) {
      return reply.status(400).send({ error: 'callSid is required' });
    }

    logger.info({ callSid }, 'Manual hangup requested');

    try {
      await hangupCall({ callSid });
    } catch (err: any) {
      logger.debug({ err: err.message, callSid }, 'Note executing carrier hangup');
    }

    await clearCallState(callSid);
    await setCallLatestStatus(callSid, 'completed');

    return reply.status(200).send({
      success: true,
      callSid,
      message: 'Call ended immediately',
    });
  });

  // GET /api/v1/voice/call-status - Real-time call status poller for frontend with mid-call billing & auto-disconnect
  fastify.get<{
    Querystring: { callSid: string };
  }>('/call-status', async (request, reply) => {
    const query = (request.query as any) || {};
    const callSid = query.callSid;

    if (!callSid) {
      return reply.status(400).send({ error: 'callSid is required' });
    }

    const { getCallState, setCallState } = await import('@/services/cache');

    // 1. Check cached status
    const cachedStatus = await getCallLatestStatus(callSid);
    let isActive = ['queued', 'ringing', 'in-progress'].includes(cachedStatus || '');

    // Get call state to track duration and organization
    const callState = await getCallState(callSid);
    let durationSeconds = 0;
    if (callState?.startTime) {
      durationSeconds = Math.floor((Date.now() - callState.startTime) / 1000);
    }

    // If active and we have an organization, run mid-call billing check!
    let currentBalance: number | undefined;
    let shouldDisconnect = false;
    let disconnectReason: string | undefined;

    if (isActive && callState?.organizationId && durationSeconds > 0) {
      try {
        const { billIncrementalCallUsage } = await import('@/services/database/wallet.service');
        const comm = await getCommunicationByTwilioSid(callSid);
        const destination = comm?.to_number;
        const prevBilled = (callState as any).previouslyBilledMinutes || 0;

        const billRes = await billIncrementalCallUsage({
          organizationId: callState.organizationId,
          callSid,
          elapsedSeconds: durationSeconds,
          previouslyBilledMinutes: prevBilled,
          destinationPhone: destination,
        });

        currentBalance = billRes.remainingBalance;
        (callState as any).previouslyBilledMinutes = billRes.newBilledMinutes;
        await setCallState(callSid, callState);

        if (billRes.shouldDisconnect) {
          shouldDisconnect = true;
          disconnectReason = billRes.reason || 'Wallet balance depleted.';
        }
      } catch (e: any) {
        logger.debug({ e: e?.message }, 'Mid-call billing check');
      }
    }

    // If balance ran out, hang up immediately!
    if (shouldDisconnect) {
      logger.warn({ callSid, disconnectReason }, 'Disconnecting active call immediately due to depleted balance');
      try {
        await hangupCall({ callSid });
      } catch (err: any) {
        logger.debug({ err: err?.message }, 'Call hangup notice');
      }
      await setCallLatestStatus(callSid, 'completed');

      return reply.status(200).send({
        callSid,
        status: 'completed',
        active: false,
        duration: durationSeconds,
        balance: currentBalance || 0,
        disconnectedDueToBalance: true,
        reason: disconnectReason || 'Call terminated: Wallet balance depleted.',
      });
    }

    if (cachedStatus) {
      return reply.status(200).send({
        callSid,
        status: cachedStatus,
        active: isActive,
        duration: durationSeconds,
        balance: currentBalance,
      });
    }

    // 2. Check Twilio live status
    try {
      const details = await getCallDetails({ callSid });
      const liveActive = ['queued', 'ringing', 'in-progress'].includes(details.status);
      await setCallLatestStatus(callSid, details.status);
      return reply.status(200).send({
        callSid,
        status: details.status,
        active: liveActive,
        duration: details.duration || durationSeconds,
        balance: currentBalance,
      });
    } catch {
      return reply.status(200).send({
        callSid,
        status: 'completed',
        active: false,
        balance: currentBalance,
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
  <Say voice="alice">Hello! This is ${escapeXml(agentName)} from ${escapeXml(companyName)} calling you.</Say>
  <Gather action="${escapeXml(turnUrl)}" input="speech dtmf" method="POST" speechTimeout="auto" timeout="5" numDigits="1">
    <Say voice="alice">How can we assist you today? You can speak freely or press 0 to speak with a human agent.</Say>
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
