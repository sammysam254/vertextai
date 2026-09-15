// ==============================================
// SMS Conversation Context Caching Service
// ==============================================

import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { CacheKeys, getCached, setCached, deleteCached } from '@/lib/redis';
import type { SMSContext } from '@/types';

const logger = createLogger('cache:sms');

// ==============================================
// SMS Conversation Context Management
// ==============================================

/**
 * Get SMS conversation context for a contact
 */
export async function getSMSContext(
  orgId: string,
  contactPhone: string
): Promise<SMSContext | null> {
  const key = CacheKeys.smsContext(orgId, contactPhone);

  try {
    const cached = await getCached<SMSContext>(key);
    if (cached) {
      logger.debug(
        { orgId, contactPhone, messageCount: cached.messages.length },
        'SMS context retrieved'
      );
      return cached;
    }

    logger.debug({ orgId, contactPhone }, 'No SMS context found (new conversation)');
    return null;
  } catch (error) {
    logger.error({ error, orgId, contactPhone }, 'Error getting SMS context');
    return null;
  }
}

/**
 * Initialize new SMS conversation context
 */
export async function initializeSMSContext(
  orgId: string,
  contactPhone: string
): Promise<SMSContext> {
  const context: SMSContext = {
    messages: [],
    lastMessageAt: Date.now(),
  };

  await setSMSContext(orgId, contactPhone, context);
  logger.info({ orgId, contactPhone }, 'SMS context initialized');

  return context;
}

/**
 * Update SMS conversation context
 */
export async function setSMSContext(
  orgId: string,
  contactPhone: string,
  context: SMSContext
): Promise<void> {
  const key = CacheKeys.smsContext(orgId, contactPhone);
  const ttl = config.cacheSmsTtl; // 1 hour

  try {
    await setCached(key, context, ttl);
    logger.debug(
      { orgId, contactPhone, messageCount: context.messages.length },
      'SMS context updated'
    );
  } catch (error) {
    logger.error({ error, orgId, contactPhone }, 'Error setting SMS context');
  }
}

/**
 * Append message to SMS conversation context
 */
export async function appendSMSMessage(
  orgId: string,
  contactPhone: string,
  sender: 'customer' | 'ai',
  body: string
): Promise<SMSContext | null> {
  try {
    let context = await getSMSContext(orgId, contactPhone);

    // Initialize if doesn't exist
    if (!context) {
      context = await initializeSMSContext(orgId, contactPhone);
    }

    // Add new message
    context.messages.push({
      sender,
      body,
      timestamp: Date.now(),
    });

    // Update last message timestamp
    context.lastMessageAt = Date.now();

    // Trim context window (keep last 20 messages to avoid memory bloat)
    const maxContextMessages = 20;
    if (context.messages.length > maxContextMessages) {
      context.messages = context.messages.slice(-maxContextMessages);
    }

    await setSMSContext(orgId, contactPhone, context);

    return context;
  } catch (error) {
    logger.error({ error, orgId, contactPhone }, 'Error appending SMS message');
    return null;
  }
}

/**
 * Clear SMS conversation context
 */
export async function clearSMSContext(
  orgId: string,
  contactPhone: string
): Promise<void> {
  const key = CacheKeys.smsContext(orgId, contactPhone);

  try {
    await deleteCached(key);
    logger.info({ orgId, contactPhone }, 'SMS context cleared');
  } catch (error) {
    logger.error({ error, orgId, contactPhone }, 'Error clearing SMS context');
  }
}

/**
 * Get recent messages from context
 */
export async function getRecentSMSMessages(
  orgId: string,
  contactPhone: string,
  limit: number = 10
): Promise<SMSContext['messages']> {
  const context = await getSMSContext(orgId, contactPhone);
  if (!context || context.messages.length === 0) {
    return [];
  }

  return context.messages.slice(-limit);
}

/**
 * Check if SMS conversation is active (has recent messages)
 */
export async function isSMSConversationActive(
  orgId: string,
  contactPhone: string,
  maxAgeMinutes: number = 60
): Promise<boolean> {
  const context = await getSMSContext(orgId, contactPhone);
  if (!context) return false;

  const ageMs = Date.now() - context.lastMessageAt;
  const ageMinutes = ageMs / 1000 / 60;

  return ageMinutes <= maxAgeMinutes;
}
