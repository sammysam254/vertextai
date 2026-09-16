// ==============================================
// SMS Routes Registration
// ==============================================

import { FastifyInstance } from 'fastify';
import { twilioSignatureHook } from '@/middleware';
import { handleIncomingSMS } from './incoming';
import { handleSMSStatus } from './status';
import { outboundSmsRoutes } from './outbound';

export async function smsRoutes(app: FastifyInstance) {
  // Outbound SMS route (no Twilio signature — called from frontend)
  app.register(outboundSmsRoutes);

  // All webhook routes below require Twilio signature validation
  app.register(async (webhookScope) => {
    webhookScope.addHook('preHandler', twilioSignatureHook());

    // Inbound SMS webhook
    webhookScope.post('/incoming', handleIncomingSMS);

    // Status callbacks
    webhookScope.post('/status', handleSMSStatus);
  });
}

