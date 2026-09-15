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

  try {
    const { data, error } = await supabase
      .from('communications')
      .insert({
        organization_id: organizationId,
        contact_id: contactId,
        type,
        twilio_sid: twilioSid,
        from_number: fromNumber,
        to_number: toNumber,
        status,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(
      { communicationId: data.id, type, twilioSid },
      'Communication created'
    );
    return data;
  } catch (error) {
    logger.error({ error, twilioSid }, 'Error creating communication');
    throw new AppError('Failed to create communication', 500);
  }
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
  try {
    const { data, error } = await supabase
      .from('communications')
      .select('*')
      .eq('id', commId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Communication');
      }
      throw error;
    }

    return data;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error({ error, commId }, 'Error getting communication');
    throw new AppError('Failed to get communication', 500);
  }
}

/**
 * Get communication by Twilio SID
 */
export async function getCommunicationByTwilioSid(
  twilioSid: string
): Promise<Communication | null> {
  try {
    const { data, error } = await supabase
      .from('communications')
      .select('*')
      .eq('twilio_sid', twilioSid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  } catch (error) {
    logger.error({ error, twilioSid }, 'Error getting communication by Twilio SID');
    throw new AppError('Failed to get communication', 500);
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
): Promise<Communication> {
  try {
    const { data, error } = await supabase
      .from('communications')
      .update(updates)
      .eq('id', commId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Communication');
      }
      throw error;
    }

    logger.debug({ commId, fields: Object.keys(updates) }, 'Communication updated');
    return data;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error({ error, commId }, 'Error updating communication');
    throw new AppError('Failed to update communication', 500);
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
