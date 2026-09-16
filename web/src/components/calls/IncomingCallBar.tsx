'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useOrganization } from '@/lib/context/OrganizationContext';
import {
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  Volume2,
  ArrowRightLeft,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDuration, formatPhoneNumber } from '@/lib/utils';
import { useAgents } from '@/lib/hooks/useCalls';

export function IncomingCallBar() {
  const { organizationId, merchantCode, organizationName } = useOrganization();
  const [device, setDevice] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callerNumber, setCallerNumber] = useState<string>('');
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [transferPhone, setTransferPhone] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [transferStatus, setTransferStatus] = useState<string>('');
  const [audioChimeActive, setAudioChimeActive] = useState<boolean>(false);

  const deviceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { agents } = useAgents(organizationId, true);

  const getApiEndpoint = (path: string): string => {
    if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
      return `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${path}`;
    }
    return path;
  };

  // Play synthetic telephone ring tone using Web Audio API
  const startRingChime = () => {
    try {
      if (audioContextRef.current) return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const playTone = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        const now = audioContextRef.current.currentTime;
        const osc1 = audioContextRef.current.createOscillator();
        const osc2 = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now); // 440 Hz
        osc2.frequency.setValueAtTime(480, now); // 480 Hz

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContextRef.current.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.6);
        osc2.stop(now + 1.6);
      };

      playTone();
      chimeIntervalRef.current = setInterval(playTone, 3000);
      setAudioChimeActive(true);
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  };

  const stopRingChime = () => {
    if (chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setAudioChimeActive(false);
  };

  // Initialize WebRTC Device for this merchant
  useEffect(() => {
    if (!organizationId || typeof window === 'undefined') return;

    let isMounted = true;

    async function initDevice() {
      try {
        const clientIdentity = `merchant_${organizationId}`;
        const res = await fetch(getApiEndpoint(`/api/v1/voice/token?identity=${encodeURIComponent(clientIdentity)}`));
        if (!res.ok) return;

        const data = await res.json();
        if (!data?.token || !isMounted) return;

        const { Device, Call } = await import('@twilio/voice-sdk');

        const twilioDevice = new Device(data.token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        });

        twilioDevice.on('incoming', (call: any) => {
          if (!isMounted) return;
          console.log('Incoming call arrived:', call.parameters);
          setIncomingCall(call);
          setCallerNumber(call.parameters?.From || 'Anonymous Caller');
          startRingChime();

          call.on('cancel', () => {
            stopRingChime();
            setIncomingCall(null);
            setIsCallActive(false);
            setActiveCall(null);
          });

          call.on('disconnect', () => {
            stopRingChime();
            setIncomingCall(null);
            setIsCallActive(false);
            setActiveCall(null);
          });
        });

        twilioDevice.on('error', (err: any) => {
          console.warn('Twilio device error in IncomingCallBar:', err);
        });

        await twilioDevice.register();

        if (isMounted) {
          deviceRef.current = twilioDevice;
          setDevice(twilioDevice);
        }
      } catch (err) {
        console.warn('Failed to setup incoming call listener:', err);
      }
    }

    initDevice();

    return () => {
      isMounted = false;
      stopRingChime();
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {}
      }
    };
  }, [organizationId]);

  // Call timer when connected
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isCallActive) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCallActive]);

  // Answer Incoming Call
  const handleAnswer = () => {
    stopRingChime();
    if (incomingCall) {
      incomingCall.accept();
      activeCallRef.current = incomingCall;
      setActiveCall(incomingCall);
      setIsCallActive(true);
      setIncomingCall(null);

      incomingCall.on('disconnect', () => {
        setIsCallActive(false);
        setActiveCall(null);
        activeCallRef.current = null;
      });

      incomingCall.on('error', (err: any) => {
        console.error('Call connection error:', err);
        setIsCallActive(false);
        setActiveCall(null);
      });
    }
  };

  // Reject / Decline Call
  const handleReject = () => {
    stopRingChime();
    if (incomingCall) {
      try {
        incomingCall.reject();
      } catch {}
      setIncomingCall(null);
    }
  };

  // Hangup Active Call
  const handleHangup = () => {
    if (activeCall) {
      try {
        activeCall.disconnect();
      } catch {}
      setActiveCall(null);
      activeCallRef.current = null;
    }
    setIsCallActive(false);
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (activeCall) {
      const nextMute = !isMuted;
      activeCall.mute(nextMute);
      setIsMuted(nextMute);
    }
  };

  // Transfer Call
  const handleTransfer = async () => {
    if (!transferPhone.trim() || !activeCall || isTransferring) return;

    setIsTransferring(true);
    setTransferStatus('');

    try {
      const sid = activeCall.parameters?.CallSid;
      const formatted = formatPhoneNumber(transferPhone);
      const res = await fetch(getApiEndpoint('/api/v1/voice/transfer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid: sid,
          agentPhone: formatted,
          organizationId: organizationId || 'default',
        }),
      });

      if (!res.ok) {
        throw new Error('Transfer failed');
      }

      setTransferStatus('Transferred successfully!');
      setTimeout(() => {
        setTransferStatus('');
        setTransferPhone('');
      }, 3000);
    } catch (err: any) {
      setTransferStatus('Transfer failed. Please check the number.');
    } finally {
      setIsTransferring(false);
    }
  };

  if (!incomingCall && !isCallActive) {
    return null;
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-2xl animate-in fade-in slide-in-from-top-4 duration-300">
      {/* INCOMING RINGING CALL */}
      {incomingCall && (
        <div className="bg-navy-dark-panel/95 backdrop-blur-md border-2 border-accent-primary rounded-xl p-4 sm:p-5 shadow-2xl shadow-accent-primary/20 text-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center text-accent-primary animate-pulse">
                <PhoneIncoming className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-accent-primary animate-ping" />
                  <span className="text-xs font-semibold text-accent-primary uppercase tracking-wider">
                    Incoming Call for {organizationName || 'Your Store'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-mono font-bold text-white">
                  {formatPhoneNumber(callerNumber)}
                </h3>
                <p className="text-xs text-slate-blue-400">
                  Routed via Merchant ID <strong className="text-white font-mono">{merchantCode}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={handleReject}
                className="flex-1 sm:flex-none h-11 px-4 bg-accent-danger/20 hover:bg-accent-danger/30 text-accent-danger border-accent-danger/40 text-xs sm:text-sm font-semibold"
              >
                <PhoneOff className="h-4 w-4 mr-1.5" />
                Decline
              </Button>
              <Button
                variant="primary"
                onClick={handleAnswer}
                className="flex-1 sm:flex-none h-11 px-6 bg-accent-success hover:bg-accent-success/90 text-white text-xs sm:text-sm font-bold shadow-lg shadow-accent-success/25"
              >
                <PhoneCall className="h-4 w-4 mr-1.5" />
                Answer Call
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE CALL IN PROGRESS */}
      {isCallActive && (
        <div className="bg-navy-dark-panel/95 backdrop-blur-md border border-accent-success/40 rounded-xl p-4 shadow-2xl shadow-accent-success/15 text-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-success/20 flex items-center justify-center text-accent-success">
                <Volume2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-accent-success animate-ping" />
                  <span className="text-xs font-semibold text-accent-success">Live Call Connected</span>
                  <span className="text-xs font-mono font-bold bg-navy-dark px-2 py-0.5 rounded text-white border border-slate-700">
                    {formatDuration(callDuration)}
                  </span>
                </div>
                <p className="text-sm font-mono font-medium text-white">{formatPhoneNumber(callerNumber)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleToggleMute}
                className={`h-9 text-xs ${isMuted ? 'bg-accent-danger/20 text-accent-danger border-accent-danger/40' : ''}`}
              >
                {isMuted ? <MicOff className="h-3.5 w-3.5 mr-1" /> : <Mic className="h-3.5 w-3.5 mr-1" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleHangup}
                className="h-9 bg-accent-danger hover:bg-accent-danger/90 text-white font-semibold text-xs"
              >
                <PhoneOff className="h-3.5 w-3.5 mr-1" />
                End Call
              </Button>
            </div>
          </div>

          {/* Quick Transfer Row */}
          <div className="mt-3 pt-3 border-t border-navy-dark-border flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-blue-400 flex items-center gap-1">
              <ArrowRightLeft className="h-3 w-3 text-accent-primary" /> Transfer to:
            </span>
            {agents.length > 0 && (
              <select
                onChange={(e) => setTransferPhone(e.target.value)}
                value={transferPhone}
                className="px-2 py-1 bg-navy-dark border border-navy-dark-border rounded text-xs text-white"
              >
                <option value="">-- Choose registered agent --</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.phone_number}>
                    {ag.name} ({ag.phone_number})
                  </option>
                ))}
              </select>
            )}
            <input
              type="tel"
              placeholder="Or phone number..."
              value={transferPhone}
              onChange={(e) => setTransferPhone(e.target.value)}
              className="input !h-7 text-xs font-mono !w-36"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTransfer}
              disabled={!transferPhone.trim() || isTransferring}
              className="!h-7 text-xs px-2.5 bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary border-accent-primary/40"
            >
              {isTransferring ? 'Transferring...' : 'Transfer'}
            </Button>
            {transferStatus && (
              <span className="text-xs text-accent-success ml-2">{transferStatus}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
