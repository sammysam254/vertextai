// ==============================================
// Voice Incoming Call Webhook Handler with 6-Digit Merchant Routing & WebRTC Bridge
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import { config } from '@/lib/config';
import { normalizePhoneNumber } from '@/lib/phone';
import { getCachedOrganizationByPhone, setOrganizationCache } from '@/services/cache';
import {
  getOrganizationByPhone,
  getOrganizationByMerchantCode,
  findOrCreateContact,
  createCommunication,
} from '@/services/database';
import { initializeCallState, setCallLatestStatus } from '@/services/cache';
import type { TwilioVoiceWebhook } from '@/types';

const logger = createLogger('route:voice:incoming');

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Handle inbound voice call
 * POST /api/v1/voice/incoming
 */
export async function handleIncomingCall(
  request: FastifyRequest<{ Body: TwilioVoiceWebhook }>,
  reply: FastifyReply
) {
  const body = (request.body as any) || {};
  const query = (request.query as any) || {};
  const CallSid = body.CallSid || query.CallSid || '';
  const From = body.From || query.From || '';
  const To = body.To || query.To || '';

  const host = (request.headers['x-forwarded-host'] as string) || request.headers.host;
  const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
  const effectiveBaseUrl = (host && !host.includes('localhost') && !host.includes('127.0.0.1'))
    ? `${proto}://${host}`
    : (config.baseUrl && !config.baseUrl.includes('localhost') ? config.baseUrl : 'https://vertext.site');

  logger.info(
    { callSid: CallSid, from: From, to: To },
    'Inbound or WebRTC voice call received'
  );

  // ── 0. WebRTC Browser Client Outbound Calling ─────────────────────────────
  // If the call originates from a browser Twilio Client (starts with "client:")
  if (From && (From.startsWith('client:') || From.includes('agent_') || From.includes('merchant_'))) {
    logger.info(
      { from: From, to: To, callSid: CallSid },
      'Detected browser WebRTC client outbound call; bridging directly to recipient'
    );

    const normalizedTo = normalizePhoneNumber(To);
    let callerId = normalizePhoneNumber(config.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || '+12513571708');
    const dialStatusUrl = `${effectiveBaseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(CallSid)}`;

    if (!normalizedTo) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">No destination phone number was provided. Please check the number and try again.</Say>
  <Hangup/>
</Response>`;
      return reply.status(200).type('text/xml').send(twiml);
    }

    let orgId = body.organizationId || query.organizationId;
    if (!orgId && typeof From === 'string' && From.includes('merchant_')) {
      const match = From.match(/merchant_([0-9a-fA-F-]+)/);
      if (match && match[1]) {
        orgId = match[1];
      }
    }
    if (!orgId || orgId.length < 10) {
      orgId = '00000000-0000-0000-0000-000000000000';
    }

    if (orgId && orgId !== '00000000-0000-0000-0000-000000000000') {
      try {
        const { getOrganizationById } = await import('@/services/database');
        const org = await getOrganizationById(orgId);
        if (org?.twilio_phone_number) {
          callerId = normalizePhoneNumber(org.twilio_phone_number);
        }

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

    try {
      const contact = await findOrCreateContact(orgId, normalizedTo);
      const comm = await createCommunication({
        organizationId: orgId,
        contactId: contact.id,
        type: 'voice_out',
        twilioSid: CallSid,
        fromNumber: callerId,
        toNumber: normalizedTo,
        status: 'in-progress',
      });
      await initializeCallState(CallSid, orgId, contact.id, comm.id);
      await setCallLatestStatus(CallSid, 'in-progress');
    } catch (e: any) {
      logger.debug({ e: e?.message }, 'Note saving browser call communication');
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" timeout="35" answerOnBridge="true" action="${escapeXml(dialStatusUrl)}">
    <Number>${escapeXml(normalizedTo)}</Number>
  </Dial>
  <Say voice="alice">The recipient is currently unavailable. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return reply.status(200).type('text/xml').send(twiml);
  }

  // ── 1. Inbound PSTN Calling ───────────────────────────────────────────────
  try {
    const normalizedTo = To ? normalizePhoneNumber(To) : '';
    const platformPhone = normalizePhoneNumber(config.twilioPhoneNumber || '+12513571708');

    // Strict lookup for dedicated organization line (exactOnly = true)
    const org =
      (await getCachedOrganizationByPhone(To)) ||
      (normalizedTo ? await getCachedOrganizationByPhone(normalizedTo) : null) ||
      (await getOrganizationByPhone(To, true)) ||
      (normalizedTo ? await getOrganizationByPhone(normalizedTo, true) : null);

    // If org has a dedicated number and it's not the shared platform number: route directly!
    const isShared = (To === config.twilioPhoneNumber) || (normalizedTo === platformPhone);
    if (org && !isShared) {
      logger.info(
        { orgId: org.id, orgName: org.name, dedicatedNumber: org.twilio_phone_number, to: To },
        'Incoming call dialed directly to dedicated merchant number — bypassing IVR code prompt'
      );
      await setOrganizationCache(org);
      return routeCallToOrganization(org, CallSid, From, To, reply);
    }

    // 2. Shared platform number: Prompt for 6-digit merchant code
    const merchantRouteUrl = `${effectiveBaseUrl}/api/v1/voice/merchant-route`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${merchantRouteUrl}" method="POST" numDigits="6" timeout="5" finishOnKey="#">
    <Say voice="alice">Please enter the 6-digit merchant code, or press 1 for support.</Say>
  </Gather>
  <Say voice="alice">Connecting to support. Please hold.</Say>
  <Redirect method="POST">${merchantRouteUrl}?Digits=default</Redirect>
</Response>`;

    return reply.status(200).type('text/xml').send(twiml);
  } catch (error) {
    logger.error({ error, callSid: CallSid }, 'Error handling incoming call');

    const callerId = normalizePhoneNumber(config.twilioPhoneNumber || '+12513571708');
    const dialStatusUrl = `${effectiveBaseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(CallSid || '')}`;
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting to support. Please hold.</Say>
  <Dial timeout="25" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    +254706499848
  </Dial>
  <Say voice="alice">All representatives are busy. Please leave a message after the beep.</Say>
  <Record timeout="10" maxLength="60"/>
  <Hangup/>
</Response>`;

    return reply.status(200).type('text/xml').send(fallbackTwiml);
  }
}

/**
 * Handle Merchant Code Route
 * POST /api/v1/voice/merchant-route
 */
export async function handleMerchantRoute(
  request: FastifyRequest<{
    Body: TwilioVoiceWebhook & { Digits?: string };
    Querystring: { Digits?: string };
  }>,
  reply: FastifyReply
) {
  const body = (request.body as any) || {};
  const query = (request.query as any) || {};
  const digits = body.Digits || query.Digits || 'default';
  const callSid = body.CallSid || query.CallSid || '';
  const from = body.From || query.From || '';
  const to = body.To || query.To || config.twilioPhoneNumber || '';

  const host = (request.headers['x-forwarded-host'] as string) || request.headers.host;
  const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
  const effectiveBaseUrl = (host && !host.includes('localhost') && !host.includes('127.0.0.1'))
    ? `${proto}://${host}`
    : (config.baseUrl && !config.baseUrl.includes('localhost') ? config.baseUrl : 'https://vertext.site');

  logger.info({ callSid, digits, from }, 'Merchant route requested');

  try {
    let org = await getOrganizationByMerchantCode(digits);

    if (!org) {
      org = await getOrganizationByMerchantCode('default');
    }

    if (org) {
      return routeCallToOrganization(org, callSid, from, to, reply);
    }

    // Default fallback organization / team
    const callerId = normalizePhoneNumber(config.twilioPhoneNumber || to || '+12513571708');
    const dialStatusUrl = `${effectiveBaseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(callSid)}`;
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Connecting you to customer care.</Say>
  <Dial timeout="35" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    +254706499848
  </Dial>
  <Say voice="alice">Please leave your name and message after the tone.</Say>
  <Record timeout="10" maxLength="60"/>
  <Hangup/>
</Response>`;

    return reply.status(200).type('text/xml').send(fallbackTwiml);
  } catch (error) {
    logger.error({ error, callSid }, 'Error in merchant routing');
    const callerId = normalizePhoneNumber(config.twilioPhoneNumber || to || '+12513571708');
    const dialStatusUrl = `${effectiveBaseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(callSid)}`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call. Please hold.</Say>
  <Dial timeout="35" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    +254706499848
  </Dial>
  <Hangup/>
</Response>`;
    return reply.status(200).type('text/xml').send(twiml);
  }
}

/**
 * Common helper: Connect call to organization & ring merchant phone directly
 */
async function routeCallToOrganization(
  org: any,
  callSid: string,
  from: string,
  to: string,
  reply: FastifyReply
) {
  try {
    const contact = await findOrCreateContact(org.id, from || 'Unknown');

    const communication = await createCommunication({
      organizationId: org.id,
      contactId: contact.id,
      type: 'voice_in',
      twilioSid: callSid,
      fromNumber: from || 'Anonymous',
      toNumber: to || config.twilioPhoneNumber || '',
      status: 'in-progress',
    });

    await initializeCallState(callSid, org.id, contact.id, communication.id);

    // Resolve merchant destination phone number
    let targetPhone = org.escalation_phone_number || (org.metadata?.escalation_phone as string);
    if (!targetPhone) {
      try {
        const { listOrganizationAgents } = await import('@/services/database');
        const agents = await listOrganizationAgents({ organizationId: org.id, isActive: true });
        targetPhone = agents[0]?.phone_number;
      } catch (e) {
        logger.debug({ e }, 'Note resolving agent phone');
      }
    }
    if (!targetPhone) {
      targetPhone = '+254706499848';
    }

    const merchantPhone = normalizePhoneNumber(targetPhone);
    const callerId = normalizePhoneNumber(config.twilioPhoneNumber || to || '+12513571708');
    const dialStatusUrl = `${config.baseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(callSid)}`;
    const voiceId = 'alice';

    logger.info(
      { callSid, orgId: org.id, orgName: org.name, merchantPhone, callerId },
      'Ringing merchant phone directly'
    );

    const clientIdentity = `merchant_${org.id}`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voiceId)}">Connecting you to ${escapeXml(org.name)}. Please hold.</Say>
  <Dial timeout="25" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    <Client>${escapeXml(clientIdentity)}</Client>
    <Number>${escapeXml(merchantPhone)}</Number>
  </Dial>
  <Say voice="${escapeXml(voiceId)}">The merchant is currently unavailable. Please leave a message after the tone.</Say>
  <Record timeout="10" maxLength="60"/>
  <Hangup/>
</Response>`;

    return reply.status(200).type('text/xml').send(twiml);
  } catch (err) {
    logger.error({ err, orgId: org.id }, 'Error routing call to organization');
    const callerId = normalizePhoneNumber(config.twilioPhoneNumber || '+12513571708');
    const dialStatusUrl = `${config.baseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(callSid)}`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to ${escapeXml(org?.name || 'customer care')}. Please hold.</Say>
  <Dial timeout="35" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    +254706499848
  </Dial>
  <Hangup/>
</Response>`;
    return reply.status(200).type('text/xml').send(twiml);
  }
}
