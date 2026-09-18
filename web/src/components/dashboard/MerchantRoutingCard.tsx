'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Copy, Check, Phone, ArrowUpRight, Radio } from 'lucide-react';

interface MerchantRoutingCardProps {
  merchantCode: string;
  phoneNumber?: string;
}

export function MerchantRoutingCard({
  merchantCode,
  phoneNumber = '+1 (251) 357-1708',
}: MerchantRoutingCardProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(merchantCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(phoneNumber.replace(/[^\d+]/g, ''));
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/40 via-[#0D1527] to-[#0A0F1E] border border-cyan-500/30 p-4 sm:p-6 shadow-[0_0_30px_rgba(0,212,255,0.1)] transition-all">
      {/* Ambient background glow orb */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[90px] pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        
        {/* Left Info */}
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
            <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] sm:text-xs uppercase font-extrabold tracking-widest text-cyan-400">
                Your Dedicated Inbound Line
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 flex-wrap">
              <span>Callers dial</span>
              <button
                onClick={handleCopyPhone}
                className="inline-flex items-center gap-1 font-mono font-bold text-white bg-white/[0.06] hover:bg-white/[0.1] px-2 py-0.5 rounded-md border border-white/10 transition-colors"
                title="Click to copy phone number"
              >
                <Phone className="h-3 w-3 text-cyan-400" />
                <span>{phoneNumber}</span>
                {copiedPhone ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 text-slate-400" />
                )}
              </button>
              <span>and enter your code:</span>
            </div>
          </div>
        </div>

        {/* Right Code Badge & Configure */}
        <div className="flex items-center gap-3 sm:gap-4 self-start lg:self-auto">
          <div
            onClick={handleCopyCode}
            className="cursor-pointer group relative px-4 sm:px-5 py-2.5 bg-[#080D1A] border border-cyan-500/40 hover:border-cyan-400 rounded-xl text-center shadow-inner transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Click to copy merchant code"
          >
            <div className="flex items-center justify-between gap-3 mb-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Merchant Code
              </span>
              {copiedCode ? (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                  <Check className="h-3 w-3" /> Copied
                </span>
              ) : (
                <Copy className="h-3 w-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              )}
            </div>
            <span className="text-xl sm:text-2xl font-mono font-black text-cyan-300 tracking-wider block drop-shadow-[0_0_10px_rgba(0,212,255,0.4)]">
              {merchantCode || '100001'}
            </span>
          </div>

          <Link
            href="/dashboard/settings/phone"
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline px-2 py-1 rounded-lg transition-colors"
          >
            <span>Configure</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
