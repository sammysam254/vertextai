// ==============================================
// Voice Incoming Call Webhook Handler
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import { config } from '@/lib/config';
import { getCachedOrganizationByPhone, setOrganizationCache } from '@/services/cache';
import { getOrganizationByPhone, findOrCreateContact, createCommunication } from '@/services/database';
import { initializeCallState } from '@/services/cache';
import { generateGreetingTwiML, generateErrorTwiML } from '@/services/twilio';
import type { TwilioVoiceWebhook } from '@/types';

const logger = createLogger('route:voice:incoming');

/**
 * Handle inbound voice call
 * POST /api/v1/voice/incoming
 */
export async function handleIncomingCall(
  request: FastifyRequest<{ Body: TwilioVoiceWebhook }>,
  reply: FastifyReply
) {
  const { CallSid, From, To, CallStatus } = request.body;

  logger.info(
    { callSid: CallSid, from: From, to: To, status: CallStatus },
    'Inbound call received'
  );

  try {
    // 1. Lookup organization (cache-first)
    let org = await getCachedOrganizationByPhone(To);

    if (!org) {
      // Cache miss - query database
      org = await getOrganizationByPhone(To);
      if (!org) {
        logger.error({ to: To }, 'Organization not found for phone number');
        return reply
          .status(404)
          .type('text/xml')
          .send(
            generateErrorTwiML({
              voiceId: 'Polly.Joanna-Neural',
              errorMessage: 'This number is not configured.',
            })
          );
      }
      // Cache the result
      await setOrganizationCache(org);
    }

    // 2. Find or create contact
    const contact = await findOrCreateContact(org.id, From);

    // 3. Create communication record
    const communication = await createCommunication({
      organizationId: org.id,
      contactId: contact.id,
      type: 'voice_in',
      twilioSid: CallSid,
      fromNumber: From,
      toNumber: To,
      status: CallStatus,
    });

    // 4. Initialize call state in Redis
    await initializeCallState(CallSid, org.id, contact.id, communication.id);

    // 5. Generate greeting TwiML
    const turnUrl = `${config.baseUrl}/api/v1/voice/turn`;
    const twiml = generateGreetingTwiML({
      greetingMessage: `Hello, you've reached ${org.name}. How can I assist you today?`,
      voiceId: org.ai_voice_id,
      turnUrl,
    });

    logger.info(
      { callSid: CallSid, organizationId: org.id, communicationId: communication.id },
      'Greeting TwiML generated'
    );

    return reply.status(200).type('text/xml').send(twiml);
  } catch (error) {
    logger.error({ error, callSid: CallSid }, 'Error handling incoming call');

    return reply
      .status(500)
      .type('text/xml')
      .send(
        generateErrorTwiML({
          voiceId: 'Polly.Joanna-Neural',
          errorMessage: 'An error occurred. Please try again.',
        })
      );
  }
}
