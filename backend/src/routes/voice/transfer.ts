// ==============================================
// Call Transfer Route
// POST /api/v1/voice/transfer
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import { createLogger } from '@/lib/logger';
import { config } from '@/lib/config';
import { getCallState } from '@/services/cache';
import {
  getCommunicationByTwilioSid,
  updateCommunication,
  getAgentByPhone,
  listOrganizationAgents,
  findOrCreateAgent,
} from '@/services/database';
import { updateCall, getCallDetails } from '@/services/twilio/client.service';
import { generateTransferTwiML } from '@/services/twilio/twiml.service';
import { normalizePhoneNumber } from '@/lib/phone';

const logger = createLogger('route:voice:transfer');

export const transferRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * List in-progress calls for an organization (polled by the dashboard)
   * GET /api/v1/voice/live?organizationId=xxx
   */
  fastify.get<{
    Querystring: { organizationId: string };
  }>('/live', async (request, reply) => {
    const { organizationId } = request.query;

    if (!organizationId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'organizationId is required',
        statusCode: 400,
      });
    }

    const { listCommunications } = await import('@/services/database');
    const result = await listCommunications({
      organizationId,
      status: 'in-progress',
      limit: 50,
      offset: 0,
    });

    return reply.status(200).send(result);
  });

  /**
   * Transfer a live call to an agent phone number.
   */
  fastify.post<{
    Body: {
      callSid: string;
      agentPhone: string;
      agentName?: string;
      organizationId: string;
    };
  }>(
    '/transfer',
    {
      schema: {
        body: {
          type: 'object',
          required: ['callSid', 'agentPhone'],
          properties: {
            callSid:        { type: 'string' },
            agentPhone:     { type: 'string' },
            agentName:      { type: 'string' },
            organizationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { callSid, agentPhone, agentName, organizationId } = request.body;

      // Normalize the transfer target number (e.g. 0706499848 -> +254706499848)
      const targetAgentPhone = normalizePhoneNumber(agentPhone);

      logger.info({ callSid, agentPhone: targetAgentPhone, organizationId }, 'Call transfer requested');

      // ── 1. Validate the call is still live (cache, DB, or Twilio live) ──
      let callState = await getCallState(callSid);
      if (!callState) {
        const comm = await getCommunicationByTwilioSid(callSid);
        if (comm) {
          callState = {
            organizationId: comm.organization_id,
            contactId: comm.contact_id || '00000000-0000-0000-0000-000000000000',
            communicationId: comm.id,
            conversationContext: [],
            turnCount: 0,
            startTime: Date.now(),
          };
        } else if (callSid && callSid.startsWith('CA')) {
          try {
            const details = await getCallDetails({ callSid });
            if (['queued', 'ringing', 'in-progress'].includes(details.status)) {
              callState = {
                organizationId: organizationId || '00000000-0000-0000-0000-000000000000',
                contactId: '00000000-0000-0000-0000-000000000000',
                communicationId: '00000000-0000-0000-0000-000000000000',
                conversationContext: [],
                turnCount: 0,
                startTime: Date.now(),
              };
            }
          } catch (e) {
            logger.debug({ e, callSid }, 'Could not fetch live Twilio call details');
          }
        }
      }

      if (!callState && (!callSid || !callSid.startsWith('CA'))) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Call not found or already ended',
          statusCode: 404,
        });
      }

      // ── 2. Resolve / create agent record ───────────────────────────────
      let agentId = '00000000-0000-0000-0000-000000000000';
      try {
        const agent = await findOrCreateAgent({
          organizationId: organizationId || callState?.organizationId || '00000000-0000-0000-0000-000000000000',
          phoneNumber: targetAgentPhone,
          name: agentName || targetAgentPhone,
        });
        if (agent) agentId = agent.id;
      } catch (err) {
        logger.debug({ err }, 'Note creating agent for transfer');
      }

      // ── 3. Build the transfer TwiML URL ────────────────────────────────
      const twimlUrl =
        `${config.baseUrl}/api/v1/voice/transfer-twiml` +
        `?agentPhone=${encodeURIComponent(targetAgentPhone)}` +
        `&agentId=${encodeURIComponent(agentId)}` +
        `&callSid=${encodeURIComponent(callSid)}`;

      // ── 4. Redirect the live call ───────────────────────────────────────
      try {
        await updateCall({
          callSid,
          url: twimlUrl,
        });
      } catch (err: any) {
        logger.error({ err, callSid }, 'Twilio updateCall failed');
        return reply.status(502).send({
          error: 'Bad Gateway',
          message: 'Failed to redirect call via Twilio: ' + (err?.message || ''),
          statusCode: 502,
        });
      }

      // ── 5. Mark communication record as transfer-pending ───────────────
      try {
        const comm = await getCommunicationByTwilioSid(callSid);
        if (comm) {
          await updateCommunication(comm.id, {
            transferred_to_agent_id: agentId,
            transferred_at: new Date().toISOString(),
            transfer_status: 'pending',
            escalated_to_human: true,
            escalation_reason: `Manual transfer to ${agentPhone}`,
            escalation_timestamp: new Date().toISOString(),
          } as any);
        }
      } catch (err) {
        // Non-fatal — the call is already being transferred
        logger.warn({ err, callSid }, 'Could not update communication record');
      }

      logger.info({ callSid, agentPhone, agentId }, 'Transfer initiated');

      return reply.status(200).send({
        success: true,
        message: `Transferring call to ${agentPhone}`,
        agentId,
        agentPhone,
        transferredAt: new Date().toISOString(),
      });
    }
  );

  /**
   * TwiML endpoint — called by Twilio after updateCall redirects the call.
   * Returns <Dial> TwiML that bridges caller → agent.
   */
  fastify.all('/transfer-twiml', async (request, reply) => {
    const { agentPhone, agentId, callSid } =
      (request.query as any) || {};

    const dialStatusUrl = `${config.baseUrl}/api/v1/voice/dial-status`;

    const voiceId = 'Polly.Joanna-Neural';

    const twiml = generateTransferTwiML({
      agentNumber: agentPhone || '',
      voiceId,
      statusUrl: `${dialStatusUrl}?agentId=${encodeURIComponent(agentId || '')}&callSid=${encodeURIComponent(callSid || '')}`,
      transferMessage: 'Please hold while we connect you to an agent.',
    });

    return reply.status(200).type('text/xml').send(twiml);
  });

  /**
   * List available agents for an organization
   * GET /api/v1/voice/agents?organizationId=xxx
   */
  fastify.get<{
    Querystring: { organizationId: string };
  }>('/agents', async (request, reply) => {
    const { organizationId } = request.query;

    if (!organizationId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'organizationId is required',
        statusCode: 400,
      });
    }

    const agents = await listOrganizationAgents({ organizationId, isActive: true });

    return reply.status(200).send({ agents });
  });
};
