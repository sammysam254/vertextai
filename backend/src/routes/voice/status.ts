// ==============================================
// Voice Status Callback Handler
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import { clearCallState, getCallDuration, setCallLatestStatus } from '@/services/cache';
import {
  getCommunicationByTwilioSid,
  updateCommunication,
  getFullTranscript,
} from '@/services/database';
import { generateCallSummary } from '@/services/ai/groq.service';
import type { TwilioStatusCallback } from '@/types';

const logger = createLogger('route:voice:status');

/**
 * Handle call status callbacks (completed, failed, busy, no-answer, etc.)
 * POST /api/v1/voice/status
 */
export async function handleCallStatus(
  request: FastifyRequest<{ Body: TwilioStatusCallback }>,
  reply: FastifyReply
) {
  const body = (request.body as any) || (request.query as any) || {};
  const { CallSid, CallStatus, CallDuration } = body;

  if (!CallSid) {
    return reply.status(200).send({ received: true });
  }

  logger.info({ callSid: CallSid, status: CallStatus }, 'Call status callback received');

  try {
    // 1. Record latest call status in cache for instant UI synchronization
    if (CallStatus) {
      await setCallLatestStatus(CallSid, CallStatus);
    }

    const isTerminal = ['completed', 'canceled', 'busy', 'failed', 'no-answer'].includes(CallStatus?.toLowerCase());
    if (isTerminal) {
      await clearCallState(CallSid);
    }

    // 2. Get communication record
    const communication = await getCommunicationByTwilioSid(CallSid);
    if (!communication) {
      logger.debug({ callSid: CallSid, status: CallStatus }, 'No communication record found for status callback');
      return reply.status(200).send({ received: true });
    }

    // 3. Update communication status
    const updates: any = {
      status: CallStatus,
    };

    if (isTerminal) {
      updates.completed_at = new Date().toISOString();
    }

    // Add duration if available
    if (CallDuration) {
      updates.duration_seconds = parseInt(CallDuration, 10);
    } else {
      // Try to get duration from cache
      const duration = await getCallDuration(CallSid);
      if (duration > 0) {
        updates.duration_seconds = duration;
      }
    }

    // 4. Generate summary if completed and has communication record
    if (CallStatus === 'completed' && communication.id) {
      getFullTranscript(communication.id)
        .then(async (transcript) => {
          if (transcript && transcript.length > 0) {
            const summary = await generateCallSummary(transcript);
            await updateCommunication(communication.id, { summary });
            logger.info({ communicationId: communication.id }, 'Call summary generated');
          }
        })
        .catch((error) => {
          logger.debug({ error, communicationId: communication.id }, 'Note generating summary');
        });
    }

    await updateCommunication(communication.id, updates);

    logger.info(
      { callSid: CallSid, communicationId: communication.id, status: CallStatus },
      'Call status updated'
    );

    return reply.status(200).send({ received: true });
  } catch (error) {
    logger.debug({ error, callSid: CallSid }, 'Note handling call status');
    return reply.status(200).send({ received: true }); // Always return 200 to Twilio
  }
}
