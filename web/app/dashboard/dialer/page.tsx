'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Phone, Delete, X, PhoneCall, PhoneOff } from 'lucide-react';

export default function DialerPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const twilioPhone = process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708';

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

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';
      const response = await fetch(`${apiUrl}/api/v1/voice/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneNumber, from: twilioPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to place call');
      }

      setIsCallActive(true);
      setCallStatus(`Call connected • ${data.callSid}`);
    } catch (err: any) {
      setError(err.message || 'Failed to place call. Check your number and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHangup = () => {
    setIsCallActive(false);
    setCallStatus('');
    setPhoneNumber('');
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
        <p className="text-slate-blue-400">Make outbound calls</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Dialer Panel */}
        <Panel className="p-8">
          <div className="space-y-6">
            {/* Caller ID */}
            <div>
              <label className="block text-sm font-medium text-slate-blue-300 mb-1">Caller ID</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-navy-dark-elevated border border-navy-dark-border rounded-md">
                <Phone className="h-4 w-4 text-chart-cyan" />
                <span className="text-white font-mono">{twilioPhone}</span>
                <span className="text-slate-blue-400 text-sm ml-1">(Main)</span>
              </div>
            </div>

            {/* Display */}
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => { setPhoneNumber(e.target.value); setError(''); }}
                placeholder="Enter phone number..."
                className="input text-center text-2xl font-mono h-16 pr-12"
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

            {/* Error */}
            {error && (
              <p className="text-accent-danger text-sm text-center">{error}</p>
            )}

            {/* Active call status */}
            {isCallActive && callStatus && (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent-success/10 border border-accent-success/30 rounded-md">
                <div className="w-2 h-2 rounded-full bg-accent-success animate-pulse" />
                <span className="text-accent-success text-sm">Call in progress</span>
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
                      className="h-16 text-2xl font-semibold"
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
                    <Delete className="h-5 w-5" />
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleCall}
                    disabled={!phoneNumber || isLoading}
                    className="bg-accent-success hover:bg-accent-success/90"
                  >
                    <PhoneCall className="h-5 w-5" />
                    {isLoading ? 'Calling...' : 'Call'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleHangup}
                  className="col-span-2 bg-accent-danger hover:bg-accent-danger/90"
                >
                  <PhoneOff className="h-5 w-5" />
                  End Call
                </Button>
              )}
            </div>
          </div>
        </Panel>

        {/* Info Panel */}
        <Panel className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">How to make a call</h2>
          <div className="space-y-4 text-sm text-slate-blue-300">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
              <p>Type or dial the phone number you want to call using the keypad below.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
              <p>Include country code for international calls (e.g. <span className="font-mono text-white">+44...</span> for UK).</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
              <p>Press <span className="text-accent-success font-medium">Call</span> to connect. The call will be placed from your Twilio number <span className="font-mono text-white">{twilioPhone}</span>.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
              <p>The recipient's phone will ring. Once connected, you can talk directly.</p>
            </div>
          </div>

          <div className="mt-6 p-3 bg-navy-dark-elevated rounded-md border border-navy-dark-border">
            <p className="text-xs text-slate-blue-400">
              Calls are powered by Twilio and billed to your Twilio account. Standard rates apply.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
