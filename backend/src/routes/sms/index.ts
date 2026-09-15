// ==============================================
// SMS Routes Registration
// ==============================================

import { FastifyInstance } from 'fastify';
import { twilioSignatureHook } from '@/middleware';
import { handleIncomingSMS } from './incoming';
import { handleSMSStatus } from './status';

export async function smsRoutes(app: FastifyInstance) {
  // All SMS routes require Twilio signature validation
  app.addHook('preHandler', twilioSignatureHook());

  // Inbound SMS webhook
  app.post('/incoming', handleIncomingSMS);

  // Status callbacks
  app.post('/status', handleSMSStatus);
}
