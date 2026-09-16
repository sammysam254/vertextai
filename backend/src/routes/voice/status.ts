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

    // Real-time call billing: 3 free minutes monthly + 20% platform markup
    if (CallStatus === 'completed' && communication.organization_id && (updates.duration_seconds || 0) > 0) {
      try {
        const { billCallUsage } = await import('@/services/database/wallet.service');
        const billingResult = await billCallUsage({
          organizationId: communication.organization_id,
          durationSeconds: updates.duration_seconds,
          callSid: CallSid,
        });
        updates.cost_usd = billingResult.amountCharged;
        logger.info(
          {
            callSid: CallSid,
            orgId: communication.organization_id,
            durationSeconds: updates.duration_seconds,
            freeMinutesApplied: billingResult.freeMinutesApplied,
            billableMinutes: billingResult.billableMinutes,
            amountCharged: billingResult.amountCharged,
          },
          'Call billed and deducted from wallet successfully'
        );
      } catch (billingErr) {
        logger.warn({ billingErr, callSid: CallSid }, 'Note processing call usage billing');
      }
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
