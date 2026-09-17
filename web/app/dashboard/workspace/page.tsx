'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Briefcase,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  MessageSquare,
  CheckCircle2,
  Clock,
  UserCheck,
  Radio,
  Send,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, formatPhoneNumber, getRelativeTime, getApiEndpoint } from '@/lib/utils';
import Link from 'next/link';

interface QuickNote {
  id: string;
  text: string;
  completed: boolean;
  timestamp: string;
}

export default function WorkspacePage() {
  const { organizationId, merchantCode, organizationName, user } = useOrganization();
  const supabase = createClient();

  // Agent Status State
  const [agentStatus, setAgentStatus] = useState<'available' | 'in_call' | 'busy' | 'offline'>('available');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to take calls');

  // Quick Dial State
  const [quickPhone, setQuickPhone] = useState('');
  const [isDialing, setIsDialing] = useState(false);
  const [dialError, setDialError] = useState('');

  // Quick SMS State
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Recent Calls & Stats State
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({
    totalCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    avgDuration: 0,
  });
  const [loadingCalls, setLoadingCalls] = useState(true);

  // Quick Action Notes / Callbacks
  const [notes, setNotes] = useState<QuickNote[]>([
    { id: '1', text: 'Follow up with customer regarding order tracking #4092', completed: false, timestamp: '10 mins ago' },
    { id: '2', text: 'Review escalation rule for VIP merchant accounts', completed: true, timestamp: '1 hour ago' },
  ]);
  const [newNoteText, setNewNoteText] = useState('');

  const getApiEndpoint = (path: string): string => {
    if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
      return `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${path}`;
    }
    return path;
  };

  // Load merchant-specific calls and metrics
  const loadWorkspaceData = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoadingCalls(true);
      const { data: calls } = await supabase
        .from('communications')
        .select('id, type, from_number, to_number, status, duration_seconds, created_at, contacts ( name )')
        .eq('organization_id', organizationId)
        .in('type', ['voice_in', 'voice_out'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (calls) {
        setRecentCalls(calls);
        const total = calls.length;
        const inbound = calls.filter((c) => c.type === 'voice_in').length;
        const outbound = calls.filter((c) => c.type === 'voice_out').length;
        const totalDuration = calls.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
        const avg = total > 0 ? Math.round(totalDuration / total) : 0;

        setTodayStats({
          totalCalls: total,
          inboundCalls: inbound,
          outboundCalls: outbound,
          avgDuration: avg,
        });
      }
    } catch (e) {
      console.error('Error loading workspace calls:', e);
    } finally {
      setLoadingCalls(false);
    }
  }, [organizationId, supabase]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Handle Agent Status Change
  const handleStatusChange = async (newStatus: 'available' | 'in_call' | 'busy' | 'offline') => {
    setAgentStatus(newStatus);
    const messages = {
      available: 'Ready to take calls',
      in_call: 'Currently assisting a customer',
      busy: 'In a meeting / Do not disturb',
      offline: 'Away from workstation',
    };
    setStatusMessage(messages[newStatus]);

    if (organizationId && user?.id) {
      try {
        await supabase
          .from('agents')
          .update({ status: newStatus, last_status_change_at: new Date().toISOString() })
          .eq('organization_id', organizationId);
      } catch (e) {
        console.warn('Note updating agent table status:', e);
      }
    }
  };

  // Send Quick SMS
  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsPhone.trim() || !smsMessage.trim() || smsSending) return;

    setSmsSending(true);
    setSmsFeedback(null);

    try {
      const formatted = formatPhoneNumber(smsPhone);
      const res = await fetch(getApiEndpoint('/api/v1/sms/outbound'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formatted,
          body: smsMessage.trim(),
          from: process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708',
          organizationId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to dispatch SMS');
      }

      setSmsFeedback({ type: 'success', text: `SMS sent to ${formatted}` });
      setSmsPhone('');
      setSmsMessage('');
      setTimeout(() => setSmsFeedback(null), 3500);
    } catch (err: any) {
      setSmsFeedback({ type: 'error', text: err.message || 'Failed to send SMS' });
    } finally {
      setSmsSending(false);
    }
  };

  // Notes handling
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const newNote: QuickNote = {
      id: String(Date.now()),
      text: newNoteText.trim(),
      completed: false,
      timestamp: 'Just now',
    };
    setNotes([newNote, ...notes]);
    setNewNoteText('');
  };

  const handleToggleNote = (id: string) => {
    setNotes(notes.map((n) => (n.id === id ? { ...n, completed: !n.completed } : n)));
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">My Workspace</h1>
            <Badge variant="resolved">Live Station</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-blue-400">
            Dedicated workstation for {organizationName || 'Merchant'} • Merchant Code <span className="font-mono text-white font-bold">{merchantCode || '100001'}</span>
          </p>
        </div>

        {/* Live Agent Status Controls */}
        <div className="flex items-center gap-2 bg-navy-dark-panel p-2 rounded-xl border border-navy-dark-border shadow-md flex-wrap">
          <span className="text-xs text-slate-blue-400 mr-1 flex items-center gap-1.5 font-medium">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                agentStatus === 'available'
                  ? 'bg-accent-success animate-pulse'
                  : agentStatus === 'in_call'
                  ? 'bg-accent-primary animate-ping'
                  : agentStatus === 'busy'
                  ? 'bg-accent-danger'
                  : 'bg-slate-500'
              }`}
            />
            Status:
          </span>

          <button
            onClick={() => handleStatusChange('available')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              agentStatus === 'available'
                ? 'bg-accent-success text-white shadow-sm'
                : 'text-slate-blue-300 hover:bg-navy-dark-elevated'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => handleStatusChange('in_call')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              agentStatus === 'in_call'
                ? 'bg-accent-primary text-white shadow-sm'
                : 'text-slate-blue-300 hover:bg-navy-dark-elevated'
            }`}
          >
            In Call
          </button>
          <button
            onClick={() => handleStatusChange('busy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              agentStatus === 'busy'
                ? 'bg-accent-danger text-white shadow-sm'
                : 'text-slate-blue-300 hover:bg-navy-dark-elevated'
            }`}
          >
            Busy
          </button>
          <button
            onClick={() => handleStatusChange('offline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              agentStatus === 'offline'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-blue-300 hover:bg-navy-dark-elevated'
            }`}
          >
            Offline
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Panel className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-blue-400">Calls Handled</span>
            <Phone className="h-4 w-4 text-accent-primary" />
          </div>
          <p className="text-2xl font-bold text-white">{todayStats.totalCalls}</p>
          <span className="text-[10px] text-slate-blue-500">Inbound & Outbound</span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-blue-400">Inbound Routed</span>
            <PhoneIncoming className="h-4 w-4 text-chart-teal" />
          </div>
          <p className="text-2xl font-bold text-white">{todayStats.inboundCalls}</p>
          <span className="text-[10px] text-slate-blue-500">Via Code {merchantCode}</span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-blue-400">Outbound Placed</span>
            <PhoneOutgoing className="h-4 w-4 text-chart-cyan" />
          </div>
          <p className="text-2xl font-bold text-white">{todayStats.outboundCalls}</p>
          <span className="text-[10px] text-slate-blue-500">From Web Dialer</span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-blue-400">Avg Duration</span>
            <Clock className="h-4 w-4 text-accent-purple" />
          </div>
          <p className="text-2xl font-bold text-white">{formatDuration(todayStats.avgDuration)}</p>
          <span className="text-[10px] text-slate-blue-500">Talk time efficiency</span>
        </Panel>
      </div>

      {/* Main Workspace Grid: Action Widgets & Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quick Actions (Quick Dial + Quick SMS) */}
        <div className="space-y-6">
          {/* Quick Dial Station */}
          <Panel className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-accent-primary" />
                Quick Call
              </h2>
              <Link
                href="/dashboard/dialer"
                className="text-xs text-accent-primary hover:underline flex items-center gap-1"
              >
                Full Dialer &rarr;
              </Link>
            </div>
            <p className="text-xs text-slate-blue-400">
              Directly jump to the WebRTC audio dialer with a customer number:
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="e.g. +254706499848"
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                className="input text-sm font-mono flex-1 !h-10"
              />
              <Link
                href={`/dashboard/dialer${quickPhone ? `?number=${encodeURIComponent(quickPhone)}` : ''}` as any}
                className="btn btn-primary px-4 bg-accent-success hover:bg-accent-success/90 text-white font-semibold flex items-center justify-center rounded-lg text-sm"
              >
                <PhoneCall className="h-4 w-4" />
              </Link>
            </div>
          </Panel>

          {/* Quick SMS Dispatch */}
          <Panel className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-chart-teal" />
                Quick SMS Dispatch
              </h2>
              <Link
                href="/dashboard/inbox"
                className="text-xs text-chart-teal hover:underline flex items-center gap-1"
              >
                Open Inbox &rarr;
              </Link>
            </div>

            <form onSubmit={handleSendSms} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-blue-300 mb-1">
                  Recipient Phone
                </label>
                <input
                  type="tel"
                  placeholder="+254... or 07..."
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  className="input !h-9 text-xs font-mono w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-blue-300 mb-1">
                  Message Body
                </label>
                <textarea
                  placeholder="Type quick message or follow-up note..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-navy-dark border border-navy-dark-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-primary"
                  required
                />
              </div>

              {smsFeedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    smsFeedback.type === 'success'
                      ? 'bg-accent-success/20 text-accent-success border border-accent-success/30'
                      : 'bg-accent-danger/20 text-accent-danger border border-accent-danger/30'
                  }`}
                >
                  {smsFeedback.type === 'success' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{smsFeedback.text}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!smsPhone.trim() || !smsMessage.trim() || smsSending}
                className="w-full bg-accent-primary text-white text-xs h-9"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {smsSending ? 'Sending SMS...' : 'Send Instant SMS'}
              </Button>
            </form>
          </Panel>
        </div>

        {/* Center & Right Column: Activity Stream & Personal Task Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workspace Activity Stream */}
          <Panel className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-accent-primary animate-pulse" />
                <h2 className="text-base font-semibold text-white">Live Call Stream</h2>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadWorkspaceData}
                className="text-xs h-7 px-2.5"
              >
                Refresh
              </Button>
            </div>

            {loadingCalls ? (
              <div className="py-8 text-center text-xs text-slate-blue-400">Loading call activity...</div>
            ) : recentCalls.length === 0 ? (
              <div className="py-8 text-center text-slate-blue-400">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No calls logged yet today</p>
                <p className="text-xs text-slate-blue-500 mt-1">
                  Calls received with your merchant code <span className="text-white font-mono">{merchantCode}</span> will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-navy-dark-border">
                {recentCalls.map((call) => {
                  const isInbound = call.type === 'voice_in';
                  return (
                    <div key={call.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isInbound ? 'bg-chart-teal/20 text-chart-teal' : 'bg-chart-cyan/20 text-chart-cyan'
                          }`}
                        >
                          {isInbound ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-mono font-medium text-white">
                            {formatPhoneNumber(isInbound ? call.from_number : call.to_number)}
                          </p>
                          <p className="text-xs text-slate-blue-400">
                            {isInbound ? 'Inbound Customer Call' : 'Outbound Call'} • {getRelativeTime(call.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge variant={call.status === 'completed' ? 'resolved' : call.status === 'in-progress' ? 'in-call' : 'waiting'}>
                          {call.status}
                        </Badge>
                        <p className="text-xs font-mono text-slate-blue-400 mt-1">
                          {formatDuration(call.duration_seconds || 0)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Quick Callback / Follow-Up Notes */}
          <Panel className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent-success" />
                Action Items & Callbacks
              </h2>
              <span className="text-xs text-slate-blue-400">
                {notes.filter((n) => !n.completed).length} active
              </span>
            </div>

            {/* Add note input */}
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                placeholder="Add callback reminder or customer follow-up..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="input !h-9 text-xs flex-1"
              />
              <Button type="submit" variant="primary" size="sm" className="h-9 px-3 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </form>

            {/* Note items */}
            <div className="space-y-2 pt-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                    note.completed
                      ? 'bg-navy-dark-elevated/40 border-navy-dark-border text-slate-500'
                      : 'bg-navy-dark-elevated border-navy-dark-border text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                    <input
                      type="checkbox"
                      checked={note.completed}
                      onChange={() => handleToggleNote(note.id)}
                      className="rounded border-slate-700 bg-navy-dark text-accent-primary focus:ring-0"
                    />
                    <span
                      className={`text-xs truncate ${note.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}
                    >
                      {note.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-blue-500">{note.timestamp}</span>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 hover:text-accent-danger text-slate-500 transition-colors"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
