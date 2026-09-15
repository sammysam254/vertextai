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
        // Not found
        logger.debug({ phone }, 'Organization not found by phone');
        return null;
      }
      throw error;
    }

    logger.debug({ orgId: data.id, phone }, 'Organization found by phone');
    return data;
  } catch (error) {
    logger.error({ error, phone }, 'Error getting organization by phone');
    throw new AppError('Failed to get organization', 500);
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
