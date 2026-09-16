// ==============================================
// Voice Routes Registration
// ==============================================

import { FastifyInstance } from 'fastify';
import { twilioSignatureHook } from '@/middleware';
import { handleIncomingCall, handleMerchantRoute } from './incoming';
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
  app.register(async (webhookScope) => {
    webhookScope.addHook('preHandler', twilioSignatureHook());

    // Inbound call webhook
    webhookScope.post('/incoming', handleIncomingCall);

    // 6-Digit Merchant Code Routing
    webhookScope.post('/merchant-route', handleMerchantRoute);
    webhookScope.get('/merchant-route', handleMerchantRoute);

    // Conversation turn handler
    webhookScope.post('/turn', handleConversationTurn);

    // Call status callbacks (completed, failed, etc.)
    webhookScope.post('/status', handleCallStatus);

    // Dial/transfer status callbacks
    webhookScope.post('/dial-status', handleDialStatus);
  });
}
