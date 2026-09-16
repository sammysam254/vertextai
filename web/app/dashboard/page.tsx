import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/Panel';
import { Phone, Users, UserCheck, MessageSquare, PhoneCall, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatDuration, getRelativeTime } from '@/lib/utils';

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">Call Center Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-blue-400">
            Real-time activity and intelligence for Vertex AI
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link
            href="/dashboard/dialer"
            className="btn btn-primary inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm"
          >
            <PhoneCall className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Open Dialer
          </Link>
          <Link
            href="/dashboard/inbox"
            className="btn btn-secondary inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-navy-dark-elevated hover:bg-navy-dark text-slate-blue-200 border border-slate-blue-800 rounded-lg text-xs sm:text-sm"
          >
            <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Send SMS
          </Link>
        </div>
      </div>

      {/* Merchant Routing ID Banner */}
      <div className="bg-gradient-to-r from-accent-primary/20 via-navy-dark-panel to-navy-dark-panel border border-accent-primary/40 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center text-accent-primary shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold tracking-wider text-accent-primary">
                Your Dedicated Merchant Routing Line
              </span>
              <Badge variant="resolved">Active</Badge>
            </div>
            <p className="text-sm text-slate-blue-300 mt-0.5">
              Callers dial <span className="font-mono text-white font-semibold">+1 (251) 357-1708</span> and enter your merchant code:
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="px-4 py-2 bg-navy-dark border border-accent-primary/50 rounded-lg text-center">
            <span className="text-[10px] text-slate-blue-400 uppercase tracking-wider block">Merchant Code</span>
            <span className="text-xl sm:text-2xl font-mono font-extrabold text-chart-cyan tracking-wider">
              {merchantCode || '100001'}
            </span>
          </div>
          <Link
            href="/dashboard/settings/phone"
            className="text-xs text-accent-primary hover:underline self-center"
          >
            Configure &rarr;
          </Link>
        </div>
      </div>

      {/* Real Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Panel className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-blue-400 text-xs sm:text-sm font-medium">Total Calls</p>
            <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-accent-primary" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{totalCalls}</p>
          <p className="text-[11px] sm:text-xs text-slate-blue-400 mt-1 sm:mt-2">Inbound & Outbound</p>
        </Panel>
        <Panel className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-blue-400 text-xs sm:text-sm font-medium">Active Agents</p>
            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-accent-success" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{activeAgents}</p>
          <p className="text-[11px] sm:text-xs text-slate-blue-400 mt-1 sm:mt-2">Ready for transfers</p>
        </Panel>
        <Panel className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-blue-400 text-xs sm:text-sm font-medium">Contacts</p>
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent-cyan" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{totalContacts}</p>
          <p className="text-[11px] sm:text-xs text-slate-blue-400 mt-1 sm:mt-2">Customers & Leads</p>
        </Panel>
        <Panel className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-blue-400 text-xs sm:text-sm font-medium">Messages</p>
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-accent-purple" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{totalMessages}</p>
          <p className="text-[11px] sm:text-xs text-slate-blue-400 mt-1 sm:mt-2">Inbound & Outbound SMS</p>
        </Panel>
      </div>

      {/* System Status & Live Actions */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <Panel className="p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Call Activity</h2>
            <Link href="/dashboard/calls" className="text-xs text-accent-primary hover:underline inline-flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentCalls.length === 0 ? (
            <div className="text-center py-10 text-slate-blue-400">
              <Phone className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No calls placed yet today.</p>
              <p className="text-xs text-slate-blue-500 mt-1">Use the dialer to place an outbound call or dial +1 (251) 357-1708.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-blue-800/60">
              {recentCalls.map((call: any) => (
                <div key={call.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                      <PhoneCall className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {call.contacts?.name || (call.type === 'voice_in' ? call.from_number : call.to_number)}
                      </p>
                      <p className="text-xs text-slate-blue-400">
                        {call.type === 'voice_in' ? 'Inbound' : 'Outbound'} • {getRelativeTime(call.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={call.status === 'completed' ? 'resolved' : call.status === 'in-progress' ? 'in-call' : 'default'}>
                      {call.status}
                    </Badge>
                    <p className="text-xs text-slate-blue-400 mt-1">{formatDuration(call.duration_seconds || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5 text-accent-success" />
            <h2 className="text-lg font-semibold text-white">System Status</h2>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between p-3 bg-navy-dark-elevated rounded-lg">
              <span className="text-slate-blue-300">Voice IVR</span>
              <span className="text-xs font-semibold text-accent-success bg-accent-success/10 px-2 py-0.5 rounded">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-navy-dark-elevated rounded-lg">
              <span className="text-slate-blue-300">Twilio Webhooks</span>
              <span className="text-xs font-semibold text-accent-success bg-accent-success/10 px-2 py-0.5 rounded">Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-navy-dark-elevated rounded-lg">
              <span className="text-slate-blue-300">Shared Line</span>
              <span className="text-xs font-mono text-white">+1 (251) 357-1708</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-navy-dark-elevated rounded-lg">
              <span className="text-slate-blue-300">Merchant Routing</span>
              <span className="text-xs font-mono text-accent-primary font-bold">100001</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
