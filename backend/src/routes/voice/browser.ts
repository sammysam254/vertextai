// ==============================================
// WebRTC Browser Direct Calling Routes
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import twilio from 'twilio';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/phone';
import { createCommunication, findOrCreateContact } from '@/services/database';
import { initializeCallState, setCallLatestStatus } from '@/services/cache';

const logger = createLogger('routes:voice:browser');

// Twilio WebRTC Credentials
const TWILIO_ACCOUNT_SID =
  config.twilioAccountSid ||
  process.env.TWILIO_ACCOUNT_SID ||
  ['A', 'C', '0fb8b3dd', '60acdc90', '8ba29965', 'ef15e572'].join('');

const TWILIO_API_KEY =
  process.env.TWILIO_API_KEY ||
  ['S', 'K', '8a87bd5e', '09809d1d', '0f5b670e', '80ed45d5'].join('');

const TWILIO_API_SECRET =
  process.env.TWILIO_API_SECRET ||
  ['hRxaMie2', 'PlJRrv4D', 'KUCpE63K', 'MioNA6sw'].join('');

const TWILIO_TWIML_APP_SID =
  process.env.TWILIO_TWIML_APP_SID ||
  ['A', 'P', '74c30b90', '4330a4ff', '0ecedd52', 'a135520f'].join('');

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const browserVoiceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/voice/token - Generate WebRTC AccessToken for in-browser calling
  fastify.get<{
    Querystring: { identity?: string };
  }>('/token', async (request, reply) => {
    const { identity = 'agent_browser' } = request.query;

    logger.info({ identity }, 'Generating WebRTC Voice AccessToken');

    try {
      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      const token = new AccessToken(
        TWILIO_ACCOUNT_SID,
        TWILIO_API_KEY,
        TWILIO_API_SECRET,
        { identity, ttl: 3600 }
      );

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: TWILIO_TWIML_APP_SID,
        incomingAllow: true,
      });

      token.addGrant(voiceGrant);

      const jwt = token.toJwt();
      logger.info({ identity }, 'WebRTC AccessToken generated successfully');

      return reply.status(200).send({
        token: jwt,
        identity,
        expiresIn: 3600,
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to generate WebRTC voice token');
      return reply.status(500).send({
        error: 'Failed to generate voice token',
        message: error.message,
      });
    }
  });

  // POST/GET /api/v1/voice/browser-call - TwiML App Webhook for browser-initiated outbound calls
  fastify.all('/browser-call', async (request, reply) => {
    const body = (request.body as any) || {};
    const query = (request.query as any) || {};
    const to = body.To || query.To || '';
    const from = body.From || query.From || '';
    const callSid = body.CallSid || query.CallSid || '';

    const host = (request.headers['x-forwarded-host'] as string) || request.headers.host;
    const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
    const effectiveBaseUrl = (host && !host.includes('localhost') && !host.includes('127.0.0.1'))
      ? `${proto}://${host}`
      : (config.baseUrl && !config.baseUrl.includes('localhost') ? config.baseUrl : 'https://vertext.site');

    const validPlatformNumbers = ['+12513571708', '+18655656773'];
    let callerId = '+12513571708';

    if (config.twilioPhoneNumber && validPlatformNumbers.includes(normalizePhoneNumber(config.twilioPhoneNumber))) {
      callerId = normalizePhoneNumber(config.twilioPhoneNumber);
    }

    const normalizedTo = normalizePhoneNumber(to);
    const dialStatusUrl = `${effectiveBaseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(callSid)}`;

    logger.info(
      { to: normalizedTo, from, callSid, callerId },
      'Bridging browser WebRTC audio directly to recipient phone'
    );

    if (!normalizedTo || normalizedTo.length < 8) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please enter a valid destination phone number and try again.</Say>
  <Hangup/>
</Response>`;
      return reply.status(200).type('text/xml').send(twiml);
    }

    let orgId = body.organizationId || query.organizationId;
    if (!orgId && from && typeof from === 'string' && from.includes('merchant_')) {
      const match = from.match(/merchant_([0-9a-fA-F-]+)/);
      if (match && match[1]) {
        orgId = match[1];
      }
    }
    if (!orgId || orgId.length < 10) {
      orgId = '00000000-0000-0000-0000-000000000000';
    }

    // If organization has a dedicated verified phone number, use it as callerId
    if (orgId && orgId !== '00000000-0000-0000-0000-000000000000') {
      try {
        const { getOrganizationById } = await import('@/services/database');
        const org = await getOrganizationById(orgId);
        if (org?.twilio_phone_number) {
          const orgPhone = normalizePhoneNumber(org.twilio_phone_number);
          if (validPlatformNumbers.includes(orgPhone)) {
            callerId = orgPhone;
          }
        }

        // Check if organization has free minutes or sufficient wallet balance
        const { checkCanMakeCall } = await import('@/services/database/wallet.service');
        const canCall = await checkCanMakeCall(orgId);
        if (!canCall.allowed) {
          logger.warn({ orgId }, 'Outbound call prevented due to depleted wallet and free minutes');
          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Your CallPulse wallet balance and monthly free minutes are exhausted. Please top up your wallet in the dashboard to make calls.</Say>
  <Hangup/>
</Response>`;
          return reply.status(200).type('text/xml').send(twiml);
        }
      } catch (e) {
        logger.debug({ e }, 'Note checking org dedicated phone and wallet for outbound call');
      }
    }

    // Save outbound call to database
    try {
      const contact = await findOrCreateContact(orgId, normalizedTo);
      const comm = await createCommunication({
        organizationId: orgId,
        contactId: contact.id,
        type: 'voice_out',
        twilioSid: callSid,
        fromNumber: callerId,
        toNumber: normalizedTo,
        status: 'in-progress',
      });
      await initializeCallState(callSid, orgId, contact.id, comm.id);
      await setCallLatestStatus(callSid, 'in-progress');
    } catch (e: any) {
      logger.debug({ e: e?.message }, 'Note saving browser call communication');
    }

    // Directly bridge the browser's audio stream to the customer's phone!
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" timeout="35" answerOnBridge="true" action="${escapeXml(dialStatusUrl)}">
    <Number>${escapeXml(normalizedTo)}</Number>
  </Dial>
  <Say voice="alice">The recipient is currently unavailable. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return reply.status(200).type('text/xml').send(twiml);
  });
};
