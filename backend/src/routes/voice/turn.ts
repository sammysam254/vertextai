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
  const { CallSid, SpeechResult, Digits, Confidence } = request.body;

  logger.info(
    { callSid: CallSid, speechResult: SpeechResult, digits: Digits },
    'Conversation turn received'
  );

  try {
    // 1. Get call state from Redis
    const callState = await getCallState(CallSid);
    if (!callState) {
      logger.error({ callSid: CallSid }, 'Call state not found');
      return reply
        .status(200)
        .type('text/xml')
        .send(
          generateErrorTwiML({
            voiceId: 'Polly.Joanna-Neural',
            errorMessage: 'Call session expired. Please call back.',
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
            aiReply: "I didn't catch that. How can I help you?",
            voiceId: org.ai_voice_id,
            turnUrl,
            shouldPromptEscalation: callState.turnCount >= 2,
          })
        );
    }

    // 4. Save customer's speech to transcript
    await saveTranscriptTurn({
      communicationId: callState.communicationId,
      speaker: 'caller',
      content: userInput,
      confidence: Confidence ? parseFloat(Confidence) : undefined,
    });

    // 5. Append to call context
    await appendCallTurn(CallSid, 'user', userInput);

    // 6. Generate AI reply
    const aiResult = await generateAIReply(
      org.ai_system_prompt,
      callState.conversationContext,
      userInput,
      org.escalation_keywords
    );

    // 7. Check if escalation needed
    if (aiResult.shouldEscalate) {
      logger.info(
        { callSid: CallSid, reason: aiResult.reason },
        'Escalating to human'
      );

      // Update communication record
      await updateCommunication(callState.communicationId, {
        escalated_to_human: true,
        escalation_reason: aiResult.reason,
        escalation_timestamp: new Date().toISOString(),
      });

      // Save AI escalation message
      await saveTranscriptTurn({
        communicationId: callState.communicationId,
        speaker: 'ai',
        content: aiResult.reply,
      });

      // Generate escalation TwiML
      const statusUrl = `${config.baseUrl}/api/v1/voice/status`;
      const twiml = generateEscalationTwiML({
        escalationNumber: org.escalation_phone_number,
        voiceId: org.ai_voice_id,
        statusUrl,
      });

      return reply.status(200).type('text/xml').send(twiml);
    }

    // 8. Save AI reply to transcript
    await saveTranscriptTurn({
      communicationId: callState.communicationId,
      speaker: 'ai',
      content: aiResult.reply,
    });

    // 9. Append to call context
    await appendCallTurn(CallSid, 'assistant', aiResult.reply);

    // 10. Generate TwiML for next turn
    const turnUrl = `${config.baseUrl}/api/v1/voice/turn`;
    const twiml = generateTurnTwiML({
      aiReply: aiResult.reply,
      voiceId: org.ai_voice_id,
      turnUrl,
      shouldPromptEscalation: callState.turnCount >= 3,
    });

    logger.info(
      { callSid: CallSid, turnCount: callState.turnCount + 1 },
      'Turn TwiML generated'
    );

    return reply.status(200).type('text/xml').send(twiml);
  } catch (error) {
    logger.error({ error, callSid: CallSid }, 'Error handling conversation turn');

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
