// ==============================================
// Voice Status Callback Handler
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import { clearCallState, getCallDuration } from '@/services/cache';
import {
  getCommunicationByTwilioSid,
  updateCommunication,
  getFullTranscript,
} from '@/services/database';
import { generateCallSummary } from '@/services/ai/groq.service';
import type { TwilioStatusCallback } from '@/types';

const logger = createLogger('route:voice:status');

/**
 * Handle call status callbacks (completed, failed, etc.)
 * POST /api/v1/voice/status
 */
export async function handleCallStatus(
  request: FastifyRequest<{ Body: TwilioStatusCallback }>,
  reply: FastifyReply
) {
  const { CallSid, CallStatus, CallDuration } = request.body;

  logger.info({ callSid: CallSid, status: CallStatus }, 'Call status callback received');

  try {
    // 1. Get communication record
    const communication = await getCommunicationByTwilioSid(CallSid);
    if (!communication) {
      logger.warn({ callSid: CallSid }, 'Communication not found for status callback');
      return reply.status(200).send({ received: true });
    }

    // 2. Update communication status
    const updates: any = {
      status: CallStatus,
      completed_at: new Date().toISOString(),
    };

    // Add duration if available
    if (CallDuration) {
      updates.duration_seconds = parseInt(CallDuration, 10);
    } else {
      // Try to get duration from Redis
      const duration = await getCallDuration(CallSid);
      if (duration > 0) {
        updates.duration_seconds = duration;
      }
    }

    // 3. Generate summary (async, don't block response)
    if (CallStatus === 'completed') {
      getFullTranscript(communication.id)
        .then(async (transcript) => {
          if (transcript.length > 0) {
            const summary = await generateCallSummary(transcript);
            await updateCommunication(communication.id, { summary });
            logger.info({ communicationId: communication.id }, 'Call summary generated');
          }
        })
        .catch((error) => {
          logger.error({ error, communicationId: communication.id }, 'Error generating summary');
        });
    }

    await updateCommunication(communication.id, updates);

    // 4. Clear call state from Redis
    await clearCallState(CallSid);

    logger.info(
      { callSid: CallSid, communicationId: communication.id, status: CallStatus },
      'Call status updated'
    );

    return reply.status(200).send({ received: true });
  } catch (error) {
    logger.error({ error, callSid: CallSid }, 'Error handling call status');
    return reply.status(200).send({ received: true }); // Always return 200 to Twilio
  }
}
