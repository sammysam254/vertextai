'use client';

import React, { useState, useEffect } from 'react';
import { Phone, Sparkles } from 'lucide-react';

export function LoadingSplash() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Smooth fade-out once hydrated and DOM is ready
    const timer = setTimeout(() => {
      setIsFading(true);
      const removeTimer = setTimeout(() => {
        setIsVisible(false);
      }, 500);
      return () => clearTimeout(removeTimer);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-navy-dark transition-opacity duration-500 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient glow */}
      <div className="absolute w-72 h-72 rounded-full bg-chart-cyan/15 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute w-96 h-96 rounded-full bg-accent-primary/10 blur-3xl pointer-events-none" />

      {/* Brand Icon & Spinner Container */}
      <div className="relative flex flex-col items-center space-y-6 z-10">
        <div className="relative flex items-center justify-center">
          {/* Dual spinning glowing rings */}
          <div className="w-20 h-20 rounded-full border-2 border-chart-cyan/20 border-t-chart-cyan animate-spin" />
          <div className="absolute w-14 h-14 rounded-full border-2 border-accent-primary/30 border-b-accent-primary animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />

          {/* Center CallPulse logo */}
          <div className="absolute w-10 h-10 rounded-xl bg-navy-dark-elevated border border-navy-dark-border flex items-center justify-center shadow-[0_0_20px_#00D4FF40]">
            <Phone className="h-5 w-5 text-chart-cyan animate-pulse" />
          </div>
        </div>

        {/* Text & Progress */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-extrabold tracking-wider text-white flex items-center justify-center gap-2">
            CallPulse
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-chart-cyan/20 text-chart-cyan border border-chart-cyan/40">
              AI Voice
            </span>
          </h1>
          <p className="text-xs text-slate-blue-400 animate-pulse">
            Connecting to secure workspace...
          </p>
        </div>

        {/* Gradient Progress Bar */}
        <div className="w-48 h-1 bg-navy-dark-elevated rounded-full overflow-hidden border border-navy-dark-border">
          <div className="h-full bg-gradient-to-r from-chart-cyan via-accent-primary to-chart-blue rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
