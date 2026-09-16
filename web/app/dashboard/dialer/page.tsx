'use client';

import { useState, useEffect, useRef } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import {
  Phone,
  Delete,
  X,
  PhoneCall,
  PhoneOff,
  UserCheck,
  ArrowRightLeft,
  Building,
  User,
  Mic,
  MicOff,
  Radio,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { formatPhoneNumber, formatDuration } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAgents } from '@/lib/hooks/useCalls';

export default function DialerPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agentName, setAgentName] = useState('Support Agent');
  const [companyName, setCompanyName] = useState('Vertex AI');
  const [isCallActive, setIsCallActive] = useState(false);
  const [activeCallSid, setActiveCallSid] = useState<string>('');
  const [callStatus, setCallStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // WebRTC Live Browser Audio State
  const [device, setDevice] = useState<any>(null);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [directVoiceMode, setDirectVoiceMode] = useState(true); // true = Browser Mic WebRTC, false = AI Outbound

  // Transfer state
  const [transferPhone, setTransferPhone] = useState('');
  const [transferAgentName, setTransferAgentName] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const twilioPhone = process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708';
  const supabase = createClient();
  const deviceRef = useRef<any>(null);

  const getApiEndpoint = (path: string): string => {
    if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
      return `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${path}`;
    }
    return path;
  };

  // Resolve organization ID for agents
  useEffect(() => {
    async function loadOrg() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: mem } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          if (mem?.organization_id) {
            setOrganizationId(mem.organization_id);
            return;
          }
        }
        const { data: firstOrg } = await supabase
          .from('organizations')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (firstOrg?.id) {
          setOrganizationId(firstOrg.id);
        }
      } catch (e) {
        console.error('Error resolving organization:', e);
      }
    }
    loadOrg();
  }, [supabase]);

  const { agents } = useAgents(organizationId, true);

  // Initialize Twilio WebRTC Voice Device for in-browser live calling
  useEffect(() => {
    let isMounted = true;

    async function setupWebRTCDevice() {
      if (typeof window === 'undefined') return;

      try {
        const tokenEndpoint = getApiEndpoint(
          `/api/v1/voice/token?identity=${encodeURIComponent('agent_' + Math.random().toString(36).substring(2, 8))}`
        );
        const res = await fetch(tokenEndpoint);
        if (!res.ok) {
          console.warn('Voice token endpoint returned status:', res.status);
          return;
        }

        const data = await res.json();
        if (!data?.token || !isMounted) return;

        // Dynamically import Twilio Voice SDK in browser only
        const { Device, Call } = await import('@twilio/voice-sdk');

        const twilioDevice = new Device(data.token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        });

        twilioDevice.on('registered', () => {
          if (isMounted) {
            setIsDeviceReady(true);
          }
        });

        twilioDevice.on('error', (devError: any) => {
          console.warn('Twilio Device warning:', devError?.message || devError);
        });

        await twilioDevice.register();

        if (isMounted) {
          deviceRef.current = twilioDevice;
          setDevice(twilioDevice);
        }
      } catch (err: any) {
        console.warn('WebRTC Voice initialization notice:', err?.message || err);
      }
    }

    setupWebRTCDevice();

    return () => {
      isMounted = false;
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {}
      }
    };
  }, []);

  // Call timer increment when connected
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isCallActive) {
      timer = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCallActive]);

  // Real-time remote termination synchronization
  useEffect(() => {
    if (!isCallActive || !activeCallSid) return;

    const interval = setInterval(async () => {
      try {
        const endpoint = getApiEndpoint(`/api/v1/voice/call-status?callSid=${encodeURIComponent(activeCallSid)}`);
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          const terminalStatuses = ['completed', 'canceled', 'busy', 'no-answer', 'failed'];
          if (data.active === false || terminalStatuses.includes(data.status?.toLowerCase())) {
            setIsCallActive(false);
            setActiveCallSid('');
            setCurrentCall(null);
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

  // Initiate call with direct WebRTC audio or outbound bot
  const handleCall = async () => {
    if (!phoneNumber || isLoading) return;

    setIsLoading(true);
    setError('');
    setTransferMessage(null);

    const formattedNumber = formatPhoneNumber(phoneNumber);

    // MODE 1: Direct WebRTC Browser Calling (User can talk directly with mic & speaker)
    if (directVoiceMode && device) {
      try {
        setCallStatus('Connecting browser microphone & audio...');

        const call = await device.connect({
          params: {
            To: formattedNumber,
            agentName: agentName.trim(),
            companyName: companyName.trim(),
          },
        });

        setCurrentCall(call);

        call.on('ringing', () => {
          setCallStatus('Ringing recipient phone...');
        });

        call.on('accept', () => {
          setIsCallActive(true);
          setIsLoading(false);
          setCallStatus('Two-way audio connected • Talk directly now');
          const sid = call.parameters?.CallSid || '';
          if (sid) setActiveCallSid(sid);
        });

        call.on('disconnect', () => {
          setIsCallActive(false);
          setCurrentCall(null);
          setActiveCallSid('');
          setCallStatus('Call disconnected');
          setTimeout(() => {
            setCallStatus('');
            setPhoneNumber('');
          }, 2500);
        });

        call.on('error', (callErr: any) => {
          console.error('WebRTC Call error:', callErr);
          setError(callErr?.message || 'WebRTC connection failed. Falling back to phone dialer.');
          setIsLoading(false);
          setIsCallActive(false);
          setCurrentCall(null);
        });

        call.on('mute', (muted: boolean) => {
          setIsMuted(muted);
        });

        return;
      } catch (err: any) {
        console.warn('WebRTC dial failed, falling back to REST outbound:', err);
      }
    }

    // MODE 2: REST Outbound Call Fallback
    try {
      setCallStatus('Placing outbound call via carrier...');
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

  // Instant Hangup: Drops both WebRTC browser connection and carrier line immediately
  const handleHangup = async () => {
    const sidToHangup = activeCallSid;

    // Immediately update UI for zero perceived latency
    setIsCallActive(false);
    setCallStatus('Ending call...');
    setActiveCallSid('');
    setTransferMessage(null);

    // Drop browser audio stream
    if (currentCall) {
      try {
        currentCall.disconnect();
      } catch {}
      setCurrentCall(null);
    }
    if (device) {
      try {
        device.disconnectAll();
      } catch {}
    }

    // Terminate Twilio carrier leg
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
    }, 2000);
  };

  // Toggle Microphone Mute
  const handleToggleMute = () => {
    if (currentCall) {
      const nextMute = !isMuted;
      currentCall.mute(nextMute);
      setIsMuted(nextMute);
    }
  };

  // Live Call Transfer
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
          organizationId: organizationId || 'default',
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
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Web Dialer</h1>
          <p className="text-xs sm:text-sm text-slate-blue-400">
            Talk directly to your customer from your browser with live two-way WebRTC audio
          </p>
        </div>

        {/* Audio Mode Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setDirectVoiceMode(!directVoiceMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              directVoiceMode
                ? 'bg-accent-primary/20 border-accent-primary/40 text-accent-primary'
                : 'bg-navy-dark-elevated border-navy-dark-border text-slate-blue-400'
            }`}
            title="Toggle between Direct Browser Mic Voice and AI Outbound Caller"
          >
            {directVoiceMode ? (
              <>
                <Radio className="h-3.5 w-3.5 text-accent-primary animate-pulse" />
                <span>Direct Voice: <strong>Browser Mic Active</strong></span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Mode: <strong>AI Outbound Bot</strong></span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Dialer Panel */}
        <Panel className="p-4 sm:p-6 lg:p-8">
          <div className="space-y-4 sm:space-y-6">
            {/* Branding Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 p-3 bg-navy-dark-elevated border border-navy-dark-border rounded-lg">
              <div>
                <label className="block text-[11px] sm:text-xs font-medium text-slate-blue-300 mb-1 flex items-center gap-1">
                  <User className="h-3 w-3 text-chart-cyan" /> Agent Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="input !h-8 sm:!h-9 text-xs w-full"
                  disabled={isCallActive}
                />
              </div>
              <div>
                <label className="block text-[11px] sm:text-xs font-medium text-slate-blue-300 mb-1 flex items-center gap-1">
                  <Building className="h-3 w-3 text-chart-cyan" /> Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Vertex AI"
                  className="input !h-8 sm:!h-9 text-xs w-full"
                  disabled={isCallActive}
                />
              </div>
            </div>

            {/* Caller ID Display */}
            <div className="flex items-center justify-between px-3 py-2 bg-navy-dark-elevated border border-navy-dark-border rounded-md text-xs sm:text-sm">
              <div className="flex items-center gap-2 truncate">
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-chart-cyan shrink-0" />
                <span className="text-white font-mono text-xs sm:text-sm truncate">{twilioPhone}</span>
              </div>
              <span className="text-[11px] sm:text-xs text-slate-blue-400 shrink-0 ml-2">Shared Caller ID</span>
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
                className="input text-center text-xl sm:text-2xl font-mono h-14 sm:h-16 pr-12 w-full"
                disabled={isCallActive}
              />
              {phoneNumber && !isCallActive && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-navy-dark-elevated text-slate-blue-400 hover:text-white"
                  aria-label="Clear number"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-accent-danger text-xs sm:text-sm text-center p-2.5 bg-accent-danger/10 border border-accent-danger/30 rounded-md">
                {error}
              </p>
            )}

            {/* Status Feedback */}
            {callStatus && !error && !isCallActive && (
              <p className="text-slate-blue-300 text-xs sm:text-sm text-center p-2 bg-navy-dark-elevated border border-navy-dark-border rounded-md animate-pulse">
                {callStatus}
              </p>
            )}

            {/* ACTIVE LIVE CALL CONTROLS */}
            {isCallActive && (
              <div className="p-3 sm:p-4 bg-accent-success/10 border border-accent-success/30 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-success" />
                    </span>
                    <span className="text-accent-success font-medium text-xs sm:text-sm">
                      Two-Way Audio Connected
                    </span>
                  </div>
                  <span className="font-mono text-xs sm:text-sm font-bold text-white bg-accent-success/20 px-2 py-0.5 rounded">
                    {formatDuration(callTimer)}
                  </span>
                </div>

                {/* Microphone & Live Audio Status Banner */}
                <div className="flex items-center justify-between p-3 bg-navy-dark/80 rounded-lg border border-accent-success/20">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-accent-success/20 flex items-center justify-center text-accent-success">
                      {isMuted ? <MicOff className="h-4 w-4 text-accent-danger" /> : <Mic className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {isMuted ? 'Microphone Muted' : 'Direct Live Microphone Active'}
                      </p>
                      <p className="text-[10px] text-slate-blue-400">
                        {isMuted ? 'Customer cannot hear you' : 'Customer hears your browser mic directly'}
                      </p>
                    </div>
                  </div>

                  {/* Sound Wave Animation */}
                  {!isMuted && (
                    <div className="flex items-end gap-1 h-5">
                      <span className="w-1 bg-accent-success rounded-full animate-[bounce_0.8s_ease-in-out_infinite] h-2" />
                      <span className="w-1 bg-accent-success rounded-full animate-[bounce_0.8s_ease-in-out_0.2s_infinite] h-5" />
                      <span className="w-1 bg-accent-success rounded-full animate-[bounce_0.8s_ease-in-out_0.4s_infinite] h-3" />
                      <span className="w-1 bg-accent-success rounded-full animate-[bounce_0.8s_ease-in-out_0.1s_infinite] h-4" />
                    </div>
                  )}
                </div>

                {/* Call Action Bar: Mute Mic + End Call */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleToggleMute}
                    className={`h-11 text-xs font-medium ${
                      isMuted ? 'bg-accent-danger/20 text-accent-danger border-accent-danger/40' : ''
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="h-4 w-4 mr-1.5 text-accent-danger" />
                        Unmute Mic
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-1.5" />
                        Mute Mic
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleHangup}
                    className="h-11 bg-accent-danger hover:bg-accent-danger/90 text-white font-semibold text-xs"
                  >
                    <PhoneOff className="h-4 w-4 mr-1.5" />
                    End Call
                  </Button>
                </div>

                {/* Live Transfer Section */}
                <div className="pt-3 border-t border-accent-success/20 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-accent-success" />
                    <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white">
                      Transfer Call to Registered Agent
                    </span>
                  </div>

                  <div className="space-y-2">
                    {agents.length > 0 && (
                      <div>
                        <label className="block text-[10px] sm:text-[11px] font-medium text-slate-blue-300 mb-1">
                          Quick Select Agent
                        </label>
                        <select
                          onChange={(e) => {
                            const ag = agents.find((a) => a.id === e.target.value);
                            if (ag) {
                              setTransferAgentName(ag.name);
                              setTransferPhone(ag.phone_number);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-navy-dark border border-navy-dark-border rounded text-xs text-white focus:outline-none focus:border-accent-primary"
                        >
                          <option value="">-- Choose agent ({agents.length} available) --</option>
                          {agents.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name} ({ag.phone_number}) — {ag.status}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Agent Name"
                        value={transferAgentName}
                        onChange={(e) => setTransferAgentName(e.target.value)}
                        className="input !h-8 text-xs"
                      />
                      <input
                        type="tel"
                        placeholder="Transfer phone number..."
                        value={transferPhone}
                        onChange={(e) => setTransferPhone(e.target.value)}
                        className="input !h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTransfer}
                    disabled={!transferPhone.trim() || isTransferring}
                    className="w-full bg-accent-primary/20 hover:bg-accent-primary/30 text-white border-accent-primary/40 text-xs py-2"
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1.5" />
                    {isTransferring ? 'Transferring...' : 'Transfer Call'}
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

            {/* Keypad (Shown when not in call) */}
            {!isCallActive && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {digits.map((row) =>
                  row.map((digit) => (
                    <Button
                      key={digit}
                      variant="secondary"
                      size="lg"
                      onClick={() => handleDigit(digit)}
                      className="h-12 sm:h-14 text-xl sm:text-2xl font-semibold hover:bg-navy-dark-elevated"
                    >
                      {digit}
                    </Button>
                  ))
                )}
              </div>
            )}

            {/* Main Action Buttons */}
            {!isCallActive && (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleDelete}
                  disabled={!phoneNumber}
                  className="h-11 sm:h-12 text-sm"
                >
                  <Delete className="h-4 w-4 sm:h-5 sm:w-5 mr-1" />
                  Delete
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleCall}
                  disabled={!phoneNumber || isLoading}
                  className="h-11 sm:h-12 bg-accent-success hover:bg-accent-success/90 text-white font-semibold text-sm"
                >
                  <PhoneCall className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5" />
                  {isLoading ? 'Connecting...' : 'Call'}
                </Button>
              </div>
            )}
          </div>
        </Panel>

        {/* Info & Instructions Panel */}
        <Panel className="p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-chart-cyan shrink-0" />
            Browser Direct Calling Guide
          </h2>
          <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-slate-blue-300">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                1
              </div>
              <p>
                <strong className="text-white">Direct Two-Way Audio:</strong> When you press Call, your browser connects directly to the customer's phone using WebRTC audio. When they answer, you talk directly into your microphone and hear them through your speakers or headphones.
              </p>
            </div>
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                2
              </div>
              <p>
                <strong className="text-white">Microphone Controls:</strong> During a live call, use the <span className="text-white font-medium">Mute Mic</span> button to toggle your microphone at any time.
              </p>
            </div>
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                3
              </div>
              <p>
                <strong className="text-white">Global Numbers:</strong> Call any destination worldwide supported by Twilio. Kenyan numbers (<span className="font-mono text-white">07XXXXXXXX</span>) and global formats (<span className="font-mono text-white">+...</span>) are automatically formatted to E.164.
              </p>
            </div>
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                4
              </div>
              <p>
                <strong className="text-white">Instant Transfer:</strong> You can transfer an active call to any registered customer care agent or external phone number directly from the dialer.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
