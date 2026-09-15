// ==============================================
// Voice Routes Registration
// ==============================================

import { FastifyInstance } from 'fastify';
import { twilioSignatureHook } from '@/middleware';
import { handleIncomingCall } from './incoming';
import { handleConversationTurn } from './turn';
import { handleCallStatus } from './status';

export async function voiceRoutes(app: FastifyInstance) {
  // All voice routes require Twilio signature validation
  app.addHook('preHandler', twilioSignatureHook());

  // Inbound call webhook
  app.post('/incoming', handleIncomingCall);

  // Conversation turn handler
  app.post('/turn', handleConversationTurn);

  // Status callbacks
  app.post('/status', handleCallStatus);
}
