'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Radio } from 'lucide-react';

export function LoadingSplash({ persist = false }: { persist?: boolean }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (persist) return;

    // Smooth fade-out once page is hydrated and ready
    const timer = setTimeout(() => {
      setIsFading(true);
      const removeTimer = setTimeout(() => {
        setIsVisible(false);
      }, 500);
      return () => clearTimeout(removeTimer);
    }, 700);

    return () => clearTimeout(timer);
  }, [persist]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0E1A] text-white px-4 select-none overflow-hidden transition-opacity duration-500 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient Cyber Glows */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute w-[350px] h-[350px] rounded-full bg-blue-600/15 blur-[100px] pointer-events-none" />

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

        {/* Progress Bar & Status */}
        <div className="w-full space-y-3">
          <div className="w-full h-1.5 bg-[#141C30] rounded-full overflow-hidden border border-cyan-500/20 relative shadow-inner">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 rounded-full animate-[progress_1.8s_ease-in-out_infinite] shadow-[0_0_12px_#00D4FF]" />
          </div>

          <div className="h-5 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <p className="text-xs font-mono text-cyan-300 animate-pulse">
              Connecting to secure workspace...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
