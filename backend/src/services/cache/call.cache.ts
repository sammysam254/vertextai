// ==============================================
// Call State Caching Service
// ==============================================

import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { CacheKeys, getCached, setCached, deleteCached } from '@/lib/redis';
import type { CallState } from '@/types';

const logger = createLogger('cache:call');

// ==============================================
// Call State Management
// ==============================================

/**
 * Get active call state (conversation context)
 */
export async function getCallState(callSid: string): Promise<CallState | null> {
  const key = CacheKeys.callState(callSid);

  try {
    const cached = await getCached<CallState>(key);
    if (cached) {
      logger.debug({ callSid, turnCount: cached.turnCount }, 'Call state retrieved');
      return cached;
    }

    logger.debug({ callSid }, 'No call state found (new call)');
    return null;
  } catch (error) {
    logger.error({ error, callSid }, 'Error getting call state');
    return null;
  }
}

/**
 * Initialize new call state
 */
export async function initializeCallState(
  callSid: string,
  organizationId: string,
  contactId: string,
  communicationId: string
): Promise<CallState> {
  const state: CallState = {
    organizationId,
    contactId,
    communicationId,
    conversationContext: [],
    turnCount: 0,
    startTime: Date.now(),
  };

  await setCallState(callSid, state);
  logger.info({ callSid, communicationId }, 'Call state initialized');

  return state;
}

/**
 * Update call state (add conversation turn)
 */
export async function setCallState(
  callSid: string,
  state: CallState
): Promise<void> {
  const key = CacheKeys.callState(callSid);
  const ttl = config.cacheCallTtl; // 2 hours

  try {
    await setCached(key, state, ttl);
    logger.debug({ callSid, turnCount: state.turnCount }, 'Call state updated');
  } catch (error) {
    logger.error({ error, callSid }, 'Error setting call state');
  }
}

/**
 * Append conversation turn to call state
 */
export async function appendCallTurn(
  callSid: string,
  role: 'user' | 'assistant',
  content: string
): Promise<CallState | null> {
  try {
    const state = await getCallState(callSid);
    if (!state) {
      logger.warn({ callSid }, 'Cannot append turn: call state not found');
      return null;
    }

    // Add new turn
    state.conversationContext.push({ role, content });
    state.turnCount += 1;

    // Trim context window (keep last 10 turns to avoid memory bloat)
    const maxContextTurns = 10;
    if (state.conversationContext.length > maxContextTurns) {
      state.conversationContext = state.conversationContext.slice(-maxContextTurns);
    }

    await setCallState(callSid, state);

    return state;
  } catch (error) {
    logger.error({ error, callSid }, 'Error appending call turn');
    return null;
  }
}

/**
 * Clear call state (after call completes)
 */
export async function clearCallState(callSid: string): Promise<void> {
  const key = CacheKeys.callState(callSid);

  try {
    await deleteCached(key);
    logger.info({ callSid }, 'Call state cleared');
  } catch (error) {
    logger.error({ error, callSid }, 'Error clearing call state');
  }
}

/**
 * Get call duration in seconds
 */
export async function getCallDuration(callSid: string): Promise<number> {
  const state = await getCallState(callSid);
  if (!state) return 0;

  const durationMs = Date.now() - state.startTime;
  return Math.floor(durationMs / 1000);
}

/**
 * Check if call is active (state exists)
 */
export async function isCallActive(callSid: string): Promise<boolean> {
  const state = await getCallState(callSid);
  return state !== null;
}
