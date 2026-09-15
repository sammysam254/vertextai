'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  phone_number: string;
  email: string | null;
  status: 'available' | 'in_call' | 'busy' | 'offline';
  is_active: boolean;
  last_status_change_at: string;
}

export interface TransferCallParams {
  callSid: string;
  organizationId: string;
  agentPhone: string;
  agentName?: string;
}

export type TransferStatus = 'idle' | 'loading' | 'success' | 'error';

// ─── useAgents ────────────────────────────────────────────────────────────────

/**
 * Fetch the agent list for an organization.
 * Only fetches when organizationId is non-null and enabled=true.
 */
export function useAgents(
  organizationId: string | null,
  enabled: boolean = true
) {
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!organizationId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.get<{ agents: Agent[] }>(
        `/api/v1/agents?organizationId=${encodeURIComponent(organizationId)}`
      );
      setAgents(data.agents);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [organizationId, enabled]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, loading, error, refetch: fetchAgents };
}

// ─── useTransferCall ──────────────────────────────────────────────────────────

/**
 * Transfer a live call to an agent phone number.
 * Returns a transfer() action, the current status, and a reset() helper.
 */
export function useTransferCall() {
  const [status, setStatus] = useState<TransferStatus>('idle');

  const transfer = useCallback(async (params: TransferCallParams) => {
    setStatus('loading');
    try {
      await api.post('/api/v1/voice/transfer', {
        callSid:        params.callSid,
        organizationId: params.organizationId,
        agentPhone:     params.agentPhone,
        agentName:      params.agentName,
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => setStatus('idle'), []);

  return { transfer, status, reset };
}

// ─── useLiveCalls ─────────────────────────────────────────────────────────────

export interface LiveCallRow {
  callSid: string;
  fromNumber: string;
  toNumber: string;
  contactName: string | null;
  organizationId: string;
  startedAt: string;
  durationSeconds: number;
  status: string;
  escalated: boolean;
  transferStatus: string | null;
}

/**
 * Poll the backend for in-progress calls every `intervalMs` milliseconds.
 * Falls back to an empty array if the request fails.
 */
export function useLiveCalls(
  organizationId: string | null,
  intervalMs: number = 5000
) {
  const [calls, setCalls]     = useState<LiveCallRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalls = useCallback(async () => {
    if (!organizationId) return;
    try {
      const data = await api.get<{ communications: any[]; total: number }>(
        `/api/v1/voice/live?organizationId=${encodeURIComponent(organizationId)}`
      );
      const rows: LiveCallRow[] = (data.communications ?? []).map((c: any) => ({
        callSid:         c.twilio_sid,
        fromNumber:      c.from_number,
        toNumber:        c.to_number,
        contactName:     c.contact?.name ?? null,
        organizationId:  c.organization_id,
        startedAt:       c.created_at,
        durationSeconds: c.duration_seconds ?? 0,
        status:          c.status,
        escalated:       c.escalated_to_human ?? false,
        transferStatus:  c.transfer_status ?? null,
      }));
      setCalls(rows);
    } catch {
      // silent — keep stale data
    }
  }, [organizationId]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchCalls().finally(() => setLoading(false));
  }, [fetchCalls]);

  // Polling
  useEffect(() => {
    if (!organizationId) return;
    const id = setInterval(fetchCalls, intervalMs);
    return () => clearInterval(id);
  }, [fetchCalls, organizationId, intervalMs]);

  return { calls, loading, refetch: fetchCalls };
}
