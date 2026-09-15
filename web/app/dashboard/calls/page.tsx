import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Search, Download, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { formatDuration, getRelativeTime } from '@/lib/utils';

export default function CallsPage() {
  const calls = [
    {
      id: '1',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      callerNumber: '+1 555-0123',
      direction: 'inbound' as const,
      duration: 245,
      status: 'completed' as const,
      escalated: false,
    },
    {
      id: '2',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      callerNumber: '+1 555-0456',
      direction: 'outbound' as const,
      duration: 128,
      status: 'completed' as const,
      escalated: true,
    },
    {
      id: '3',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      callerNumber: '+1 555-0789',
      direction: 'inbound' as const,
      duration: 0,
      status: 'failed' as const,
      escalated: false,
    },
    {
      id: '4',
      createdAt: new Date(Date.now() - 14400000).toISOString(),
      callerNumber: '+1 555-0321',
      direction: 'inbound' as const,
      duration: 567,
      status: 'completed' as const,
      escalated: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Calls</h1>
        <p className="text-slate-blue-400">Call history and transcripts</p>
      </div>

      {/* Filters */}
      <Panel className="p-6">
        <div className="grid md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-blue-500" />
            <input
              type="search"
              placeholder="Search by phone or contact..."
              className="input pl-10"
            />
          </div>
          <Select
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
              { value: 'escalated', label: 'Escalated' },
            ]}
            defaultValue="all"
          />
          <Select
            options={[
              { value: 'all', label: 'All Directions' },
              { value: 'inbound', label: 'Inbound' },
              { value: 'outbound', label: 'Outbound' },
            ]}
            defaultValue="all"
          />
          <Button variant="secondary" className="w-full">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </Panel>

      {/* Calls Table */}
      <Panel className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Escalated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map((call) => (
              <TableRow key={call.id}>
                <TableCell className="text-sm">
                  {getRelativeTime(call.createdAt)}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {call.callerNumber}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="h-4 w-4 text-chart-teal" />
                    ) : (
                      <PhoneOutgoing className="h-4 w-4 text-chart-cyan" />
                    )}
                    <span className="text-sm capitalize">{call.direction}</span>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatDuration(call.duration)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      call.status === 'completed'
                        ? 'resolved'
                        : call.status === 'failed'
                        ? 'offline'
                        : 'waiting'
                    }
                    dot
                  >
                    {call.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  {call.escalated ? (
                    <Badge variant="in-call">YES</Badge>
                  ) : (
                    <span className="text-slate-blue-500 text-sm">No</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
