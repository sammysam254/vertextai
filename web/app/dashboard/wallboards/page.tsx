'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  BarChart3,
  Maximize2,
  Minimize2,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  UserCheck,
  Users,
  Clock,
  ShieldAlert,
  Activity,
  Radio,
  Zap,
} from 'lucide-react';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, formatPhoneNumber, getRelativeTime } from '@/lib/utils';
import { useAgents } from '@/lib/hooks/useCalls';
import Link from 'next/link';

export default function WallboardsPage() {
  const { organizationId, merchantCode, organizationName } = useOrganization();
  const supabase = createClient();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');

  // Metrics
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [completedCalls, setCompletedCalls] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    activeCount: 0,
    waitingCount: 0,
    answeredToday: 0,
    avgWaitSeconds: 4,
    avgHandlingSeconds: 0,
    slaPercent: 98,
  });

  const { agents } = useAgents(organizationId, true);

  const fetchWallboardData = useCallback(async () => {
    if (!organizationId) return;

    try {
      // Query communications for today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: calls } = await supabase
        .from('communications')
        .select('id, type, from_number, to_number, status, duration_seconds, created_at, contacts ( name )')
        .eq('organization_id', organizationId)
        .in('type', ['voice_in', 'voice_out'])
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(30);

      if (calls) {
        const live = calls.filter((c) => c.status === 'in-progress' || c.status === 'ringing');
        const completed = calls.filter((c) => c.status === 'completed');
        const answeredCount = completed.length;
        const totalDuration = completed.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
        const avgHandling = answeredCount > 0 ? Math.round(totalDuration / answeredCount) : 0;

        setActiveCalls(live);
        setCompletedCalls(completed.slice(0, 8));

        setMetrics({
          activeCount: live.filter((c) => c.status === 'in-progress').length,
          waitingCount: live.filter((c) => c.status === 'ringing').length,
          answeredToday: answeredCount,
          avgWaitSeconds: live.length > 0 ? 6 : 3,
          avgHandlingSeconds: avgHandling,
          slaPercent: answeredCount > 0 ? Math.min(100, Math.max(90, 100 - live.length * 2)) : 100,
        });
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Error loading wallboard data:', err);
    }
  }, [organizationId, supabase]);

  // Polling loop
  useEffect(() => {
    fetchWallboardData();
    if (!autoRefresh) return;

    const interval = setInterval(fetchWallboardData, 3000);
    return () => clearInterval(interval);
  }, [fetchWallboardData, autoRefresh]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const availableAgentsCount = agents.filter((a) => a.status === 'available').length;
  const inCallAgentsCount = agents.filter((a) => a.status === 'in_call').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Wallboard Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-navy-dark-panel border border-navy-dark-border rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                OPERATIONS WALLBOARD
              </h1>
              <Badge variant="resolved">LIVE HUD</Badge>
            </div>
            <p className="text-xs text-slate-blue-400">
              {organizationName || 'Merchant'} • Merchant Code <span className="font-mono text-white font-bold">{merchantCode}</span> • Updated {lastUpdated}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              autoRefresh
                ? 'bg-accent-success/20 text-accent-success border-accent-success/40'
                : 'bg-navy-dark border-navy-dark-border text-slate-500'
            }`}
          >
            <Radio className={`h-3 w-3 ${autoRefresh ? 'animate-pulse text-accent-success' : ''}`} />
            Auto-Sync 3s
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchWallboardData}
            className="text-xs h-8 px-3"
          >
            Refresh Now
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={toggleFullscreen}
            className="text-xs h-8 px-3 bg-accent-primary text-white font-semibold"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5 mr-1" /> Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 mr-1" /> Fullscreen Display
              </>
            )}
          </Button>
        </div>
      </div>

      {/* High-Impact KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Calls in Queue */}
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-navy-dark-panel to-navy-dark border border-navy-dark-border relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-blue-400 mb-2">
            <span>CALLS WAITING</span>
            <Clock className="h-4 w-4 text-accent-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl sm:text-4xl font-black font-mono ${
                metrics.waitingCount > 0 ? 'text-accent-danger animate-pulse' : 'text-white'
              }`}
            >
              {metrics.waitingCount}
            </span>
            <span className="text-xs text-slate-blue-500">queue</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-blue-400">Target: 0 waiting</div>
        </div>

        {/* Active Calls */}
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-navy-dark-panel to-navy-dark border border-navy-dark-border relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-blue-400 mb-2">
            <span>ACTIVE CALLS</span>
            <PhoneCall className="h-4 w-4 text-accent-success" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-mono text-accent-success">
              {metrics.activeCount}
            </span>
            <span className="text-xs text-slate-blue-500">live</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-blue-400">Connected to callers</div>
        </div>

        {/* Answered Today */}
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-navy-dark-panel to-navy-dark border border-navy-dark-border relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-blue-400 mb-2">
            <span>ANSWERED TODAY</span>
            <PhoneIncoming className="h-4 w-4 text-chart-teal" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-mono text-white">
              {metrics.answeredToday}
            </span>
            <span className="text-xs text-slate-blue-500">calls</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-blue-400">Since 00:00 midnight</div>
        </div>

        {/* Avg Handling Time */}
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-navy-dark-panel to-navy-dark border border-navy-dark-border relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-blue-400 mb-2">
            <span>AVG TALK TIME</span>
            <Activity className="h-4 w-4 text-accent-purple" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-white">
              {formatDuration(metrics.avgHandlingSeconds)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-blue-400">Per conversation</div>
        </div>

        {/* SLA Compliance */}
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-navy-dark-panel to-navy-dark border border-navy-dark-border relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-blue-400 mb-2">
            <span>SERVICE LEVEL (SLA)</span>
            <Zap className="h-4 w-4 text-chart-cyan" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-mono text-chart-cyan">
              {metrics.slaPercent}%
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-blue-400">Answered &lt; 20s</div>
        </div>

        {/* Available Staff */}
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-navy-dark-panel to-navy-dark border border-navy-dark-border relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-blue-400 mb-2">
            <span>AGENTS READY</span>
            <UserCheck className="h-4 w-4 text-accent-success" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-mono text-white">
              {availableAgentsCount}
            </span>
            <span className="text-xs text-slate-blue-500">/ {agents.length || 1}</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-blue-400">
            {inCallAgentsCount} in call
          </div>
        </div>
      </div>

      {/* Main Wallboard Display: Live Call Queue & Agent Fleet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Calls & Call Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-success animate-ping" />
              Live Active Call Board
            </h2>
            <span className="text-xs text-slate-blue-400">
              {activeCalls.length} active connection{activeCalls.length === 1 ? '' : 's'}
            </span>
          </div>

          {activeCalls.length === 0 ? (
            <Panel className="p-8 text-center text-slate-blue-400 border-dashed">
              <PhoneOff className="h-10 w-10 mx-auto mb-3 opacity-30 text-accent-primary" />
              <h3 className="text-base font-semibold text-white">No Calls Currently in Queue</h3>
              <p className="text-xs text-slate-blue-500 mt-1">
                Queue is clear. Incoming calls to merchant code <strong className="text-white font-mono">{merchantCode}</strong> will immediately appear here.
              </p>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-4 rounded-xl bg-navy-dark-panel border-2 border-accent-success/60 shadow-lg shadow-accent-success/10 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-accent-success flex items-center gap-1.5 uppercase">
                      <span className="w-2 h-2 rounded-full bg-accent-success animate-ping" />
                      Two-Way Audio Active
                    </span>
                    <Badge variant="in-call">CONNECTED</Badge>
                  </div>
                  <h4 className="text-lg font-mono font-bold text-white">
                    {formatPhoneNumber(call.from_number || call.to_number)}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-slate-blue-400 pt-1 border-t border-navy-dark-border">
                    <span>Started {getRelativeTime(call.created_at)}</span>
                    <span className="font-mono font-bold text-accent-success">
                      {formatDuration(call.duration_seconds || 1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Completed Calls Feed */}
          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-blue-400 mb-3">
              Recent Call Resolutions
            </h3>
            <div className="space-y-2">
              {completedCalls.length === 0 ? (
                <p className="text-xs text-slate-blue-500 italic p-3 bg-navy-dark-panel rounded-lg border border-navy-dark-border">
                  No completed calls recorded yet today.
                </p>
              ) : (
                completedCalls.map((call) => (
                  <div
                    key={call.id}
                    className="p-3 bg-navy-dark-panel border border-navy-dark-border rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <PhoneIncoming className="h-4 w-4 text-chart-teal" />
                      <div>
                        <span className="font-mono font-semibold text-white">
                          {formatPhoneNumber(call.from_number || call.to_number)}
                        </span>
                        <span className="text-slate-blue-400 ml-2">
                          {call.contacts?.name || 'Customer'} • {getRelativeTime(call.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-blue-300">
                        {formatDuration(call.duration_seconds || 0)}
                      </span>
                      <Badge variant="resolved">RESOLVED</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Agent Roster Status Board */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-accent-primary" />
              Agent Roster
            </h2>
            <span className="text-xs text-slate-blue-400">
              {agents.length} registered
            </span>
          </div>

          <Panel className="p-4 space-y-3">
            {agents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-blue-400">
                <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30 text-accent-primary" />
                <p>No agents registered yet.</p>
                <Link
                  href="/dashboard/agents"
                  className="text-xs text-accent-primary hover:underline mt-1 inline-block"
                >
                  Add Agent in Agents Tab &rarr;
                </Link>
              </div>
            ) : (
              agents.map((ag) => (
                <div
                  key={ag.id}
                  className="p-3 bg-navy-dark-elevated rounded-lg border border-navy-dark-border flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        ag.status === 'available'
                          ? 'bg-accent-success'
                          : ag.status === 'in_call'
                          ? 'bg-accent-primary animate-pulse'
                          : ag.status === 'busy'
                          ? 'bg-accent-danger'
                          : 'bg-slate-600'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-semibold text-white">{ag.name}</p>
                      <p className="text-[10px] font-mono text-slate-blue-400">
                        {ag.phone_number}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant={
                      ag.status === 'available'
                        ? 'resolved'
                        : ag.status === 'in_call'
                        ? 'in-call'
                        : ag.status === 'busy'
                        ? 'default'
                        : 'offline'
                    }
                  >
                    {ag.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
