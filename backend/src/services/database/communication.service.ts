// ==============================================
// Communication Database Service
// ==============================================

import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { NotFoundError, AppError } from '@/middleware';
import type { Communication, CallTranscript } from '@/types';

const logger = createLogger('db:communication');

// ==============================================
// Create Communication
// ==============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create new communication record (call or SMS)
 */
export async function createCommunication(
  params: {
    organizationId: string;
    contactId: string | null;
    type: Communication['type'];
    twilioSid: string;
    fromNumber: string;
    toNumber: string;
    status?: string;
  }
): Promise<Communication> {
  const { organizationId, contactId, type, twilioSid, fromNumber, toNumber, status = 'initiated' } = params;

  let validOrgId = organizationId;
  if (!validOrgId || !UUID_REGEX.test(validOrgId)) {
    try {
      const { data: firstOrg } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
      validOrgId = firstOrg?.id || '00000000-0000-0000-0000-000000000000';
    } catch {
      validOrgId = '00000000-0000-0000-0000-000000000000';
    }
  }

  const validContactId = contactId && UUID_REGEX.test(contactId) ? contactId : null;

  try {
    const { data, error } = await supabase
      .from('communications')
      .insert({
        organization_id: validOrgId,
        contact_id: validContactId,
        type,
        twilio_sid: twilioSid,
        from_number: fromNumber,
        to_number: toNumber,
        status,
      })
      .select()
      .maybeSingle();

    if (data) {
      logger.info(
        { communicationId: data.id, type, twilioSid },
        'Communication created'
      );
      return data;
    }
  } catch (error) {
    logger.debug({ error, twilioSid }, 'Note creating communication in DB');
  }

  // Graceful fallback communication object
  return {
    id: '00000000-0000-0000-0000-000000000000',
    organization_id: validOrgId,
    contact_id: validContactId,
    type,
    twilio_sid: twilioSid,
    from_number: fromNumber,
    to_number: toNumber,
    status,
    duration_seconds: 0,
    escalated_to_human: false,
    escalation_reason: null,
    escalation_timestamp: null,
    transferred_to_agent_id: null,
    transferred_at: null,
    transfer_status: null,
    summary: null,
    sentiment: null,
    intent: null,
    cost_usd: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  };
}

// ==============================================
// Get Communication
// ==============================================

/**
 * Get communication by ID
 */
export async function getCommunicationById(
  commId: string
): Promise<Communication> {
  if (!commId || !UUID_REGEX.test(commId)) {
    throw new NotFoundError('Communication');
  }

  try {
    const { data, error } = await supabase
      .from('communications')
      .select('*')
      .eq('id', commId)
      .maybeSingle();

    if (!data) {
      throw new NotFoundError('Communication');
    }

    return data;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.debug({ error, commId }, 'Note getting communication by ID');
    throw new NotFoundError('Communication');
  }
}

/**
 * Get communication by Twilio SID
 */
export async function getCommunicationByTwilioSid(
  twilioSid: string
): Promise<Communication | null> {
  if (!twilioSid) return null;

  try {
    const { data, error } = await supabase
      .from('communications')
      .select('*')
      .eq('twilio_sid', twilioSid)
      .maybeSingle();

    if (error) {
      logger.debug({ error, twilioSid }, 'Note getting communication by Twilio SID');
      return null;
    }

    return data;
  } catch (error) {
    logger.debug({ error, twilioSid }, 'Exception getting communication by Twilio SID');
    return null;
  }
}

// ==============================================
// Update Communication
// ==============================================

/**
 * Update communication (status, duration, escalation, etc.)
 */
export async function updateCommunication(
  commId: string,
  updates: Partial<Communication>
): Promise<Communication | null> {
  if (!commId || !UUID_REGEX.test(commId)) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('communications')
      .update(updates)
      .eq('id', commId)
      .select()
      .maybeSingle();

    if (data) {
      logger.debug({ commId, fields: Object.keys(updates) }, 'Communication updated');
      return data;
    }
    return null;
  } catch (error) {
    logger.debug({ error, commId }, 'Note updating communication');
    return null;
  }
}

// ==============================================
// List Communications
// ==============================================

/**
 * List communications for organization (paginated, filtered)
 */
export async function listCommunications(params: {
  organizationId: string;
  type?: Communication['type'];
  status?: string;
  escalated?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ communications: Communication[]; total: number }> {
  const {
    organizationId,
    type,
    status,
    escalated,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = params;

  try {
    let query = supabase
      .from('communications')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (escalated !== undefined) query = query.eq('escalated_to_human', escalated);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      communications: data || [],
      total: count || 0,
    };
  } catch (error) {
    logger.error({ error, organizationId }, 'Error listing communications');
    throw new AppError('Failed to list communications', 500);
  }
}

// ==============================================
// Call Transcripts
// ==============================================

/**
 * Save call transcript turn
 */
export async function saveTranscriptTurn(params: {
  communicationId: string;
  speaker: CallTranscript['speaker'];
  content: string;
  confidence?: number;
}): Promise<CallTranscript> {
  const { communicationId, speaker, content, confidence } = params;

  try {
    const { data, error } = await supabase
      .from('call_transcripts')
      .insert({
        communication_id: communicationId,
        speaker,
        content,
        confidence,
      })
      .select()
      .single();

    if (error) throw error;

    logger.debug({ communicationId, speaker }, 'Transcript turn saved');
    return data;
  } catch (error) {
    logger.error({ error, communicationId }, 'Error saving transcript turn');
    throw new AppError('Failed to save transcript', 500);
  }
}

/**
 * Get full call transcript
 */
export async function getFullTranscript(
  communicationId: string
): Promise<CallTranscript[]> {
  try {
    const { data, error } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('communication_id', communicationId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    logger.error({ error, communicationId }, 'Error getting transcript');
    throw new AppError('Failed to get transcript', 500);
  }
}

/**
 * Auto-reap stale in-progress calls older than maxAgeMinutes or with terminal transfer_status
 */
export async function reapStaleCommunications(organizationId?: string): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago

    let query = supabase
      .from('communications')
      .select('id, duration_seconds, transfer_status, created_at')
      .in('status', ['in-progress', 'ringing'])
      .in('type', ['voice_in', 'voice_out']);

    if (organizationId && UUID_REGEX.test(organizationId)) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: staleCalls, error } = await query;
    if (error || !staleCalls || staleCalls.length === 0) {
      return 0;
    }

    const terminalTransferStatuses = ['completed', 'failed', 'busy', 'no_answer'];
    const idsToReap: string[] = [];

    for (const c of staleCalls) {
      const isOlderThanCutoff = new Date(c.created_at) < new Date(cutoff);
      const isTransferEnded = c.transfer_status && terminalTransferStatuses.includes(c.transfer_status);

      if (isOlderThanCutoff || isTransferEnded) {
        idsToReap.push(c.id);
      }
    }

    if (idsToReap.length === 0) return 0;

    const { error: updateErr } = await supabase
      .from('communications')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .in('id', idsToReap);

    if (updateErr) {
      logger.error({ updateErr }, 'Error updating stale communications');
      return 0;
    }

    logger.info({ reapedCount: idsToReap.length }, 'Reaped stale in-progress communications');
    return idsToReap.length;
  } catch (err) {
    logger.debug({ err }, 'Note running reapStaleCommunications');
    return 0;
  }
}
