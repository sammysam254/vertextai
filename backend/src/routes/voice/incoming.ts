// ==============================================
// Voice Incoming Call Webhook Handler with 6-Digit Merchant Routing
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
import { initializeCallState } from '@/services/cache';
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
  const { CallSid, From, To } = request.body || {};

  logger.info(
    { callSid: CallSid, from: From, to: To },
    'Inbound call received'
  );

  try {
    // 1. Direct match by dedicated phone number
    const org = (await getCachedOrganizationByPhone(To)) || (await getOrganizationByPhone(To));

    // If org has a dedicated number (not the shared platform number)
    if (org && org.twilio_phone_number === To && To !== config.twilioPhoneNumber) {
      await setOrganizationCache(org);
      return routeCallToOrganization(org, CallSid, From, To, reply);
    }

    // 2. Shared platform number: Prompt for 6-digit merchant code
    const merchantRouteUrl = `${config.baseUrl}/api/v1/voice/merchant-route`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${merchantRouteUrl}" method="POST" numDigits="6" timeout="7" finishOnKey="#">
    <Say voice="Polly.Joanna-Neural">Thank you for calling Vertex AI Call Center. If you have a 6-digit merchant ID, please enter it now on your keypad. Or press 1 for customer care.</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Connecting you to customer care. Please hold.</Say>
  <Redirect method="POST">${merchantRouteUrl}?Digits=default</Redirect>
</Response>`;

    return reply.status(200).type('text/xml').send(twiml);
  } catch (error) {
    logger.error({ error, callSid: CallSid }, 'Error handling incoming call');

    const callerId = normalizePhoneNumber(config.twilioPhoneNumber || '+12513571708');
    const dialStatusUrl = `${config.baseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(CallSid || '')}`;
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Welcome. Please hold while we connect you to an agent.</Say>
  <Dial timeout="35" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    +254706499848
  </Dial>
  <Say voice="Polly.Joanna-Neural">All our agents are currently assisting other callers. Please leave a message after the beep.</Say>
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
    const dialStatusUrl = `${config.baseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(callSid)}`;
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Thank you for calling. Connecting you to customer care.</Say>
  <Dial timeout="35" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    +254706499848
  </Dial>
  <Say voice="Polly.Joanna-Neural">Please leave your name and message after the tone.</Say>
  <Record timeout="10" maxLength="60"/>
  <Hangup/>
</Response>`;

    return reply.status(200).type('text/xml').send(fallbackTwiml);
  } catch (error) {
    logger.error({ error, callSid }, 'Error in merchant routing');
    const callerId = normalizePhoneNumber(config.twilioPhoneNumber || to || '+12513571708');
    const dialStatusUrl = `${config.baseUrl}/api/v1/voice/dial-status?callSid=${encodeURIComponent(callSid)}`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Connecting your call. Please hold.</Say>
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
    const voiceId = org.ai_voice_id || 'Polly.Joanna-Neural';

    logger.info(
      { callSid, orgId: org.id, orgName: org.name, merchantPhone, callerId },
      'Ringing merchant phone directly'
    );

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voiceId)}">Connecting you to ${escapeXml(org.name)}. Please hold while we dial customer care.</Say>
  <Dial timeout="35" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    ${escapeXml(merchantPhone)}
  </Dial>
  <Say voice="${escapeXml(voiceId)}">I am sorry, the merchant is currently unavailable. Please leave a message after the tone.</Say>
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
  <Say voice="Polly.Joanna-Neural">Connecting you to ${escapeXml(org?.name || 'customer care')}. Please hold.</Say>
  <Dial timeout="35" callerId="${escapeXml(callerId)}" action="${escapeXml(dialStatusUrl)}">
    +254706499848
  </Dial>
  <Hangup/>
</Response>`;
    return reply.status(200).type('text/xml').send(twiml);
  }
}
