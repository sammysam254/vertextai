'use client';

import { useState, useEffect } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Phone, Delete, X, PhoneCall, PhoneOff, UserCheck, ArrowRightLeft, Building, User } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/utils';

export default function DialerPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agentName, setAgentName] = useState('Support Agent');
  const [companyName, setCompanyName] = useState('Vertex AI');
  const [isCallActive, setIsCallActive] = useState(false);
  const [activeCallSid, setActiveCallSid] = useState<string>('');
  const [callStatus, setCallStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Transfer state
  const [transferPhone, setTransferPhone] = useState('');
  const [transferAgentName, setTransferAgentName] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const twilioPhone = process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708';

  const getApiEndpoint = (path: string): string => {
    if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
      return `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${path}`;
    }
    return path;
  };

  // Real-time synchronization: detect when remote party on phone hangs up
  useEffect(() => {
    if (!isCallActive || !activeCallSid) return;

    const interval = setInterval(async () => {
      try {
        const endpoint = getApiEndpoint(`/api/v1/voice/call-status?callSid=${encodeURIComponent(activeCallSid)}`);
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          // Check if call leg was terminated on the carrier network
          const terminalStatuses = ['completed', 'canceled', 'busy', 'no-answer', 'failed'];
          if (data.active === false || terminalStatuses.includes(data.status?.toLowerCase())) {
            setIsCallActive(false);
            setActiveCallSid('');
            setCallStatus(`Call ended (${data.status || 'remote hung up'})`);
            setTimeout(() => {
              setCallStatus('');
              setPhoneNumber('');
            }, 3000);
          }
        }
      } catch {
        // Silently continue polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isCallActive, activeCallSid]);

  const handleDigit = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
    setError('');
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
    setError('');
  };

  const handleCall = async () => {
    if (!phoneNumber || isLoading) return;

    setIsLoading(true);
    setError('');
    setTransferMessage(null);

    try {
      const formattedNumber = formatPhoneNumber(phoneNumber);
      const endpoint = getApiEndpoint('/api/v1/voice/outbound');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formattedNumber,
          from: twilioPhone,
          agentName: agentName.trim(),
          companyName: companyName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to place call');
      }

      setIsCallActive(true);
      setActiveCallSid(data.callSid || '');
      setCallStatus(`Call in progress • ${data.callSid}`);
    } catch (err: any) {
      setError(err.message || 'Failed to place call. Check your number and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Instant Hangup: Drops the Twilio and carrier line immediately
  const handleHangup = async () => {
    const sidToHangup = activeCallSid;

    // Immediately update UI for zero perceived latency
    setIsCallActive(false);
    setCallStatus('Ending call...');
    setActiveCallSid('');
    setTransferMessage(null);

    if (sidToHangup) {
      try {
        const endpoint = getApiEndpoint('/api/v1/voice/hangup');
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callSid: sidToHangup }),
        });
      } catch (err) {
        console.error('Failed to trigger hangup endpoint:', err);
      }
    }

    setCallStatus('Call ended');
    setTimeout(() => {
      setCallStatus('');
      setPhoneNumber('');
    }, 2500);
  };

  const handleTransfer = async () => {
    if (!transferPhone.trim() || !activeCallSid || isTransferring) return;

    setIsTransferring(true);
    setTransferMessage(null);

    try {
      const formattedTransferNumber = formatPhoneNumber(transferPhone);
      const endpoint = getApiEndpoint('/api/v1/voice/transfer');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid: activeCallSid,
          agentPhone: formattedTransferNumber,
          agentName: transferAgentName.trim() || 'Care Agent',
          organizationId: 'default',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to transfer call');
      }

      setTransferMessage({
        type: 'success',
        text: `Call successfully transferred to ${formattedTransferNumber}! Caller is now connecting.`,
      });
      setTransferPhone('');
    } catch (err: any) {
      setTransferMessage({
        type: 'error',
        text: err.message || 'Failed to transfer call. Please verify phone number.',
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const digits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dialer</h1>
        <p className="text-slate-blue-400">Make outbound calls with caller branding and live call transfer</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Dialer Panel */}
        <Panel className="p-8">
          <div className="space-y-6">
            {/* Branding Inputs */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-navy-dark-elevated border border-navy-dark-border rounded-lg">
              <div>
                <label className="block text-xs font-medium text-slate-blue-300 mb-1 flex items-center gap-1">
                  <User className="h-3 w-3 text-chart-cyan" /> Agent Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="input !h-9 text-xs w-full"
                  disabled={isCallActive}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-blue-300 mb-1 flex items-center gap-1">
                  <Building className="h-3 w-3 text-chart-cyan" /> Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="input !h-9 text-xs w-full"
                  disabled={isCallActive}
                />
              </div>
            </div>

            {/* Caller ID Display */}
            <div className="flex items-center justify-between px-3 py-2 bg-navy-dark-elevated border border-navy-dark-border rounded-md">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-chart-cyan" />
                <span className="text-white font-mono text-sm">{twilioPhone}</span>
              </div>
              <span className="text-xs text-slate-blue-400">Shared Line</span>
            </div>

            {/* Phone Display */}
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setError('');
                }}
                placeholder="Enter phone number..."
                className="input text-center text-2xl font-mono h-16 pr-12 w-full"
                disabled={isCallActive}
              />
              {phoneNumber && !isCallActive && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-navy-dark-elevated text-slate-blue-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-accent-danger text-sm text-center p-2 bg-accent-danger/10 border border-accent-danger/30 rounded-md">
                {error}
              </p>
            )}

            {/* Active call status banner */}
            {isCallActive && (
              <div className="p-4 bg-accent-success/10 border border-accent-success/30 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-accent-success animate-pulse" />
                    <span className="text-accent-success font-medium text-sm">Call in progress</span>
                  </div>
                  <span className="text-xs text-slate-blue-400 font-mono">
                    {activeCallSid.slice(0, 12)}...
                  </span>
                </div>

                {/* Live Transfer Section */}
                <div className="pt-3 border-t border-accent-success/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-accent-success" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">
                      Transfer Call to Agent / Specialist
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Agent Name (e.g. Specialist John)"
                      value={transferAgentName}
                      onChange={(e) => setTransferAgentName(e.target.value)}
                      className="input !h-9 text-xs"
                    />
                    <input
                      type="tel"
                      placeholder="Phone number to transfer to..."
                      value={transferPhone}
                      onChange={(e) => setTransferPhone(e.target.value)}
                      className="input !h-9 text-xs font-mono"
                    />
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTransfer}
                    disabled={!transferPhone.trim() || isTransferring}
                    className="w-full bg-accent-primary/20 hover:bg-accent-primary/30 text-white border-accent-primary/40"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
                    {isTransferring ? 'Transferring...' : 'Transfer Call to this Contact'}
                  </Button>

                  {transferMessage && (
                    <p
                      className={`text-xs p-2 rounded ${
                        transferMessage.type === 'success'
                          ? 'bg-accent-success/20 text-accent-success'
                          : 'bg-accent-danger/20 text-accent-danger'
                      }`}
                    >
                      {transferMessage.text}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Keypad */}
            {!isCallActive && (
              <div className="grid grid-cols-3 gap-3">
                {digits.map((row) =>
                  row.map((digit) => (
                    <Button
                      key={digit}
                      variant="secondary"
                      size="lg"
                      onClick={() => handleDigit(digit)}
                      className="h-14 text-2xl font-semibold hover:bg-navy-dark-elevated"
                    >
                      {digit}
                    </Button>
                  ))
                )}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              {!isCallActive ? (
                <>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={handleDelete}
                    disabled={!phoneNumber}
                  >
                    <Delete className="h-5 w-5 mr-1" />
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleCall}
                    disabled={!phoneNumber || isLoading}
                    className="bg-accent-success hover:bg-accent-success/90 text-white font-semibold"
                  >
                    <PhoneCall className="h-5 w-5 mr-1" />
                    {isLoading ? 'Connecting...' : 'Call'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleHangup}
                  className="col-span-2 bg-accent-danger hover:bg-accent-danger/90 text-white font-semibold h-12"
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  End Call
                </Button>
              )}
            </div>
          </div>
        </Panel>

        {/* Info & Branding Panel */}
        <Panel className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-chart-cyan" />
            Outbound Call & Transfer Guide
          </h2>
          <div className="space-y-4 text-sm text-slate-blue-300">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                1
              </div>
              <p>
                <strong className="text-white">Caller Branding:</strong> Set your Agent Name and Company Name. When the customer answers, the AI greets them: <span className="italic text-slate-blue-200">"Hello, this is [Agent] from [Company] calling..."</span>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                2
              </div>
              <p>
                <strong className="text-white">Global Dialing:</strong> You can call any country worldwide. Kenyan numbers (<span className="font-mono text-white">07XXXXXXXX</span>) and international numbers (<span className="font-mono text-white">+...</span>) are automatically formatted.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                3
              </div>
              <p>
                <strong className="text-white">Hold Music & AI:</strong> While the recipient connects or waits, smooth hold music plays automatically.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                4
              </div>
              <p>
                <strong className="text-white">Live Call Transfer:</strong> Once the call is connected, enter any customer care agent number in the <span className="text-white font-medium">Transfer Call</span> box and click transfer to bridge them immediately.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
