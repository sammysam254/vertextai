// ==============================================
// Organization Database Service
// ==============================================

import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { NotFoundError, AppError } from '@/middleware';
import type { Organization } from '@/types';

const logger = createLogger('db:organization');

// ==============================================
// Get Organization
// ==============================================

/**
 * Compute or retrieve 6-digit merchant code for organization
 */
export function getMerchantCode(org: { id: string; metadata?: any }): string {
  if (org.metadata?.merchant_code) {
    return String(org.metadata.merchant_code);
  }
  // Deterministic 6-digit hash from org.id
  let hash = 0;
  for (let i = 0; i < org.id.length; i++) {
    hash = (hash * 31 + org.id.charCodeAt(i)) >>> 0;
  }
  return String(100000 + (hash % 900000));
}

/**
 * Get organization by 6-digit merchant code
 */
export async function getOrganizationByMerchantCode(
  code: string
): Promise<Organization | null> {
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*');

    if (error) {
      logger.error({ error, code }, 'Error querying organizations for merchant code');
      return null;
    }

    if (!orgs || orgs.length === 0) {
      return null;
    }

    // Match by explicit metadata or deterministic hash
    const match = orgs.find((org) => getMerchantCode(org) === code);
    if (match) {
      logger.debug({ orgId: match.id, code }, 'Organization found by merchant code');
      return match;
    }

    if (code === 'default' || code === '1') {
      return orgs[0];
    }

    return null;
  } catch (error) {
    logger.error({ error, code }, 'Error getting organization by merchant code');
    return null;
  }
}

/**
 * Get organization by Twilio phone number
 * Primary lookup for webhook handlers
 */
export async function getOrganizationByPhone(
  phone: string
): Promise<Organization | null> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('twilio_phone_number', phone)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found by dedicated number - check first organization or fallback
        logger.debug({ phone }, 'Organization not found by direct dedicated phone');
        const { data: firstOrg } = await supabase
          .from('organizations')
          .select('*')
          .limit(1)
          .single();

        return firstOrg || null;
      }
      throw error;
    }

    logger.debug({ orgId: data.id, phone }, 'Organization found by phone');
    return data;
  } catch (error) {
    logger.error({ error, phone }, 'Error getting organization by phone');
    return null;
  }
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(
  orgId: string
): Promise<Organization> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Organization');
      }
      throw error;
    }

    logger.debug({ orgId }, 'Organization found by ID');
    return data;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error({ error, orgId }, 'Error getting organization by ID');
    throw new AppError('Failed to get organization', 500);
  }
}

// ==============================================
// Update Organization
// ==============================================

/**
 * Update organization settings
 */
export async function updateOrganization(
  orgId: string,
  updates: Partial<Organization>
): Promise<Organization> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Organization');
      }
      throw error;
    }

    logger.info({ orgId, fields: Object.keys(updates) }, 'Organization updated');
    return data;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error({ error, orgId }, 'Error updating organization');
    throw new AppError('Failed to update organization', 500);
  }
}

// ==============================================
// List Organizations (for admin)
// ==============================================

/**
 * List all organizations (paginated)
 */
export async function listOrganizations(params: {
  limit?: number;
  offset?: number;
}): Promise<{ organizations: Organization[]; total: number }> {
  const { limit = 50, offset = 0 } = params;

  try {
    const { data, error, count } = await supabase
      .from('organizations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      organizations: data || [],
      total: count || 0,
    };
  } catch (error) {
    logger.error({ error, limit, offset }, 'Error listing organizations');
    throw new AppError('Failed to list organizations', 500);
  }
}
