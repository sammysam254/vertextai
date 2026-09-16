// ==============================================
// SMS Incoming Message Webhook Handler
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import { getCachedOrganizationByPhone, setOrganizationCache, appendSMSMessage, getRecentSMSMessages } from '@/services/cache';
import { getOrganizationByPhone, findOrCreateContact, createCommunication, createMessage } from '@/services/database';
import { generateSMSReply } from '@/services/ai/groq.service';
import { generateSMSReplyTwiML, generateEmptySMSTwiML } from '@/services/twilio';
import type { TwilioSMSWebhook } from '@/types';

const logger = createLogger('route:sms:incoming');

/**
 * Handle inbound SMS
 * POST /api/v1/sms/incoming
 */
export async function handleIncomingSMS(
  request: FastifyRequest<{ Body: TwilioSMSWebhook }>,
  reply: FastifyReply
) {
  const body = (request.body as any) || (request.query as any) || {};
  const { MessageSid, From, To, Body = '', NumMedia, MediaUrl0, MediaContentType0 } = body;

  logger.info(
    { messageSid: MessageSid, from: From, to: To, bodyLength: (Body || '').length },
    'Inbound SMS received'
  );

  try {
    // 1. Lookup organization (cache-first)
    let org = await getCachedOrganizationByPhone(To);

    if (!org) {
      org = await getOrganizationByPhone(To);
      if (!org) {
        logger.error({ to: To }, 'Organization not found for phone number');
        return reply.status(404).type('text/xml').send(generateEmptySMSTwiML());
      }
      await setOrganizationCache(org);
    }

    // 2. Find or create contact
    const contact = await findOrCreateContact(org.id, From);

    // 3. Create communication record
    const communication = await createCommunication({
      organizationId: org.id,
      contactId: contact.id,
      type: 'sms_in',
      twilioSid: MessageSid,
      fromNumber: From,
      toNumber: To,
      status: 'received',
    });

    // 4. Handle media (MMS)
    const mediaUrls: string[] = [];
    if (NumMedia && parseInt(NumMedia) > 0 && MediaUrl0) {
      mediaUrls.push(MediaUrl0);
      logger.info({ messageSid: MessageSid, mediaUrl: MediaUrl0, mediaType: MediaContentType0 }, 'MMS received');
    }

    // 5. Save customer message
    await createMessage({
      organizationId: org.id,
      communicationId: communication.id,
      sender: 'customer',
      body: Body,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    });

    // 6. Update SMS context in Redis
    await appendSMSMessage(org.id, From, 'customer', Body);

    // 7. Get conversation history
    const recentMessages = await getRecentSMSMessages(org.id, From, 10);

    // 8. Generate AI reply
    const aiReply = await generateSMSReply(
      org.ai_system_prompt,
      recentMessages,
      Body
    );

    // 9. Save AI reply to database (async, don't block response)
    createMessage({
      organizationId: org.id,
      communicationId: communication.id,
      sender: 'ai',
      body: aiReply,
    })
      .then(() => {
        logger.debug({ communicationId: communication.id }, 'AI SMS reply saved');
      })
      .catch((error) => {
        logger.error({ error, communicationId: communication.id }, 'Error saving AI reply');
      });

    // 10. Update SMS context with AI reply
    await appendSMSMessage(org.id, From, 'ai', aiReply);

    // 11. Generate TwiML response
    const twiml = generateSMSReplyTwiML({ replyMessage: aiReply });

    logger.info(
      { messageSid: MessageSid, organizationId: org.id, replyLength: aiReply.length },
      'SMS reply generated'
    );

    return reply.status(200).type('text/xml').send(twiml);
  } catch (error) {
    logger.error({ error, messageSid: MessageSid }, 'Error handling incoming SMS');

    // Return generic reply on error
    return reply
      .status(200)
      .type('text/xml')
      .send(
        generateSMSReplyTwiML({
          replyMessage: 'Thanks for your message. A team member will respond shortly.',
        })
      );
  }
}
