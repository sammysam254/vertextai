// ==============================================
// Voice Routes Registration
// ==============================================

import { FastifyInstance } from 'fastify';
import { handleIncomingCall, handleMerchantRoute } from './incoming';
import { handleConversationTurn } from './turn';
import { handleCallStatus } from './status';
import { handleDialStatus } from './dial-status';
import { outboundCallRoutes } from './outbound';
import { transferRoutes } from './transfer';
import { browserVoiceRoutes } from './browser';

export async function voiceRoutes(app: FastifyInstance) {
  // WebRTC Browser calling routes (Token generation and direct call bridging)
  app.register(browserVoiceRoutes);

  // Transfer routes (no Twilio signature — called from frontend + Twilio TwiML fetch)
  app.register(transferRoutes);

  // Outbound call route (no Twilio signature required — called from frontend)
  app.register(outboundCallRoutes);

  // Voice Webhook routes (Support both POST and GET for all Twilio webhook types)
  app.all('/incoming', handleIncomingCall);
  app.all('/call', handleIncomingCall);

  // 6-Digit Merchant Code Routing
  app.all('/merchant-route', handleMerchantRoute);

  // Conversation turn handler
  app.all('/turn', handleConversationTurn);

  // Call status callbacks (completed, failed, etc.)
  app.all('/status', handleCallStatus);

  // Dial/transfer status callbacks
  app.all('/dial-status', handleDialStatus);
}
