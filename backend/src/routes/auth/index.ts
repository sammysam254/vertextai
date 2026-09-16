// ==============================================
// Auth Setup Route
// POST /api/v1/auth/setup
//
// Called immediately after supabase.auth.signUp()
// on the frontend. Uses the service role key to
// create the org + membership row atomically,
// bypassing RLS (the new user can't insert yet).
// ==============================================

import type { FastifyPluginAsync } from 'fastify';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';

const logger = createLogger('route:auth:setup');

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: {
      userId: string;
      organizationName: string;
      twilioPhoneNumber?: string;
      escalationPhoneNumber?: string;
    };
  }>(
    '/setup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'organizationName'],
          properties: {
            userId:               { type: 'string' },
            organizationName:     { type: 'string', minLength: 1 },
            twilioPhoneNumber:    { type: 'string' },
            escalationPhoneNumber:{ type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        userId,
        organizationName,
        twilioPhoneNumber    = '+10000000000', // placeholder — user sets real one in Settings
        escalationPhoneNumber = '+10000000000',
      } = request.body;

      logger.info({ userId, organizationName }, 'Setting up new organization');

      // ── 1. Check user exists in auth.users ───────────────────────────
      const { data: authUser, error: authErr } =
        await supabase.auth.admin.getUserById(userId);

      if (authErr || !authUser.user) {
        logger.error({ authErr, userId }, 'User not found in auth.users');
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found — confirm your email first',
          statusCode: 404,
        });
      }

      // ── 2. Create organization ────────────────────────────────────────
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name:                  organizationName,
          twilio_phone_number:   twilioPhoneNumber,
          escalation_phone_number: escalationPhoneNumber,
        })
        .select()
        .single();

      if (orgErr) {
        logger.error({ orgErr, organizationName }, 'Failed to create organization');
        // Unique violation on twilio_phone_number
        if (orgErr.code === '23505') {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'That phone number is already registered to another organization',
            statusCode: 409,
          });
        }
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create organization',
          statusCode: 500,
        });
      }

      // ── 3. Create membership (owner) ──────────────────────────────────
      const { error: memErr } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id:         userId,
          role:            'owner',
        });

      if (memErr) {
        logger.error({ memErr, orgId: org.id, userId }, 'Failed to create membership');
        // Roll back org to avoid orphan
        await supabase.from('organizations').delete().eq('id', org.id);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create organization membership',
          statusCode: 500,
        });
      }

      logger.info(
        { orgId: org.id, userId },
        'Organization and membership created successfully'
      );

      return reply.status(201).send({
        organizationId: org.id,
        organizationName: org.name,
        role: 'owner',
      });
    }
  );

  // POST /api/v1/auth/resolve - Resolve or auto-provision dedicated organization for user
  fastify.post<{
    Body: {
      userId: string;
      email?: string;
      name?: string;
    };
  }>('/resolve', async (request, reply) => {
    const { userId, email, name } = request.body || {};
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      // Check existing membership
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations ( id, name, metadata, twilio_phone_number )')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (member && member.organization_id) {
        const org = (member as any).organizations;
        const orgId = member.organization_id;
        let hash = 0;
        for (let i = 0; i < orgId.length; i++) {
          hash = (hash * 31 + orgId.charCodeAt(i)) >>> 0;
        }
        const merchantCode = org?.metadata?.merchant_code || String(100000 + (hash % 900000));

        return reply.status(200).send({
          organizationId: orgId,
          organizationName: org?.name || 'My Call Center',
          merchantCode,
          role: member.role || 'owner',
        });
      }

      // Auto-provision personal organization for this user
      const orgName = name || (email ? `${email.split('@')[0]}'s Call Center` : 'My Call Center');
      
      // Compute deterministic 6-digit code from userId
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
      }
      const newMerchantCode = String(100000 + (hash % 900000));

      const { data: newOrg, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          twilio_phone_number: '+12513571708',
          escalation_phone_number: '+254706499848',
          metadata: { merchant_code: newMerchantCode, owner_user_id: userId },
        })
        .select()
        .single();

      if (orgErr || !newOrg) {
        logger.error({ orgErr, userId }, 'Failed to auto-create organization');
        return reply.status(500).send({ error: 'Failed to auto-provision organization' });
      }

      // Create membership
      await supabase.from('organization_members').insert({
        organization_id: newOrg.id,
        user_id: userId,
        role: 'owner',
      });

      logger.info({ orgId: newOrg.id, userId, merchantCode: newMerchantCode }, 'Auto-provisioned merchant organization');

      return reply.status(201).send({
        organizationId: newOrg.id,
        organizationName: newOrg.name,
        merchantCode: newMerchantCode,
        role: 'owner',
      });
    } catch (err: any) {
      logger.error({ err, userId }, 'Error in /api/v1/auth/resolve');
      return reply.status(500).send({ error: err.message || 'Internal server error' });
    }
  });
};
