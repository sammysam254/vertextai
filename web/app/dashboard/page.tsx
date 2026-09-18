import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/Panel';
import {
  Phone,
  Users,
  UserCheck,
  MessageSquare,
  PhoneCall,
  ArrowRight,
  ShieldCheck,
  Radio,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatDuration, getRelativeTime } from '@/lib/utils';
import { MerchantRoutingCard } from '@/components/dashboard/MerchantRoutingCard';

export default async function DashboardOverviewPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let organizationId: string | null = null;
  let organizationName: string = 'My Call Center';
  let merchantCode: string = '';

  if (user) {
    const { data: mem } = await supabase
      .from('organization_members')
      .select('organization_id, organizations ( id, name, metadata )')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (mem && mem.organization_id) {
      const orgId = mem.organization_id;
      organizationId = orgId;
      const org = (mem as any).organizations;
      organizationName = org?.name || 'My Call Center';
      let hash = 0;
      for (let i = 0; i < orgId.length; i++) {
        hash = (hash * 31 + orgId.charCodeAt(i)) >>> 0;
      }
      merchantCode = org?.metadata?.merchant_code || String(100000 + (hash % 900000));
    } else {
      let hash = 0;
      for (let i = 0; i < user.id.length; i++) {
        hash = (hash * 31 + user.id.charCodeAt(i)) >>> 0;
      }
      merchantCode = String(100000 + (hash % 900000));
      organizationName = `${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Merchant'}'s Call Center`;

      const { data: newOrg } = await supabase
        .from('organizations')
        .insert({
          name: organizationName,
          twilio_phone_number: '+12513571708',
          escalation_phone_number: '+254706499848',
          metadata: { merchant_code: merchantCode, owner_user_id: user.id },
        })
        .select()
        .single();

      if (newOrg) {
        organizationId = newOrg.id;
        await supabase.from('organization_members').insert({
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'owner',
        });
      }
    }
  }

  let totalCalls = 0;
  let activeAgents = 0;
  let totalContacts = 0;
  let totalMessages = 0;
  let recentCalls: any[] = [];

  if (organizationId) {
    const [callsRes, agentsRes, contactsRes, msgsRes, recentCallsRes] = await Promise.all([
      supabase.from('communications').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).in('type', ['voice_in', 'voice_out']),
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId),
      supabase.from('communications').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).in('type', ['sms_in', 'sms_out']),
      supabase.from('communications').select('id, type, from_number, to_number, status, duration_seconds, created_at, contacts(name)').eq('organization_id', organizationId).in('type', ['voice_in', 'voice_out']).order('created_at', { ascending: false }).limit(6)
    ]);

    totalCalls = callsRes.count ?? 0;
    activeAgents = agentsRes.count ?? 0;
    totalContacts = contactsRes.count ?? 0;
    totalMessages = msgsRes.count ?? 0;
    recentCalls = recentCallsRes.data ?? [];
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Call Center Dashboard
            </h1>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981] animate-pulse" />
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Real-time activity &amp; intelligence for <strong className="text-cyan-300 font-semibold">{organizationName}</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <Link
            href="/dashboard/dialer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all active:scale-[0.98]"
          >
            <PhoneCall className="h-4 w-4 text-cyan-200" />
            <span>Open WebRTC Dialer</span>
          </Link>
          <Link
            href="/dashboard/inbox"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.09] text-slate-200 border border-white/10 hover:border-cyan-500/40 rounded-xl text-xs sm:text-sm font-semibold transition-all"
          >
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <span>SMS Inbox</span>
          </Link>
        </div>
      </div>

      {/* Merchant Routing ID Interactive Banner */}
      <MerchantRoutingCard merchantCode={merchantCode} />

      {/* 4 Quick Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Calls */}
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-cyan-500/30 p-4 sm:p-5 transition-all shadow-md group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 blur-[40px] pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Calls</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Phone className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white font-mono tracking-tight">{totalCalls}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-cyan-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Inbound &amp; Outbound Telecom</span>
          </div>
        </div>

        {/* Active Agents */}
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-emerald-500/30 p-4 sm:p-5 transition-all shadow-md group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-[40px] pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Agents</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white font-mono tracking-tight">{activeAgents}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Ready for Live Audio Transfer</span>
          </div>
        </div>

        {/* Contacts */}
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-blue-500/30 p-4 sm:p-5 transition-all shadow-md group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-[40px] pointer-events-none group-hover:bg-blue-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contacts</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white font-mono tracking-tight">{totalContacts}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400 font-medium">
            <span>Verified Customers &amp; Leads</span>
          </div>
        </div>

        {/* Messages */}
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-purple-500/30 p-4 sm:p-5 transition-all shadow-md group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-[40px] pointer-events-none group-hover:bg-purple-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Messages</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white font-mono tracking-tight">{totalMessages}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-purple-300 font-medium">
            <span>2-Way Conversational SMS</span>
          </div>
        </div>

      </div>

      {/* System Status & Recent Calls Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        
        {/* Recent Call Activity Card */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5 sm:p-6 lg:col-span-2 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00E5FF] animate-ping" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Recent Call Activity</h2>
            </div>
            <Link
              href="/dashboard/calls"
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1 transition-colors"
            >
              <span>View Logs</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentCalls.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08]">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3 text-cyan-400">
                <Phone className="h-5 w-5 opacity-60" />
              </div>
              <p className="text-sm font-semibold text-white">No calls recorded today</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Ready to make a call? Use the in-browser WebRTC dialer or invite callers to dial +1 (251) 357-1708.
              </p>
              <Link
                href="/dashboard/dialer"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/40 transition-colors"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Launch Dialer</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {recentCalls.map((call: any) => (
                <div key={call.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                      <PhoneCall className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {call.contacts?.name || (call.type === 'voice_in' ? call.from_number : call.to_number)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {call.type === 'voice_in' ? 'Inbound Call' : 'Outbound Call'} • {getRelativeTime(call.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={call.status === 'completed' ? 'resolved' : call.status === 'in-progress' ? 'in-call' : 'default'}>
                      {call.status}
                    </Badge>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">{formatDuration(call.duration_seconds || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Telecom Infrastructure Status */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5 sm:p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Platform Status</h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <span className="text-slate-300 font-medium">Voice WebRTC Gateway</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <span className="text-slate-300 font-medium">Twilio Carrier Bridge</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <span className="text-slate-300 font-medium">Monthly Free Allowance</span>
              <span className="font-bold text-cyan-300 font-mono">
                3 Mins Active
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <span className="text-slate-300 font-medium">AI Speech Engine</span>
              <span className="font-mono text-white font-semibold">Groq Llama 3 (450ms)</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/wallboards"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-colors"
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>Open Supervisor Wallboards</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
