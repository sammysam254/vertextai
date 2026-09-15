'use client';

import { useState, useEffect, useCallback } from 'react';
import { PhoneForwarded, Phone, User, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { useAgents, useTransferCall } from '@/lib/hooks/useCalls';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiveCall {
  callSid: string;
  fromNumber: string;
  contactName?: string | null;
  organizationId: string;
  startedAt: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: LiveCall | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransferModal({ isOpen, onClose, call }: TransferModalProps) {
  const [tab, setTab]               = useState<'agent' | 'manual'>('agent');
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName]   = useState('');
  const [phoneError, setPhoneError]   = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { agents, loading: agentsLoading } = useAgents(
    call?.organizationId ?? null,
    isOpen
  );

  const {
    transfer,
    status: transferStatus,
    reset: resetTransfer,
  } = useTransferCall();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setManualPhone('');
      setManualName('');
      setPhoneError('');
      setSelectedAgentId(null);
      setTab('agent');
      resetTransfer();
    }
  }, [isOpen, resetTransfer]);

  // Auto-close after successful transfer
  useEffect(() => {
    if (transferStatus === 'success') {
      const t = setTimeout(onClose, 1800);
      return () => clearTimeout(t);
    }
  }, [transferStatus, onClose]);

  const validatePhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10) return 'Enter a valid phone number (min 10 digits)';
    return '';
  };

  const handleTransfer = useCallback(async () => {
    if (!call) return;

    if (tab === 'manual') {
      const err = validatePhone(manualPhone);
      if (err) { setPhoneError(err); return; }
      setPhoneError('');
      await transfer({
        callSid:        call.callSid,
        organizationId: call.organizationId,
        agentPhone:     formatPhoneNumber(manualPhone),
        agentName:      manualName || undefined,
      });
    } else {
      const agent = agents.find(a => a.id === selectedAgentId);
      if (!agent) return;
      await transfer({
        callSid:        call.callSid,
        organizationId: call.organizationId,
        agentPhone:     agent.phone_number,
        agentName:      agent.name,
      });
    }
  }, [call, tab, manualPhone, manualName, selectedAgentId, agents, transfer]);

  const canTransfer =
    transferStatus !== 'loading' &&
    transferStatus !== 'success' &&
    (tab === 'manual'
      ? manualPhone.replace(/\D/g, '').length >= 10
      : selectedAgentId !== null);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Call"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={transferStatus === 'loading'}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleTransfer}
            disabled={!canTransfer}
            isLoading={transferStatus === 'loading'}
          >
            <PhoneForwarded className="h-4 w-4" />
            Transfer
          </Button>
        </>
      }
    >
      {/* Caller info banner */}
      {call && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-navy-dark-elevated border border-navy-dark-border mb-5">
          <Phone className="h-4 w-4 text-accent-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-slate-blue-400 uppercase tracking-wide">Active Call</p>
            <p className="text-white font-mono text-sm truncate">{call.fromNumber}</p>
            {call.contactName && (
              <p className="text-slate-blue-300 text-xs truncate">{call.contactName}</p>
            )}
          </div>
        </div>
      )}

      {/* Success / Error feedback */}
      {transferStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-status-available/10 border border-status-available/30 mb-4">
          <CheckCircle className="h-4 w-4 text-status-available flex-shrink-0" />
          <p className="text-status-available text-sm">Call transferred successfully</p>
        </div>
      )}
      {transferStatus === 'error' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-danger/10 border border-accent-danger/30 mb-4">
          <XCircle className="h-4 w-4 text-accent-danger flex-shrink-0" />
          <p className="text-accent-danger text-sm">Transfer failed — check the number and try again</p>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex rounded-lg overflow-hidden border border-navy-dark-border mb-5">
        {(['agent', 'manual'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-accent-primary text-white'
                : 'bg-navy-dark-elevated text-slate-blue-400 hover:text-white'
            )}
          >
            {t === 'agent' ? 'Select Agent' : 'Enter Number'}
          </button>
        ))}
      </div>

      {/* ── Agent picker tab ─────────────────────────────────────────── */}
      {tab === 'agent' && (
        <div className="space-y-2">
          {agentsLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading agents...</span>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-8 w-8 text-slate-blue-600 mx-auto mb-2" />
              <p className="text-slate-blue-400 text-sm">No agents configured</p>
              <p className="text-slate-blue-500 text-xs mt-1">
                Use the &quot;Enter Number&quot; tab or add agents in Settings
              </p>
            </div>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                  selectedAgentId === agent.id
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-navy-dark-border bg-navy-dark-elevated hover:border-slate-blue-600'
                )}
              >
                {/* Status dot */}
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full flex-shrink-0',
                    agent.status === 'available'  && 'bg-status-available',
                    agent.status === 'busy'        && 'bg-status-waiting',
                    agent.status === 'in_call'     && 'bg-status-in-call',
                    agent.status === 'offline'     && 'bg-slate-blue-600'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-slate-blue-400 text-xs font-mono truncate">
                    {agent.phone_number}
                  </p>
                </div>
                <Badge
                  variant={
                    agent.status === 'available' ? 'available'
                    : agent.status === 'in_call' ? 'in-call'
                    : agent.status === 'busy'    ? 'waiting'
                    : 'offline'
                  }
                >
                  {agent.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Manual number tab ────────────────────────────────────────── */}
      {tab === 'manual' && (
        <div className="space-y-4">
          <Input
            label="Phone Number"
            placeholder="+1 555 000 0000"
            value={manualPhone}
            onChange={(e) => {
              setManualPhone(e.target.value);
              if (phoneError) setPhoneError(validatePhone(e.target.value));
            }}
            error={phoneError}
            helperText="Enter the agent's number in E.164 format"
            type="tel"
            autoFocus
          />
          <Input
            label="Agent Name (optional)"
            placeholder="e.g. John Smith"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
