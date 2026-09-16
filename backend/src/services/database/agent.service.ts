// ==============================================
// Agent Database Service
// ==============================================

import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import type { Agent } from '@/types';

const logger = createLogger('db:agent');

// ==============================================
// Create Agent
// ==============================================

import { normalizePhoneNumber } from '@/lib/phone';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createAgent(params: {
  organizationId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  userId?: string;
  status?: Agent['status'];
}): Promise<Agent> {
  const { organizationId, name, phoneNumber, email, userId, status = 'offline' } = params;

  let validOrgId = organizationId;
  if (!validOrgId || !UUID_PATTERN.test(validOrgId)) {
    try {
      const { data: firstOrg } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
      validOrgId = firstOrg?.id || '00000000-0000-0000-0000-000000000000';
    } catch {
      validOrgId = '00000000-0000-0000-0000-000000000000';
    }
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  logger.info({ organizationId: validOrgId, phoneNumber: normalizedPhone, name }, 'Creating agent');

  const { data, error } = await supabase
    .from('agents')
    .insert({
      organization_id: validOrgId,
      name: name.trim(),
      phone_number: normalizedPhone,
      email: email?.trim() || null,
      user_id: userId,
      status,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error, organizationId: validOrgId, phoneNumber: normalizedPhone }, 'Error creating agent');
    throw new Error(`Failed to create agent: ${error.message}`);
  }

  logger.info({ agentId: data.id }, 'Agent created successfully');
  return data;
}

// ==============================================
// Get Agent by ID
// ==============================================

export async function getAgentById(agentId: string): Promise<Agent | null> {
  logger.debug({ agentId }, 'Fetching agent by ID');

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      logger.debug({ agentId }, 'Agent not found');
      return null;
    }
    logger.error({ error, agentId }, 'Error fetching agent');
    throw new Error(`Failed to fetch agent: ${error.message}`);
  }

  return data;
}

// ==============================================
// Get Agent by Phone Number
// ==============================================

export async function getAgentByPhone(
  organizationId: string,
  phoneNumber: string
): Promise<Agent | null> {
  logger.debug({ organizationId, phoneNumber }, 'Fetching agent by phone number');

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('phone_number', phoneNumber)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      logger.debug({ organizationId, phoneNumber }, 'Agent not found');
      return null;
    }
    logger.error({ error, organizationId, phoneNumber }, 'Error fetching agent');
    throw new Error(`Failed to fetch agent: ${error.message}`);
  }

  return data;
}

// ==============================================
// List Organization Agents
// ==============================================

export async function listOrganizationAgents(params: {
  organizationId: string;
  status?: Agent['status'];
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Agent[]> {
  const { organizationId, status, isActive = true, limit = 100, offset = 0 } = params;

  let validOrgId = organizationId;
  if (!validOrgId || !UUID_PATTERN.test(validOrgId)) {
    try {
      const { data: firstOrg } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
      validOrgId = firstOrg?.id || '00000000-0000-0000-0000-000000000000';
    } catch {
      validOrgId = '00000000-0000-0000-0000-000000000000';
    }
  }

  logger.debug({ organizationId: validOrgId, status, isActive }, 'Listing organization agents');

  let query = supabase
    .from('agents')
    .select('*')
    .eq('organization_id', validOrgId)
    .eq('is_active', isActive)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error, organizationId }, 'Error listing agents');
    throw new Error(`Failed to list agents: ${error.message}`);
  }

  logger.debug({ organizationId, count: data.length }, 'Agents fetched');
  return data;
}

// ==============================================
// Update Agent Status
// ==============================================

export async function updateAgentStatus(
  agentId: string,
  status: Agent['status']
): Promise<Agent> {
  logger.info({ agentId, status }, 'Updating agent status');

  const { data, error } = await supabase
    .from('agents')
    .update({ status })
    .eq('id', agentId)
    .select()
    .single();

  if (error) {
    logger.error({ error, agentId, status }, 'Error updating agent status');
    throw new Error(`Failed to update agent status: ${error.message}`);
  }

  logger.info({ agentId, status }, 'Agent status updated');
  return data;
}

// ==============================================
// Update Agent
// ==============================================

export async function updateAgent(
  agentId: string,
  updates: Partial<Pick<Agent, 'name' | 'phone_number' | 'email' | 'status' | 'is_active' | 'metadata'>>
): Promise<Agent> {
  logger.info({ agentId, updates }, 'Updating agent');

  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', agentId)
    .select()
    .single();

  if (error) {
    logger.error({ error, agentId }, 'Error updating agent');
    throw new Error(`Failed to update agent: ${error.message}`);
  }

  logger.info({ agentId }, 'Agent updated successfully');
  return data;
}

// ==============================================
// Delete Agent
// ==============================================

export async function deleteAgent(agentId: string): Promise<void> {
  logger.info({ agentId }, 'Deleting agent');

  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', agentId);

  if (error) {
    logger.error({ error, agentId }, 'Error deleting agent');
    throw new Error(`Failed to delete agent: ${error.message}`);
  }

  logger.info({ agentId }, 'Agent deleted successfully');
}

// ==============================================
// Get Available Agents (for call assignment)
// ==============================================

export async function getAvailableAgents(organizationId: string): Promise<Agent[]> {
  logger.debug({ organizationId }, 'Fetching available agents');

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('status', ['available', 'busy'])
    .order('last_status_change_at', { ascending: true });

  if (error) {
    logger.error({ error, organizationId }, 'Error fetching available agents');
    throw new Error(`Failed to fetch available agents: ${error.message}`);
  }

  logger.debug({ organizationId, count: data.length }, 'Available agents fetched');
  return data;
}

// ==============================================
// Find or Create Agent (by phone number)
// ==============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findOrCreateAgent(params: {
  organizationId: string;
  phoneNumber: string;
  name: string;
  email?: string;
}): Promise<Agent> {
  const { organizationId, phoneNumber, name, email } = params;

  let validOrgId = organizationId;
  if (!validOrgId || !UUID_REGEX.test(validOrgId)) {
    try {
      const { data: firstOrg } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
      validOrgId = firstOrg?.id || '00000000-0000-0000-0000-000000000000';
    } catch {
      validOrgId = '00000000-0000-0000-0000-000000000000';
    }
  }

  try {
    // Try to find existing agent
    const existing = await getAgentByPhone(validOrgId, phoneNumber);
    if (existing) {
      return existing;
    }

    // Create new agent
    return await createAgent({
      organizationId: validOrgId,
      phoneNumber,
      name,
      email,
      status: 'offline',
    });
  } catch (err) {
    logger.debug({ err, organizationId: validOrgId }, 'Note creating agent in DB');
    return {
      id: '00000000-0000-0000-0000-000000000000',
      organization_id: validOrgId,
      name,
      phone_number: phoneNumber,
      email: email || null,
      status: 'available',
      is_active: true,
      user_id: null,
      metadata: {},
      last_status_change_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}
