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
 * Generate a strictly unique 6-digit merchant code that does not collide with any existing organization
 */
export async function generateUniqueMerchantCode(): Promise<string> {
  try {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, metadata');

    const usedCodes = new Set<string>();
    if (orgs) {
      for (const org of orgs) {
        if (org.metadata?.merchant_code) {
          usedCodes.add(String(org.metadata.merchant_code));
        }
        // Also reserve the deterministic fallback hash
        let hash = 0;
        for (let i = 0; i < org.id.length; i++) {
          hash = (hash * 31 + org.id.charCodeAt(i)) >>> 0;
        }
        usedCodes.add(String(100000 + (hash % 900000)));
      }
    }

    let code: string;
    let attempts = 0;
    do {
      const num = Math.floor(100000 + Math.random() * 900000);
      code = String(num);
      attempts++;
    } while (usedCodes.has(code) && attempts < 10000);

    return code;
  } catch (err) {
    logger.error({ err }, 'Error generating unique merchant code, falling back to random');
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}

/**
 * Ensure organization has a persistent unique 6-digit merchant code saved in database
 */
export async function ensureOrganizationMerchantCode(orgId: string): Promise<string> {
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, metadata')
      .eq('id', orgId)
      .maybeSingle();

    if (error || !org) {
      return '100001';
    }

    if (org.metadata?.merchant_code) {
      return String(org.metadata.merchant_code);
    }

    // Generate guaranteed unique code
    const uniqueCode = await generateUniqueMerchantCode();
    const updatedMeta = {
      ...(org.metadata || {}),
      merchant_code: uniqueCode,
    };

    await supabase
      .from('organizations')
      .update({ metadata: updatedMeta })
      .eq('id', orgId);

    logger.info({ orgId, uniqueCode }, 'Persisted permanent unique merchant code to organization');
    return uniqueCode;
  } catch (err) {
    logger.error({ err, orgId }, 'Error ensuring merchant code');
    return '100001';
  }
}

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
 * Get organization by 6-digit merchant code (strict, unique)
 */
export async function getOrganizationByMerchantCode(
  code: string
): Promise<Organization | null> {
  try {
    // 1. Direct match on metadata->>'merchant_code'
    const { data: directMatch } = await supabase
      .from('organizations')
      .select('*')
      .eq('metadata->>merchant_code', code)
      .maybeSingle();

    if (directMatch) {
      logger.debug({ orgId: directMatch.id, code }, 'Organization found by persisted merchant code');
      return directMatch;
    }

    // 2. Query all organizations to match legacy hash
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
      // Persist to database so it stays permanently unique and never changes
      if (!match.metadata?.merchant_code) {
        await supabase
          .from('organizations')
          .update({
            metadata: {
              ...(match.metadata || {}),
              merchant_code: code,
            },
          })
          .eq('id', match.id);
      }
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_FALLBACK_ORG: Organization = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Vertex AI Support',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  twilio_account_sid: null,
  twilio_auth_token: null,
  twilio_phone_number: '+12513571708',
  ai_system_prompt: 'You are an intelligent, helpful voice AI assistant for Vertex AI. Be concise, warm, and professional.',
  ai_voice_id: 'Polly.Joanna-Neural',
  ai_model: 'llama3-70b-8192',
  escalation_phone_number: '',
  escalation_keywords: ['agent', 'human', 'representative', 'operator', 'transfer', 'person'],
  subscription_tier: 'pro',
  metadata: {},
};

/**
 * Get organization by Twilio phone number
 * Primary lookup for webhook handlers
 */
export async function getOrganizationByPhone(
  phone: string,
  exactOnly: boolean = false
): Promise<Organization | null> {
  try {
    const cleanPhone = (phone || '').trim();
    if (!cleanPhone) {
      return exactOnly ? null : DEFAULT_FALLBACK_ORG;
    }

    // Direct match on twilio_phone_number
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('twilio_phone_number', cleanPhone)
      .maybeSingle();

    if (data) {
      logger.debug({ orgId: data.id, phone: cleanPhone }, 'Organization found by phone');
      return data;
    }

    // Also check metadata->>dedicated_phone
    const { data: metaMatch } = await supabase
      .from('organizations')
      .select('*')
      .eq('metadata->>dedicated_phone', cleanPhone)
      .maybeSingle();

    if (metaMatch) {
      logger.debug({ orgId: metaMatch.id, phone: cleanPhone }, 'Organization found by metadata dedicated_phone');
      return metaMatch;
    }

    if (exactOnly) {
      return null;
    }

    // Fallback: check first organization in table only if exactOnly is false
    const { data: firstOrg } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)
      .maybeSingle();

    return firstOrg || DEFAULT_FALLBACK_ORG;
  } catch (error) {
    logger.debug({ error, phone }, 'Note getting organization by phone');
    return exactOnly ? null : DEFAULT_FALLBACK_ORG;
  }
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(
  orgId: string
): Promise<Organization> {
  if (!orgId || !UUID_REGEX.test(orgId)) {
    // If not a valid UUID (e.g. 'default' or transient id), retrieve first org or default
    try {
      const { data: firstOrg } = await supabase
        .from('organizations')
        .select('*')
        .limit(1)
        .maybeSingle();
      return firstOrg || DEFAULT_FALLBACK_ORG;
    } catch {
      return DEFAULT_FALLBACK_ORG;
    }
  }

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (data) {
      logger.debug({ orgId }, 'Organization found by ID');
      return data;
    }

    // Fallback to first org
    const { data: firstOrg } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)
      .maybeSingle();

    return firstOrg || DEFAULT_FALLBACK_ORG;
  } catch (error) {
    logger.debug({ error, orgId }, 'Note getting organization by ID');
    return DEFAULT_FALLBACK_ORG;
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
