// ==============================================
// Message Database Service
// ==============================================

import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { AppError } from '@/middleware';
import type { Message } from '@/types';

const logger = createLogger('db:message');

// ==============================================
// Create Message
// ==============================================

/**
 * Create new SMS message
 */
export async function createMessage(params: {
  organizationId: string;
  communicationId: string;
  sender: Message['sender'];
  body: string;
  mediaUrls?: string[];
}): Promise<Message> {
  const { organizationId, communicationId, sender, body, mediaUrls } = params;

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        organization_id: organizationId,
        communication_id: communicationId,
        sender,
        body,
        media_urls: mediaUrls || null,
      })
      .select()
      .single();

    if (error) throw error;

    logger.debug(
      { messageId: data.id, communicationId, sender },
      'Message created'
    );
    return data;
  } catch (error) {
    logger.error({ error, communicationId }, 'Error creating message');
    throw new AppError('Failed to create message', 500);
  }
}

// ==============================================
// Get Messages
// ==============================================

/**
 * Get message thread for communication
 */
export async function getMessageThread(
  communicationId: string
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('communication_id', communicationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    logger.error({ error, communicationId }, 'Error getting message thread');
    throw new AppError('Failed to get messages', 500);
  }
}

/**
 * List recent messages for organization
 */
export async function listRecentMessages(params: {
  organizationId: string;
  limit?: number;
}): Promise<Message[]> {
  const { organizationId, limit = 100 } = params;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    logger.error({ error, organizationId }, 'Error listing messages');
    throw new AppError('Failed to list messages', 500);
  }
}
