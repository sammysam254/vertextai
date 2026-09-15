// ==============================================
// SMS Status Callback Handler
// ==============================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import { getCommunicationByTwilioSid, updateCommunication } from '@/services/database';

const logger = createLogger('route:sms:status');

interface SMSStatusCallback {
  MessageSid: string;
  MessageStatus: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

/**
 * Handle SMS status callbacks
 * POST /api/v1/sms/status
 */
export async function handleSMSStatus(
  request: FastifyRequest<{ Body: SMSStatusCallback }>,
  reply: FastifyReply
) {
  const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = request.body;

  logger.info({ messageSid: MessageSid, status: MessageStatus }, 'SMS status callback received');

  try {
    // Get communication record
    const communication = await getCommunicationByTwilioSid(MessageSid);
    if (!communication) {
      logger.warn({ messageSid: MessageSid }, 'Communication not found for SMS status');
      return reply.status(200).send({ received: true });
    }

    // Update status
    const updates: any = {
      status: MessageStatus,
    };

    // Log errors if any
    if (ErrorCode) {
      logger.error(
        { messageSid: MessageSid, errorCode: ErrorCode, errorMessage: ErrorMessage },
        'SMS delivery error'
      );
      updates.status = 'failed';
    }

    if (MessageStatus === 'delivered' || MessageStatus === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    await updateCommunication(communication.id, updates);

    logger.info({ messageSid: MessageSid, communicationId: communication.id }, 'SMS status updated');

    return reply.status(200).send({ received: true });
  } catch (error) {
    logger.error({ error, messageSid: MessageSid }, 'Error handling SMS status');
    return reply.status(200).send({ received: true });
  }
}
