// ==============================================
// Voice Routes Registration
// ==============================================

import { FastifyInstance } from 'fastify';
import { twilioSignatureHook } from '@/middleware';
import { handleIncomingCall } from './incoming';
import { handleConversationTurn } from './turn';
import { handleCallStatus } from './status';
import { handleDialStatus } from './dial-status';
import { outboundCallRoutes } from './outbound';
import { transferRoutes } from './transfer';

export async function voiceRoutes(app: FastifyInstance) {
  // Transfer routes (no Twilio signature — called from frontend + Twilio TwiML fetch)
  app.register(transferRoutes);

  // Outbound call route (no Twilio signature required — called from frontend)
  app.register(outboundCallRoutes);

  // All webhook routes below require Twilio signature validation
  app.addHook('preHandler', twilioSignatureHook());

  // Inbound call webhook
  app.post('/incoming', handleIncomingCall);

  // Conversation turn handler
  app.post('/turn', handleConversationTurn);

  // Call status callbacks (completed, failed, etc.)
  app.post('/status', handleCallStatus);

  // Dial/transfer status callbacks
  app.post('/dial-status', handleDialStatus);
}
