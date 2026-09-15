'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Phone, Delete, X } from 'lucide-react';
import { getRelativeTime } from '@/lib/utils';

export default function DialerPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callerId, setCallerId] = useState('+1 555-0000');

  const handleDigit = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const handleCall = () => {
    if (phoneNumber) {
      alert(`Calling ${phoneNumber} from ${callerId}`);
    }
  };

  const recentCalls = [
    {
      id: '1',
      number: '+1 555-0123',
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: '2',
      number: '+1 555-0456',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '3',
      number: '+1 555-0789',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  const digits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dialer</h1>
        <p className="text-slate-blue-400">Make outbound calls</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Dialer Panel */}
        <Panel className="p-8">
          <div className="space-y-6">
            {/* Caller ID Selector */}
            <Select
              label="Caller ID"
              options={[
                { value: '+1 555-0000', label: '+1 555-0000 (Main)' },
                { value: '+1 555-0001', label: '+1 555-0001 (Sales)' },
                { value: '+1 555-0002', label: '+1 555-0002 (Support)' },
              ]}
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
            />

            {/* Display */}
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 555-"
                className="input text-center text-2xl font-mono h-16 pr-12"
              />
              {phoneNumber && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-navy-dark-elevated text-slate-blue-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {digits.map((row, rowIndex) =>
                row.map((digit) => (
                  <Button
                    key={digit}
                    variant="secondary"
                    size="lg"
                    onClick={() => handleDigit(digit)}
                    className="h-16 text-2xl font-semibold"
                  >
                    {digit}
                  </Button>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleDelete}
                disabled={!phoneNumber}
              >
                <Delete className="h-5 w-5" />
                Delete
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleCall}
                disabled={!phoneNumber}
                className="bg-accent-success hover:bg-accent-success/90"
              >
                <Phone className="h-5 w-5" />
                Call
              </Button>
            </div>
          </div>
        </Panel>

        {/* Recent Calls */}
        <Panel className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Calls</h2>
          <div className="space-y-3">
            {recentCalls.map((call) => (
              <button
                key={call.id}
                onClick={() => setPhoneNumber(call.number)}
                className="w-full flex items-center justify-between p-3 rounded-md bg-navy-dark-elevated hover:bg-navy-dark-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-chart-cyan" />
                  <span className="font-mono text-sm text-slate-blue-100">
                    {call.number}
                  </span>
                </div>
                <span className="text-xs text-slate-blue-500">
                  {getRelativeTime(call.timestamp)}
                </span>
              </button>
            ))}
          </div>
          {recentCalls.length === 0 && (
            <p className="text-center text-slate-blue-500 text-sm py-8">
              No recent calls
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
