'use client';

import { useState, useEffect } from 'react';
import { PhoneForwarded, PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { TransferModal, type LiveCall } from './TransferModal';
import { useLiveCalls } from '@/lib/hooks/useCalls';
import { formatDuration, getRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface LiveCallsTableProps {
  organizationId: string;
}

export function LiveCallsTable({ organizationId }: LiveCallsTableProps) {
  const { calls, loading } = useLiveCalls(organizationId, 2000);

  const [transferTarget, setTransferTarget] = useState<LiveCall | null>(null);

  function openTransfer(row: (typeof calls)[number]) {
    setTransferTarget({
      callSid:        row.callSid,
      fromNumber:     row.fromNumber,
      contactName:    row.contactName,
      organizationId: row.organizationId,
      startedAt:      row.startedAt,
    });
  }

  const isEmpty = !loading && calls.length === 0;

  return (
    <>
      <Panel className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-accent-primary" />
            <h2 className="text-white font-semibold text-sm uppercase tracking-wide">
              Live Calls
            </h2>
            {calls.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-status-in-call/20 text-status-in-call text-xs font-medium tabular-nums">
                {calls.length}
              </span>
            )}
          </div>
          {/* Pulse indicator when calls are active */}
          {calls.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-slate-blue-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-available opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-available" />
              </span>
              Live
            </span>
          )}
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PhoneIncoming className="h-10 w-10 text-slate-blue-700 mb-3" />
            <p className="text-slate-blue-400 text-sm">No active calls</p>
            <p className="text-slate-blue-600 text-xs mt-1">
              Incoming calls will appear here in real time
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caller</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transfer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.callSid}>
                  {/* Caller */}
                  <TableCell>
                    <div>
                      <p className="font-mono text-sm text-white">
                        {call.fromNumber}
                      </p>
                      {call.contactName && (
                        <p className="text-xs text-slate-blue-400 mt-0.5">
                          {call.contactName}
                        </p>
                      )}
                      <p className="text-xs text-slate-blue-600 mt-0.5">
                        {getRelativeTime(call.startedAt)}
                      </p>
                    </div>
                  </TableCell>

                  {/* Direction */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <PhoneIncoming className="h-3.5 w-3.5 text-chart-teal" />
                      <span className="text-xs text-slate-blue-300">Inbound</span>
                    </div>
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="tabular-nums text-sm">
                    <LiveTimer startedAt={call.startedAt} />
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant={
                        call.status === 'in-progress' ? 'in-call'
                        : call.status === 'ringing'   ? 'waiting'
                        : 'offline'
                      }
                      dot
                    >
                      {call.status.toUpperCase().replace('-', ' ')}
                    </Badge>
                  </TableCell>

                  {/* Transfer status */}
                  <TableCell>
                    {call.transferStatus ? (
                      <Badge
                        variant={
                          call.transferStatus === 'completed' ? 'resolved'
                          : call.transferStatus === 'pending'  ? 'waiting'
                          : 'offline'
                        }
                      >
                        {call.transferStatus.toUpperCase()}
                      </Badge>
                    ) : (
                      <span className="text-slate-blue-600 text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openTransfer(call)}
                      disabled={
                        call.transferStatus === 'pending' ||
                        call.transferStatus === 'completed'
                      }
                      className="gap-1.5 whitespace-nowrap"
                    >
                      <PhoneForwarded className="h-3.5 w-3.5" />
                      Transfer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      {/* Transfer modal — rendered once, fed the selected call */}
      <TransferModal
        isOpen={transferTarget !== null}
        onClose={() => setTransferTarget(null)}
        call={transferTarget}
      />
    </>
  );
}

// ─── Live timer ───────────────────────────────────────────────────────────────

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );

  useEffect(() => {
    const id = setInterval(
      () =>
        setElapsed(
          Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
        ),
      1000
    );
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <span className={cn('font-mono text-sm', elapsed > 300 && 'text-accent-danger')}>
      {formatDuration(elapsed)}
    </span>
  );
}
