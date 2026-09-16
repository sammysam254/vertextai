// ==============================================
// Supabase Client Configuration
// ==============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config } from './config';
import { createLogger } from './logger';

const logger = createLogger('supabase');

// Polyfill global WebSocket for Node.js environments (especially Node < 22)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = ws;
}

// ==============================================
// Supabase Client (Service Role)
// ==============================================

/**
 * Supabase client with service_role key
 * - Bypasses Row Level Security (RLS)
 * - Used for webhook handlers and system operations
 * - DO NOT expose to client-side code
 */
export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    realtime: {
      transport: ws as any,
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      fetch: fetch.bind(globalThis),
    },
  }
);

logger.info('Supabase client initialized with service_role key');

// ==============================================
// Database Health Check
// ==============================================

export async function checkDatabaseHealth(): Promise<{
  status: 'up' | 'down';
  latency?: number;
}> {
  const startTime = Date.now();
  try {
    // Simple query to check connectivity
    const { error } = await supabase.from('organizations').select('id').limit(1);

    if (error) {
      logger.error({ error }, 'Database health check failed');
      return { status: 'down' };
    }

    const latency = Date.now() - startTime;
    return { status: 'up', latency };
  } catch (error) {
    logger.error({ error }, 'Database health check error');
    return { status: 'down' };
  }
}

// ==============================================
// Helper: Set RLS Context (for webhook operations)
// ==============================================

/**
 * Set Supabase context for RLS policies
 * NOT needed when using service_role key (bypasses RLS)
 * Kept for reference if switching to user-scoped operations
 */
export function setRLSContext(organizationId: string) {
  // Service role bypasses RLS, so this is a no-op
  // If using anon key, you would set JWT claims here
  logger.debug({ organizationId }, 'RLS context (service_role bypasses RLS)');
}
