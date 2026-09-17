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

import { setCallLatestStatus } from '@/services/cache';

export async function handleDialStatus(
  request: FastifyRequest<{
    Body: DialStatusBody;
    Querystring: { agentId?: string; callSid?: string };
  }>,
  reply: FastifyReply
) {
  const body = (request.body as any) || {};
  const query = (request.query as any) || {};
  const { DialCallStatus, DialCallDuration, CallSid } = body;
  const { agentId, callSid: qsCallSid } = query;

  const resolvedCallSid = qsCallSid || CallSid;
  const dialStatus = DialCallStatus || 'failed';

  logger.info(
    { callSid: resolvedCallSid, dialStatus, agentId },
    'Dial status callback received'
  );

  if (resolvedCallSid) {
    await setCallLatestStatus(resolvedCallSid, dialStatus);
  }

  // ── 1. Update communication transfer_status ──────────────────────────
  try {
    if (resolvedCallSid) {
      const comm = await getCommunicationByTwilioSid(resolvedCallSid);
      if (comm) {
        const transferStatus = mapDialStatus(dialStatus);
        const updates: any = {
          transfer_status: transferStatus,
          duration_seconds: DialCallDuration
            ? parseInt(DialCallDuration, 10) + (comm.duration_seconds || 0)
            : comm.duration_seconds,
        };

        const terminalStatuses = ['completed', 'busy', 'no-answer', 'failed', 'canceled'];
        if (terminalStatuses.includes(dialStatus.toLowerCase())) {
          updates.status = dialStatus.toLowerCase() === 'completed' ? 'completed' : 'failed';
          updates.completed_at = new Date().toISOString();
        }

        // Voice call billing for dialler call legs:
        // Automatically deducts minutes from organization wallet balance & free minutes
        const orgIdToBill = query.orgId || comm.organization_id;
        const durationSec = parseInt(DialCallDuration || '0', 10);
        const destination = query.to || comm.to_number;

        if (dialStatus.toLowerCase() === 'completed' && orgIdToBill && durationSec > 0) {
          try {
            const { billCallUsage } = await import('@/services/database/wallet.service');
            const billingResult = await billCallUsage({
              organizationId: orgIdToBill,
              durationSeconds: durationSec,
              callSid: resolvedCallSid,
              destinationPhone: destination,
            });
            updates.cost_usd = billingResult.totalAmountCharged;
            logger.info(
              {
                callSid: resolvedCallSid,
                orgId: orgIdToBill,
                destination,
                durationSec,
                freeMinutesApplied: billingResult.freeMinutesApplied,
                billableMinutes: billingResult.billableMinutes,
                amountCharged: billingResult.totalAmountCharged,
                remainingBalance: billingResult.remainingBalance,
              },
              'Dialler voice call usage billed and debited from wallet'
            );
          } catch (billingErr: any) {
            logger.warn({ billingErr: billingErr?.message, callSid: resolvedCallSid }, 'Error billing dial status call usage');
          }
        }

        await updateCommunication(comm.id, updates as any);

        logger.info(
          { communicationId: comm.id, transferStatus, status: updates.status, costUsd: updates.cost_usd },
          'Communication transfer status, cost, and call status updated'
        );
      }
    }
  } catch (err) {
    logger.debug({ err, callSid: resolvedCallSid }, 'Note updating communication for dial status');
  }

  // ── 2. Update agent status ────────────────────────────────────────────
  if (agentId) {
    try {
      // After the dial completes, mark agent back to available
      await updateAgentStatus(agentId, 'available');
      logger.info({ agentId }, 'Agent status reset to available');
    } catch (err) {
      logger.debug({ err, agentId }, 'Note updating agent status');
    }
  }

  // Return valid TwiML to Twilio so it hangs up cleanly without syntax errors
  return reply.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
}
