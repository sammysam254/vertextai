// ==============================================
// Dial Status Webhook Handler
// POST /api/v1/voice/dial-status
//
// Twilio calls this URL when the <Dial> verb
// completes (agent answered, busy, no-answer…)
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import {
  getCommunicationByTwilioSid,
  updateCommunication,
  updateAgentStatus,
} from '@/services/database';

const logger = createLogger('route:voice:dial-status');

interface DialStatusBody {
  // Standard Twilio status callback fields
  CallSid: string;
  CallStatus: string;
  // <Dial> action callback fields
  DialCallStatus?: string; // 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled'
  DialCallSid?: string;
  DialCallDuration?: string;
}

/**
 * Map Twilio DialCallStatus → our transfer_status enum
 */
function mapDialStatus(
  twilioStatus: string
): 'completed' | 'failed' | 'busy' | 'no_answer' {
  switch (twilioStatus?.toLowerCase()) {
    case 'completed': return 'completed';
    case 'busy':      return 'busy';
    case 'no-answer': return 'no_answer';
    default:          return 'failed';
  }
}

export async function handleDialStatus(
  request: FastifyRequest<{
    Body: DialStatusBody;
    Querystring: { agentId?: string; callSid?: string };
  }>,
  reply: FastifyReply
) {
  const { DialCallStatus, DialCallDuration, CallSid } = request.body;
  const { agentId, callSid: qsCallSid } = request.query;

  const resolvedCallSid = qsCallSid || CallSid;
  const dialStatus = DialCallStatus || 'failed';

  logger.info(
    { callSid: resolvedCallSid, dialStatus, agentId },
    'Dial status callback received'
  );

  // ── 1. Update communication transfer_status ──────────────────────────
  try {
    const comm = await getCommunicationByTwilioSid(resolvedCallSid);
    if (comm) {
      const transferStatus = mapDialStatus(dialStatus);

      await updateCommunication(comm.id, {
        transfer_status: transferStatus,
        duration_seconds: DialCallDuration
          ? parseInt(DialCallDuration, 10) + (comm.duration_seconds || 0)
          : comm.duration_seconds,
      } as any);

      logger.info(
        { communicationId: comm.id, transferStatus },
        'Communication transfer status updated'
      );
    }
  } catch (err) {
    logger.error({ err, callSid: resolvedCallSid }, 'Failed to update communication');
  }

  // ── 2. Update agent status ────────────────────────────────────────────
  if (agentId) {
    try {
      // After the dial completes, mark agent back to available
      await updateAgentStatus(agentId, 'available');
      logger.info({ agentId }, 'Agent status reset to available');
    } catch (err) {
      logger.warn({ err, agentId }, 'Failed to update agent status');
    }
  }

  // Always 200 to Twilio
  return reply.status(200).send({ received: true });
}
