'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export interface CallPulseLoaderProps {
  variant?: 'fullscreen' | 'inline' | 'button' | 'card';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  text?: string;
  subtext?: string;
  className?: string;
}

export function CallPulseLoader({
  variant = 'inline',
  size = 'md',
  text,
  subtext,
  className,
}: CallPulseLoaderProps) {
  // Button variant: compact inline spinner with cyber pulse
  if (variant === 'button') {
    return (
      <span className={cn('inline-flex items-center justify-center gap-2', className)}>
        <span className="relative flex items-center justify-center w-4 h-4">
          <span className="absolute inset-0 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00E5FF] animate-pulse" />
        </span>
        {text && <span className="truncate">{text}</span>}
      </span>
    );
  }

  // Fullscreen variant: modern SaaS page/route loader
  if (variant === 'fullscreen') {
    return (
      <div
        className={cn(
          'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070B14]/95 backdrop-blur-xl text-white px-4 select-none',
          className
        )}
      >
        {/* Ambient atmospheric glows */}
        <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute w-80 h-80 rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

        <div className="relative flex flex-col items-center max-w-sm w-full z-10 text-center space-y-6">
          {/* Sonic Radar Pulse Orb */}
          <div className="relative flex items-center justify-center">
            {/* Concentric expanding ripples */}
            <div className="absolute w-36 h-36 rounded-full border border-cyan-400/30 animate-ping [animation-duration:2.5s]" />
            <div className="absolute w-28 h-28 rounded-full border border-blue-500/20 animate-pulse [animation-duration:2s]" />

            {/* Orbiting dual ring */}
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-cyan-400/50 animate-[spin_8s_linear_infinite]" />
            <div className="absolute w-20 h-20 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-[spin_3s_linear_infinite_reverse]" />

            {/* Center Core Logo */}
            <div className="absolute w-16 h-16 rounded-2xl bg-[#0F1629] border border-cyan-500/40 p-2 shadow-[0_0_30px_rgba(0,212,255,0.35)] flex items-center justify-center">
              <Image
                src="/brand/icon.png"
                alt="CallPulse"
                width={48}
                height={48}
                className="object-contain drop-shadow-[0_0_10px_#00D4FF]"
                priority
              />
            </div>
          </div>

          {/* Texts */}
          <div className="space-y-1.5">
            <h3 className="text-base font-bold tracking-tight text-white uppercase bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
              {text || 'CallPulse AI'}
            </h3>
            {subtext && (
              <p className="text-xs text-slate-400 font-medium">
                {subtext}
              </p>
            )}
          </div>

          {/* Shimmering progress bar */}
          <div className="w-48 h-1 bg-[#141C30] rounded-full overflow-hidden border border-cyan-500/20 relative">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 rounded-full animate-[progress_1.6s_ease-in-out_infinite] shadow-[0_0_10px_#00D4FF]" />
          </div>
        </div>
      </div>
    );
  }

  // Card & Inline variants (used inside dashboard panels, tables, dialogs)
  const sizeMap = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const ringSizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-8 h-8',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-6 gap-3 text-center',
        variant === 'card' && 'min-h-[160px] bg-navy-dark-panel/40 rounded-xl border border-navy-dark-border/60',
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        {/* Animated Sonic Radar Ring */}
        <div
          className={cn(
            'absolute rounded-full border border-cyan-400/25 animate-ping [animation-duration:2.2s]',
            ringSizeMap[size]
          )}
        />
        {/* Rotating gradient dashed ring */}
        <div
          className={cn(
            'rounded-full border-2 border-dashed border-cyan-400/60 animate-[spin_6s_linear_infinite]',
            ringSizeMap[size]
          )}
        />
        {/* Inner reverse spinner */}
        <div
          className={cn(
            'absolute rounded-full border-2 border-t-cyan-300 border-r-transparent border-b-blue-400 border-l-transparent animate-[spin_2s_linear_infinite]',
            sizeMap[size]
          )}
        />
        {/* Center glowing core dot */}
        <div className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#00E5FF] animate-pulse" />
      </div>

      {(text || subtext) && (
        <div className="space-y-0.5 max-w-xs">
          {text && (
            <p className="text-xs font-semibold text-slate-200 tracking-wide">
              {text}
            </p>
          )}
          {subtext && (
            <p className="text-[11px] text-slate-400">
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
