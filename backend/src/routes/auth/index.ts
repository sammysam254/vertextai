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
import { ensureOrganizationMerchantCode, generateUniqueMerchantCode } from '@/services/database';

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
            userId:               { type: 'string', format: 'uuid' },
            organizationName:     { type: 'string', minLength: 2 },
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
        twilioPhoneNumber    = '+12513571708', // placeholder — user sets real one in Settings
        escalationPhoneNumber = '+254706499848',
      } = request.body;

      logger.info({ userId, organizationName }, 'Creating org via service role');

      // ── 1. Verify user exists in auth.users ─────────────────────────────
      const { data: userRecord, error: userErr } =
        await supabase.auth.admin.getUserById(userId);

      if (userErr || !userRecord?.user) {
        logger.error({ userErr, userId }, 'User not found in auth.users');
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User does not exist in auth.users',
          statusCode: 404,
        });
      }

      // Generate unique merchant code
      const merchantCode = await generateUniqueMerchantCode();

      // ── 2. Create organization ────────────────────────────────────────
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name:                  organizationName,
          twilio_phone_number:   twilioPhoneNumber,
          escalation_phone_number: escalationPhoneNumber,
          metadata: { merchant_code: merchantCode, owner_user_id: userId },
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
        { orgId: org.id, userId, merchantCode },
        'Organization and membership created successfully'
      );

      return reply.status(201).send({
        organizationId: org.id,
        organizationName: org.name,
        role: 'owner',
        merchantCode,
        twilioPhoneNumber: org.twilio_phone_number,
        isDedicatedNumber: false,
      });
    }
  );

  // POST /api/v1/auth/resolve - Auto-resolve or create personal tenant organization for user
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

        // Ensure unique, persistent merchant code that never changes
        let merchantCode = org?.metadata?.merchant_code;
        if (!merchantCode) {
          merchantCode = await ensureOrganizationMerchantCode(orgId);
        }

        const phone = org?.twilio_phone_number || '+12513571708';
        const isDedicated = Boolean(phone !== '+12513571708' || org?.metadata?.dedicated_number);

        return reply.status(200).send({
          organizationId: orgId,
          organizationName: org?.name || 'My Call Center',
          merchantCode,
          role: member.role || 'owner',
          twilioPhoneNumber: phone,
          isDedicatedNumber: isDedicated,
        });
      }

      // Auto-provision personal organization for this user with strictly unique code
      const orgName = name || (email ? `${email.split('@')[0]}'s Call Center` : 'My Call Center');
      const newMerchantCode = await generateUniqueMerchantCode();

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
        twilioPhoneNumber: newOrg.twilio_phone_number || '+12513571708',
        isDedicatedNumber: false,
      });
    } catch (err: any) {
      logger.error({ err, userId }, 'Error in /api/v1/auth/resolve');
      return reply.status(500).send({ error: err.message || 'Internal server error' });
    }
  });
};
