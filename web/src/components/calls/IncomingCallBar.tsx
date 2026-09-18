'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useOrganization } from '@/lib/context/OrganizationContext';
import {
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  Volume2,
  ArrowRightLeft,
  Minimize2,
  Maximize2,
  Radio,
  User,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDuration, formatPhoneNumber, getApiEndpoint } from '@/lib/utils';
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
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const deviceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { agents } = useAgents(organizationId, true);

  // Vibration support for mobile devices
  const startVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 600]);
        vibrationIntervalRef.current = setInterval(() => {
          navigator.vibrate([400, 200, 400, 200, 600]);
        }, 2500);
      } catch {}
    }
  };

  const stopVibration = () => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  };

  // Play synthetic telephone ring tone using Web Audio API
  const startRingChime = () => {
    startVibration();
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

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContextRef.current.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.8);
        osc2.stop(now + 1.8);
      };

      playTone();
      chimeIntervalRef.current = setInterval(playTone, 3000);
      setAudioChimeActive(true);
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  };

  const stopRingChime = () => {
    stopVibration();
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
          setIsMinimized(false);
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
    <>
      {/* 1. WHATSAPP-STYLE FULL SCREEN INCOMING CALL MODAL */}
      {incomingCall && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-between items-center bg-gradient-to-b from-[#0A1020] via-[#070B16] to-[#04060C] text-white p-6 pt-safe pb-safe select-none overflow-hidden animate-in fade-in duration-300">
          {/* Ambient Cyber Light Glows */}
          <div className="absolute w-[450px] h-[450px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute w-[350px] h-[350px] rounded-full bg-cyan-500/15 blur-[100px] pointer-events-none" />

          {/* Top Header Information */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-2 pt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold uppercase tracking-wider shadow-sm">
              <Radio className="h-3 w-3 animate-pulse" />
              Incoming Voice Call
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Routed to Merchant #{merchantCode} • {organizationName || 'Contact Centre'}
            </p>
          </div>

          {/* Center: Concentric Radar Pulse Waves & Big Avatar */}
          <div className="relative z-10 flex flex-col items-center text-center my-auto">
            <div className="relative flex items-center justify-center my-4">
              {/* Outer Ripple 1 */}
              <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full border border-emerald-400/20 animate-ping [animation-duration:2.8s]" />
              {/* Ripple 2 */}
              <div className="absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full border border-cyan-400/30 animate-[pulse_2s_infinite]" />

              {/* Central Glowing Avatar Circle */}
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#0F172A] border-2 border-emerald-400/70 shadow-[0_0_50px_rgba(16,185,129,0.45)] flex items-center justify-center overflow-hidden">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse">
                  <PhoneIncoming className="h-10 w-10 sm:h-12 sm:w-12" />
                </div>
              </div>
            </div>

            {/* Caller Number */}
            <h2 className="text-2xl sm:text-4xl font-mono font-black tracking-wide text-white mt-4 drop-shadow-md">
              {formatPhoneNumber(callerNumber)}
            </h2>
            <p className="text-sm text-cyan-300 font-medium mt-1 animate-pulse">
              CallPulse Audio Gateway • Ringing...
            </p>
          </div>

          {/* Bottom WhatsApp-Style Action Buttons */}
          <div className="relative z-10 flex items-center justify-center gap-14 sm:gap-20 pb-6 w-full max-w-sm">
            {/* Decline Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleReject}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 shadow-[0_0_35px_rgba(239,68,68,0.6)] flex items-center justify-center text-white transition-all cursor-pointer"
                title="Decline Call"
                aria-label="Decline Call"
              >
                <PhoneOff className="h-7 w-7 sm:h-9 sm:w-9" />
              </button>
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Decline</span>
            </div>

            {/* Answer Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAnswer}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 shadow-[0_0_45px_rgba(16,185,129,0.8)] flex items-center justify-center text-white transition-all cursor-pointer animate-bounce"
                title="Answer Call"
                aria-label="Answer Call"
              >
                <PhoneCall className="h-7 w-7 sm:h-9 sm:w-9" />
              </button>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Answer</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACTIVE CONNECTED CALL (Minimized Bar or Expanded Panel) */}
      {isCallActive && (
        <div
          className={`fixed z-50 transition-all duration-300 ${
            isMinimized
              ? 'top-2.5 left-1/2 -translate-x-1/2 w-[92vw] max-w-md'
              : 'top-3 left-1/2 -translate-x-1/2 w-[95vw] max-w-2xl'
          }`}
        >
          <div className="bg-navy-dark-panel/95 backdrop-blur-md border border-accent-success/40 rounded-xl p-3.5 sm:p-4 shadow-2xl shadow-accent-success/15 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-accent-success/20 flex items-center justify-center text-accent-success shrink-0">
                  <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-accent-success animate-ping" />
                    <span className="text-xs font-semibold text-accent-success">Live Call</span>
                    <span className="text-xs font-mono font-bold bg-navy-dark px-2 py-0.5 rounded text-white border border-slate-700">
                      {formatDuration(callDuration)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-mono font-medium text-white">{formatPhoneNumber(callerNumber)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleToggleMute}
                  className={`h-8 sm:h-9 text-xs px-2.5 ${
                    isMuted ? 'bg-accent-danger/20 text-accent-danger border-accent-danger/40' : ''
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  <span className="hidden xs:inline ml-1">{isMuted ? 'Unmute' : 'Mute'}</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleHangup}
                  className="h-8 sm:h-9 px-3 bg-accent-danger hover:bg-accent-danger/90 text-white font-semibold text-xs shadow-md"
                  title="Hang up call"
                >
                  <PhoneOff className="h-3.5 w-3.5 mr-1" />
                  End
                </Button>

                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors"
                  title={isMinimized ? 'Expand call controls' : 'Minimize call bar'}
                >
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Quick Transfer Row (Visible when expanded) */}
            {!isMinimized && (
              <div className="mt-3 pt-3 border-t border-navy-dark-border flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-blue-400 flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3 text-accent-primary" /> Transfer:
                </span>
                {agents.length > 0 && (
                  <select
                    onChange={(e) => setTransferPhone(e.target.value)}
                    value={transferPhone}
                    className="px-2 py-1 bg-navy-dark border border-navy-dark-border rounded text-xs text-white max-w-[150px] sm:max-w-none truncate"
                  >
                    <option value="">-- Choose agent --</option>
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.phone_number}>
                        {ag.name} ({ag.phone_number})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="tel"
                  placeholder="Phone number..."
                  value={transferPhone}
                  onChange={(e) => setTransferPhone(e.target.value)}
                  className="input !h-7 text-xs font-mono !w-32"
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
                  <span className="text-xs text-accent-success ml-1">{transferStatus}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
