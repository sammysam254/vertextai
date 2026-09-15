// ==============================================
// Agents REST Routes
// Prefix: /api/v1/agents
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import { createLogger } from '@/lib/logger';
import {
  listOrganizationAgents,
  createAgent,
  getAgentById,
  updateAgent,
  updateAgentStatus,
  deleteAgent,
} from '@/services/database';
import type { Agent } from '@/types';

const logger = createLogger('route:agents');

export const agentRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /api/v1/agents?organizationId=xxx ────────────────────────────
  fastify.get<{
    Querystring: {
      organizationId: string;
      status?: Agent['status'];
      isActive?: string;
    };
  }>('/', async (request, reply) => {
    const { organizationId, status, isActive } = request.query;

    if (!organizationId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'organizationId is required',
        statusCode: 400,
      });
    }

    const agents = await listOrganizationAgents({
      organizationId,
      status,
      isActive: isActive !== undefined ? isActive === 'true' : true,
    });

    logger.debug({ organizationId, count: agents.length }, 'Agents listed');
    return reply.status(200).send({ agents, total: agents.length });
  });

  // ── POST /api/v1/agents ───────────────────────────────────────────────
  fastify.post<{
    Body: {
      organizationId: string;
      name: string;
      phoneNumber: string;
      email?: string;
      status?: Agent['status'];
    };
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['organizationId', 'name', 'phoneNumber'],
          properties: {
            organizationId: { type: 'string' },
            name:           { type: 'string' },
            phoneNumber:    { type: 'string' },
            email:          { type: 'string' },
            status:         { type: 'string', enum: ['available','in_call','busy','offline'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { organizationId, name, phoneNumber, email, status } = request.body;

      const agent = await createAgent({
        organizationId,
        name,
        phoneNumber,
        email,
        status: status ?? 'offline',
      });

      logger.info({ agentId: agent.id, organizationId }, 'Agent created');
      return reply.status(201).send({ agent });
    }
  );

  // ── GET /api/v1/agents/:id ────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const agent = await getAgentById(request.params.id);
    if (!agent) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Agent not found',
        statusCode: 404,
      });
    }
    return reply.status(200).send({ agent });
  });

  // ── PATCH /api/v1/agents/:id ──────────────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: Partial<Pick<Agent, 'name' | 'phone_number' | 'email' | 'status' | 'is_active'>>;
  }>('/:id', async (request, reply) => {
    const agent = await updateAgent(request.params.id, request.body);
    logger.info({ agentId: request.params.id }, 'Agent updated');
    return reply.status(200).send({ agent });
  });

  // ── PATCH /api/v1/agents/:id/status ──────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: { status: Agent['status'] };
  }>(
    '/:id/status',
    {
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['available','in_call','busy','offline'] },
          },
        },
      },
    },
    async (request, reply) => {
      const agent = await updateAgentStatus(request.params.id, request.body.status);
      logger.info({ agentId: request.params.id, status: request.body.status }, 'Agent status updated');
      return reply.status(200).send({ agent });
    }
  );

  // ── DELETE /api/v1/agents/:id ─────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await deleteAgent(request.params.id);
    logger.info({ agentId: request.params.id }, 'Agent deleted');
    return reply.status(204).send();
  });
};
