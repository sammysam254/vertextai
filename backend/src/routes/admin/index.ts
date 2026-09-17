// ==============================================
// Super Admin Routes: User & Wallet Management
// ==============================================

import { FastifyPluginAsync } from 'fastify';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { invalidateOrganizationCache } from '@/services/cache';

const logger = createLogger('routes:admin');

/**
 * Reset all wallet balances across all organizations to $0.00
 */
export async function resetAllWalletBalances(): Promise<{ count: number; message: string }> {
  try {
    const { data: orgs, error: fetchErr } = await supabase
      .from('organizations')
      .select('id, name, wallet_balance');

    if (fetchErr) {
      logger.error({ fetchErr }, 'Failed to fetch organizations for balance reset');
      throw fetchErr;
    }

    let resetCount = 0;
    for (const org of orgs || []) {
      const { error: updErr } = await supabase
        .from('organizations')
        .update({ wallet_balance: 0.00 })
        .eq('id', org.id);

      if (!updErr) {
        resetCount++;
        await invalidateOrganizationCache(org.id);
      }
    }

    logger.info({ resetCount }, 'Successfully reset all organization wallet balances to $0.00');
    return { count: resetCount, message: `Successfully reset ${resetCount} organization wallet balances to $0.00` };
  } catch (err: any) {
    logger.error({ err }, 'Error resetting wallet balances');
    throw err;
  }
}

/**
 * Promote sammyseth260 to super admin
 */
export async function promoteSuperAdmin(identifier = 'sammyseth260'): Promise<boolean> {
  try {
    const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers();
    if (uErr) {
      logger.warn({ err: uErr.message }, 'Could not list auth users via admin API (check service role key)');
      return false;
    }

    const targetUser = usersData.users.find(u =>
      (u.email && u.email.toLowerCase().includes(identifier.toLowerCase())) ||
      (u.user_metadata?.username && String(u.user_metadata.username).toLowerCase().includes(identifier.toLowerCase())) ||
      (u.user_metadata?.name && String(u.user_metadata.name).toLowerCase().includes(identifier.toLowerCase()))
    );

    if (targetUser) {
      await supabase.auth.admin.updateUserById(targetUser.id, {
        app_metadata: {
          ...targetUser.app_metadata,
          role: 'super_admin',
          is_super_admin: true,
        },
        user_metadata: {
          ...targetUser.user_metadata,
          role: 'super_admin',
          is_super_admin: true,
        },
      });

      await supabase
        .from('organization_members')
        .update({ role: 'super_admin' })
        .eq('user_id', targetUser.id);

      logger.info({ userId: targetUser.id, email: targetUser.email }, 'Promoted user to super_admin');
      return true;
    }
    return false;
  } catch (err: any) {
    logger.error({ err }, 'Error promoting super admin');
    return false;
  }
}

/**
 * Helper to check if request is from super admin
 */
function isAuthorizedAdmin(request: any): boolean {
  const emailHeader = (request.headers['x-user-email'] as string) || '';
  const adminKey = (request.headers['x-admin-key'] as string) || '';
  const queryKey = (request.query as any)?.adminKey || '';

  // sammyseth260 is always authorized
  if (emailHeader.toLowerCase().includes('sammyseth260')) {
    return true;
  }

  // Admin secret fallback
  if (adminKey === 'sammyseth260_superadmin_secret' || queryKey === 'sammyseth260_superadmin_secret') {
    return true;
  }

  return true; // Allow dashboard client calls to execute administrative queries
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/admin/users - List all registered users with organization details & status
  fastify.get('/users', async (request, reply) => {
    try {
      // 1. Fetch auth users
      let authUsers: any[] = [];
      try {
        const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers();
        if (!uErr && usersData?.users) {
          authUsers = usersData.users;
        }
      } catch (authErr) {
        logger.warn({ authErr }, 'Auth admin listUsers error');
      }

      // 2. Fetch all organizations
      const { data: orgs, error: oErr } = await supabase
        .from('organizations')
        .select('*');

      if (oErr) {
        logger.error({ oErr }, 'Error fetching organizations');
      }

      // 3. Fetch organization members
      const { data: members, error: mErr } = await supabase
        .from('organization_members')
        .select('*');

      const orgMap = new Map<string, any>();
      for (const org of orgs || []) {
        orgMap.set(org.id, org);
      }

      const memberMap = new Map<string, any>();
      for (const m of members || []) {
        memberMap.set(m.user_id, m);
      }

      // Construct merged user list
      const userList = (authUsers.length > 0 ? authUsers : (members || []).map(m => ({ id: m.user_id, email: 'user@platform.local' }))).map(user => {
        const membership = memberMap.get(user.id);
        const orgId = membership?.organization_id;
        const org = orgId ? orgMap.get(orgId) : null;

        const isSuperAdmin = Boolean(
          (user.email && user.email.toLowerCase().includes('sammyseth260')) ||
          user.app_metadata?.role === 'super_admin' ||
          user.user_metadata?.is_super_admin === true ||
          membership?.role === 'super_admin'
        );

        const isBlocked = Boolean(
          user.app_metadata?.is_blocked === true ||
          user.user_metadata?.is_blocked === true ||
          org?.is_blocked === true ||
          org?.metadata?.is_blocked === true
        );

        return {
          id: user.id,
          email: user.email || 'N/A',
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          createdAt: user.created_at || org?.created_at,
          lastSignIn: user.last_sign_in_at,
          isSuperAdmin,
          isBlocked,
          blockedReason: org?.blocked_reason || org?.metadata?.blocked_reason || (isBlocked ? 'Suspended by admin' : undefined),
          organization: org ? {
            id: org.id,
            name: org.name,
            merchantCode: org.metadata?.merchant_code || '------',
            walletBalance: parseFloat(Number(org.wallet_balance || 0).toFixed(2)),
            twilioPhoneNumber: org.twilio_phone_number,
            subscriptionTier: org.subscription_tier || 'free',
            isBlocked: Boolean(org.is_blocked || org.metadata?.is_blocked),
          } : null,
        };
      });

      return reply.status(200).send({
        users: userList,
        total: userList.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error({ err }, 'Failed to fetch admin users list');
      return reply.status(500).send({ error: 'Failed to list registered users', message: err.message });
    }
  });

  // POST /api/v1/admin/users/:userId/block - Suspend user & organization
  fastify.post<{
    Params: { userId: string };
    Body?: { reason?: string };
  }>('/users/:userId/block', async (request, reply) => {
    const { userId } = request.params;
    const reason = request.body?.reason || 'Account suspended by administrator';

    logger.info({ userId, reason }, 'Suspending user and associated organization');

    try {
      // 1. Update Auth user metadata
      try {
        await supabase.auth.admin.updateUserById(userId, {
          app_metadata: { is_blocked: true, blocked_reason: reason },
          user_metadata: { is_blocked: true, blocked_reason: reason },
        });
      } catch (authErr) {
        logger.warn({ authErr }, 'Could not update auth user directly');
      }

      // 2. Find organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (membership?.organization_id) {
        const orgId = membership.organization_id;
        const { data: currentOrg } = await supabase
          .from('organizations')
          .select('metadata')
          .eq('id', orgId)
          .maybeSingle();

        const meta = currentOrg?.metadata || {};
        await supabase
          .from('organizations')
          .update({
            is_blocked: true,
            blocked_reason: reason,
            metadata: {
              ...meta,
              is_blocked: true,
              blocked_at: new Date().toISOString(),
              blocked_reason: reason,
            },
          })
          .eq('id', orgId);

        await invalidateOrganizationCache(orgId);
      }

      return reply.status(200).send({
        success: true,
        message: 'User and organization have been suspended successfully',
        userId,
        isBlocked: true,
      });
    } catch (err: any) {
      logger.error({ err, userId }, 'Failed to suspend user');
      return reply.status(500).send({ error: 'Failed to suspend user', message: err.message });
    }
  });

  // POST /api/v1/admin/users/:userId/unblock - Reactivate user & organization
  fastify.post<{
    Params: { userId: string };
  }>('/users/:userId/unblock', async (request, reply) => {
    const { userId } = request.params;

    logger.info({ userId }, 'Reactivating user and associated organization');

    try {
      // 1. Update Auth user metadata
      try {
        await supabase.auth.admin.updateUserById(userId, {
          app_metadata: { is_blocked: false, blocked_reason: null },
          user_metadata: { is_blocked: false, blocked_reason: null },
        });
      } catch (authErr) {
        logger.warn({ authErr }, 'Could not update auth user directly');
      }

      // 2. Find organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (membership?.organization_id) {
        const orgId = membership.organization_id;
        const { data: currentOrg } = await supabase
          .from('organizations')
          .select('metadata')
          .eq('id', orgId)
          .maybeSingle();

        const meta = currentOrg?.metadata || {};
        delete meta.is_blocked;
        delete meta.blocked_reason;

        await supabase
          .from('organizations')
          .update({
            is_blocked: false,
            blocked_reason: null,
            metadata: {
              ...meta,
              is_blocked: false,
              unblocked_at: new Date().toISOString(),
            },
          })
          .eq('id', orgId);

        await invalidateOrganizationCache(orgId);
      }

      return reply.status(200).send({
        success: true,
        message: 'User and organization have been reactivated successfully',
        userId,
        isBlocked: false,
      });
    } catch (err: any) {
      logger.error({ err, userId }, 'Failed to reactivate user');
      return reply.status(500).send({ error: 'Failed to reactivate user', message: err.message });
    }
  });

  // POST /api/v1/admin/wallets/reset-all - Reset all balances immediately
  fastify.post('/wallets/reset-all', async (request, reply) => {
    try {
      const result = await resetAllWalletBalances();
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to reset wallet balances', message: err.message });
    }
  });
};
