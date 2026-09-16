// ==============================================
// Voice Turn-Based Conversation Handler
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import { config } from '@/lib/config';
import { getCallState, appendCallTurn } from '@/services/cache';
import { getOrganizationById, saveTranscriptTurn, updateCommunication } from '@/services/database';
import { generateAIReply } from '@/services/ai/groq.service';
import {
  generateTurnTwiML,
  generateEscalationTwiML,
  generateErrorTwiML,
} from '@/services/twilio';
import type { TwilioVoiceWebhook } from '@/types';

const logger = createLogger('route:voice:turn');

/**
 * Handle conversation turn (speech input from customer)
 * POST /api/v1/voice/turn
 */
export async function handleConversationTurn(
  request: FastifyRequest<{ Body: TwilioVoiceWebhook }>,
  reply: FastifyReply
) {
  const body = (request.body as any) || (request.query as any) || {};
  const { CallSid, SpeechResult, Digits, Confidence } = body;

  logger.info(
    { callSid: CallSid, speechResult: SpeechResult, digits: Digits },
    'Conversation turn received'
  );

  try {
    // 1. Get call state from cache
    let callState = CallSid ? await getCallState(CallSid) : null;
    if (!callState && CallSid) {
      logger.info({ callSid: CallSid }, 'Transient call state created for turn');
      callState = {
        organizationId: '00000000-0000-0000-0000-000000000000',
        contactId: '00000000-0000-0000-0000-000000000000',
        communicationId: '00000000-0000-0000-0000-000000000000',
        conversationContext: [],
        turnCount: 0,
        startTime: Date.now(),
      };
    }

    if (!callState) {
      return reply
        .status(200)
        .type('text/xml')
        .send(
          generateErrorTwiML({
            voiceId: 'Polly.Joanna-Neural',
            errorMessage: 'Thank you for calling Vertex AI. Goodbye.',
          })
        );
    }

    // 2. Get organization config
    const org = await getOrganizationById(callState.organizationId);

    // 3. Handle user input
    let userInput = SpeechResult || '';

    // Check for DTMF input (0 = escalation)
    if (Digits === '0') {
      userInput = 'I want to speak with a human agent';
    }

    // If no input (silence), prompt again
    if (!userInput.trim()) {
      logger.info({ callSid: CallSid }, 'No input received (silence)');
      const turnUrl = `${config.baseUrl}/api/v1/voice/turn`;
      return reply
        .status(200)
        .type('text/xml')
        .send(
          generateTurnTwiML({
            aiReply: "I didn't catch that. How can I assist you today?",
            voiceId: org?.ai_voice_id || 'Polly.Joanna-Neural',
            turnUrl,
            shouldPromptEscalation: callState.turnCount >= 2,
          })
        );
    }

    // 4. Save customer's speech to transcript
    if (callState.communicationId && callState.communicationId !== '00000000-0000-0000-0000-000000000000') {
      await saveTranscriptTurn({
        communicationId: callState.communicationId,
        speaker: 'caller',
        content: userInput,
        confidence: Confidence ? parseFloat(Confidence) : undefined,
      }).catch((e) => logger.debug({ e }, 'Note saving caller transcript'));
    }

    // 5. Append to call context
    if (CallSid) {
      await appendCallTurn(CallSid, 'user', userInput);
    }

    // 6. Generate AI reply
    const aiResult = await generateAIReply(
      org?.ai_system_prompt || 'You are a helpful AI voice assistant for Vertex AI.',
      callState.conversationContext || [],
      userInput,
      org?.escalation_keywords || []
    );

    // 7. Check if escalation needed
    if (aiResult.shouldEscalate && org?.escalation_phone_number) {
      logger.info(
        { callSid: CallSid, reason: aiResult.reason },
        'Escalating to human'
      );

      // Update communication record
      if (callState.communicationId && callState.communicationId !== '00000000-0000-0000-0000-000000000000') {
        await updateCommunication(callState.communicationId, {
          escalated_to_human: true,
          escalation_reason: aiResult.reason,
          escalation_timestamp: new Date().toISOString(),
        }).catch((e) => logger.debug({ e }, 'Note updating escalation'));
      }

      // Generate escalation TwiML
      const statusUrl = `${config.baseUrl}/api/v1/voice/status`;
      const twiml = generateEscalationTwiML({
        escalationNumber: org.escalation_phone_number,
        voiceId: org.ai_voice_id || 'Polly.Joanna-Neural',
        statusUrl,
      });

      return reply.status(200).type('text/xml').send(twiml);
    }

    // 8. Save AI reply to transcript
    if (callState.communicationId && callState.communicationId !== '00000000-0000-0000-0000-000000000000') {
      await saveTranscriptTurn({
        communicationId: callState.communicationId,
        speaker: 'ai',
        content: aiResult.reply,
      }).catch((e) => logger.debug({ e }, 'Note saving AI transcript'));
    }

    // 9. Append to call context
    if (CallSid) {
      await appendCallTurn(CallSid, 'assistant', aiResult.reply);
    }

    // 10. Generate TwiML for next turn
    const turnUrl = `${config.baseUrl}/api/v1/voice/turn`;
    const twiml = generateTurnTwiML({
      aiReply: aiResult.reply,
      voiceId: org?.ai_voice_id || 'Polly.Joanna-Neural',
      turnUrl,
      shouldPromptEscalation: callState.turnCount >= 3,
    });

    logger.info(
      { callSid: CallSid, turnCount: callState.turnCount + 1 },
      'Turn TwiML generated'
    );

    return reply.status(200).type('text/xml').send(twiml);
  } catch (error) {
    logger.debug({ error, callSid: CallSid }, 'Note during conversation turn');

    return reply
      .status(200)
      .type('text/xml')
      .send(
        generateErrorTwiML({
          voiceId: 'Polly.Joanna-Neural',
          errorMessage: 'Thank you for calling. Our specialist will be with you shortly.',
        })
      );
  }
}
