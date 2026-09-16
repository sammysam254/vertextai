'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Radio } from 'lucide-react';

export function LoadingSplash() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Smooth fade-out once page is hydrated and ready
    const timer = setTimeout(() => {
      setIsFading(true);
      const removeTimer = setTimeout(() => {
        setIsVisible(false);
      }, 500);
      return () => clearTimeout(removeTimer);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0E1A] transition-opacity duration-500 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient glow */}
      <div className="absolute w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

      {/* Brand Icon & Spinner Container */}
      <div className="relative flex flex-col items-center space-y-6 z-10 text-center px-4">
        <div className="relative flex items-center justify-center">
          {/* Dual spinning glowing rings */}
          <div className="w-24 h-24 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
          <div className="absolute w-18 h-18 rounded-full border-2 border-emerald-400/30 border-b-emerald-400 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />

          {/* Center Contact Centre Insights logo */}
          <div className="absolute w-14 h-14 rounded-2xl bg-[#0F1629] border border-cyan-500/40 p-1.5 flex items-center justify-center shadow-[0_0_25px_#00D4FF50] overflow-hidden">
            <Image
              src="/brand/icon.png"
              alt="Contact Centre Insights"
              width={50}
              height={50}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Text & Progress */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono uppercase mb-1">
            <Radio className="h-2.5 w-2.5 animate-pulse text-cyan-400" />
            AI Voice Gateway
          </div>
          <h1 className="text-lg font-extrabold tracking-wider text-white uppercase">
            Contact Centre Insights
          </h1>
          <p className="text-xs text-slate-400 font-medium animate-pulse">
            Connecting to secure workspace...
          </p>
        </div>

        {/* Gradient Progress Bar */}
        <div className="w-48 h-1.5 bg-[#141C30] rounded-full overflow-hidden border border-cyan-500/20">
          <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
