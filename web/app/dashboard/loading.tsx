'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShieldCheck, Radio, Sparkles, Cpu } from 'lucide-react';

export default function DashboardLoading() {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    'Authenticating secure session...',
    'Connecting WebRTC voice gateway...',
    'Loading contact centre agents & workspace...',
    'Finalizing live communications channel...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 900);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0E1A] text-white px-4 select-none overflow-hidden">
      {/* Background Ambient Cyber Glows */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute w-[350px] h-[350px] rounded-full bg-blue-600/15 blur-[100px] pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-gradient-to-b from-cyan-500/10 to-transparent blur-2xl pointer-events-none" />

      {/* Main Content Card */}
      <div className="relative flex flex-col items-center max-w-sm w-full z-10 text-center space-y-8">
        
        {/* Animated Glowing Logo with Concentric Radar Wave Rings */}
        <div className="relative flex items-center justify-center">
          {/* Radar Wave 1 */}
          <div className="absolute w-36 h-36 rounded-full border border-cyan-400/20 animate-ping [animation-duration:3s]" />
          
          {/* Radar Wave 2 */}
          <div className="absolute w-48 h-48 rounded-full border border-cyan-500/15 animate-[pulse_2.5s_infinite]" />

          {/* Outer Cyber Spinning Ring */}
          <div className="w-28 h-28 rounded-full border-2 border-dashed border-cyan-400/40 animate-[spin_10s_linear_infinite]" />
          
          {/* Inner Reverse Ring */}
          <div className="absolute w-24 h-24 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-[spin_4s_linear_infinite_reverse]" />

          {/* Center Logo Card */}
          <div className="absolute w-20 h-20 rounded-2xl bg-[#0F1629] border border-cyan-500/40 p-2 shadow-[0_0_35px_rgba(0,212,255,0.35)] flex items-center justify-center overflow-hidden">
            <Image
              src="/brand/icon.png"
              alt="Contact Centre Insights"
              width={72}
              height={72}
              className="object-contain drop-shadow-[0_0_12px_#00D4FF]"
              priority
            />
          </div>
        </div>

        {/* Brand Titles */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold tracking-wider uppercase mb-1 shadow-sm">
            <Radio className="h-3 w-3 animate-pulse text-cyan-400" />
            Live Voice Network
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
            Contact Centre Insights
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Next-Gen AI Call Operations &amp; Intelligence
          </p>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="w-full space-y-3">
          {/* Shimmering Progress Bar */}
          <div className="w-full h-1.5 bg-[#141C30] rounded-full overflow-hidden border border-cyan-500/20 relative shadow-inner">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 rounded-full animate-[progress_1.8s_ease-in-out_infinite] shadow-[0_0_12px_#00D4FF]" />
          </div>

          {/* Rotating Status Step */}
          <div className="h-5 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <p className="text-xs font-mono text-cyan-300 transition-all duration-300 animate-fadeIn">
              {steps[stepIndex]}
            </p>
          </div>
        </div>

        {/* Security / System Badges */}
        <div className="pt-2 flex items-center justify-center gap-4 text-[10px] text-slate-400 uppercase tracking-widest font-mono border-t border-slate-800/80 w-full">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            256-Bit Encrypted
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            AI Voice Ready
          </span>
        </div>

      </div>
    </div>
  );
}
