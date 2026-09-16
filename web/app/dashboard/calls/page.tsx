import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from '@/components/ui/Table';
import { LiveCallsTable } from '@/components/calls/LiveCallsTable';
import { PhoneIncoming, PhoneOutgoing, PhoneOff, Inbox } from 'lucide-react';
import { formatDuration, getRelativeTime } from '@/lib/utils';

export default async function CallsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let organizationId: string | null = null;
  let calls: any[] = [];

  if (user) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membership?.organization_id) {
      organizationId = membership.organization_id;
    } else {
      let hash = 0;
      for (let i = 0; i < user.id.length; i++) {
        hash = (hash * 31 + user.id.charCodeAt(i)) >>> 0;
      }
      const merchantCode = String(100000 + (hash % 900000));
      const orgName = `${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Merchant'}'s Call Center`;

      const { data: newOrg } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
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

  if (organizationId) {
    // Clean up any stale in-progress calls older than 20 minutes
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    try {
      await supabase
        .from('communications')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .in('status', ['in-progress', 'ringing'])
        .lt('created_at', twentyMinsAgo);
    } catch (e) {
      console.warn('Note updating stale calls:', e);
    }

    // Real call history — latest 50, all voice types
    const { data } = await supabase
      .from('communications')
      .select(`
        id, type, from_number, to_number, status,
        duration_seconds, escalated_to_human,
        transfer_status, created_at, completed_at,
        contacts ( name )
      `)
      .eq('organization_id', organizationId)
      .in('type', ['voice_in', 'voice_out'])
      .order('created_at', { ascending: false })
      .limit(50);

    calls = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Calls</h1>
        <p className="text-slate-blue-400">Live activity and call history</p>
      </div>

      {/* Live calls — client component, polls every 5 s */}
      {organizationId ? (
        <LiveCallsTable organizationId={organizationId} />
      ) : (
        <Panel className="p-6">
          <p className="text-slate-blue-400 text-sm">
            No organisation found. Complete setup to see live calls.
          </p>
        </Panel>
      )}

      {/* Call history */}
      <Panel className="p-6">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">
          Call History
        </h2>

        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-10 w-10 text-slate-blue-700 mb-3" />
            <p className="text-slate-blue-400 text-sm">No calls yet</p>
            <p className="text-slate-blue-600 text-xs mt-1">
              Calls will appear here once your Twilio number receives or places one
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Time</TableHead>
                <TableHead>Caller / Contact</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Escalated</TableHead>
                <TableHead>Transfer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => {
                const isInbound = call.type === 'voice_in';
                const contactName = (call.contacts as any)?.name ?? null;

                return (
                  <TableRow key={call.id}>
                    <TableCell className="text-sm tabular-nums">
                      {getRelativeTime(call.created_at)}
                    </TableCell>

                    <TableCell>
                      <p className="font-mono text-sm text-white">
                        {isInbound ? call.from_number : call.to_number}
                      </p>
                      {contactName && (
                        <p className="text-xs text-slate-blue-400 mt-0.5">{contactName}</p>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isInbound
                          ? <PhoneIncoming className="h-4 w-4 text-chart-teal" />
                          : <PhoneOutgoing className="h-4 w-4 text-chart-cyan" />}
                        <span className="text-sm">{isInbound ? 'Inbound' : 'Outbound'}</span>
                      </div>
                    </TableCell>

                    <TableCell className="tabular-nums text-sm">
                      {formatDuration(call.duration_seconds ?? 0)}
                    </TableCell>

                    <TableCell>
                      {(() => {
                        const isStale =
                          call.status === 'in-progress' &&
                          (Date.now() - new Date(call.created_at).getTime() > 20 * 60 * 1000 ||
                            ['completed', 'failed', 'busy', 'no_answer'].includes(call.transfer_status));
                        const displayStatus = isStale ? 'completed' : call.status;
                        return (
                          <Badge
                            variant={
                              displayStatus === 'completed'
                                ? 'resolved'
                                : displayStatus === 'in-progress'
                                ? 'in-call'
                                : displayStatus === 'ringing'
                                ? 'waiting'
                                : 'offline'
                            }
                            dot
                          >
                            {displayStatus.toUpperCase().replace('-', ' ')}
                          </Badge>
                        );
                      })()}
                    </TableCell>

                    <TableCell>
                      {call.escalated_to_human
                        ? <Badge variant="in-call">YES</Badge>
                        : <span className="text-slate-blue-500 text-sm">No</span>}
                    </TableCell>

                    <TableCell>
                      {call.transfer_status ? (
                        <Badge
                          variant={
                            call.transfer_status === 'completed' ? 'resolved'
                            : call.transfer_status === 'pending'  ? 'waiting'
                            : 'offline'
                          }
                        >
                          {call.transfer_status.toUpperCase()}
                        </Badge>
                      ) : (
                        <span className="text-slate-blue-600 text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
