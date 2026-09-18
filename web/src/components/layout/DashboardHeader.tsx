'use client';

import { Bell, Search, Copy, Check, Hash, PhoneIncoming, Coins, Wallet } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { TopUpModal } from '@/components/billing/TopUpModal';
import { getApiEndpoint } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

export function DashboardHeader() {
  const { organizationId, merchantCode: contextCode } = useOrganization();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [merchantCode, setMerchantCode] = useState(contextCode || '104829');
  const [copied, setCopied] = useState(false);
  const [activeCallCount, setActiveCallCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0.0);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const fetchWallet = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await fetch(getApiEndpoint(`/api/v1/billing/wallet?organizationId=${organizationId}`));
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.balance || 0);
      }
    } catch (e) {}
  }, [organizationId]);

  useEffect(() => {
    if (contextCode) setMerchantCode(contextCode);
  }, [contextCode]);

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 10000);
    const onFocus = () => fetchWallet();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchWallet]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata;
        const name =
          meta?.full_name ||
          meta?.name ||
          data.user.email?.split('@')[0] ||
          'User';
        setUserName(name);
        setUserEmail(data.user.email || '');

        try {
          const targetId = organizationId || data.user.id;

          // Check live calls count
          const { data: liveCalls } = await supabase
            .from('communications')
            .select('id')
            .eq('organization_id', targetId)
            .in('status', ['in-progress', 'ringing']);

          setActiveCallCount(liveCalls?.length || 0);
        } catch {}
      }
    });
  }, [organizationId]);

  const copyMerchantCode = () => {
    navigator.clipboard.writeText(merchantCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="sticky top-0 z-30 bg-[#070B14]/90 backdrop-blur-xl border-b border-white/[0.07] pt-safe">
      <div className="flex items-center justify-between pl-14 pr-3 sm:px-6 py-2.5 sm:py-3.5 min-h-[58px]">
        {/* Search - Visible on tablet and desktop */}
        <div className="hidden md:block flex-1 max-w-xs lg:max-w-md mr-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search calls, contacts, or messages..."
              className="w-full pl-9 pr-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all"
            />
          </div>
        </div>

        {/* Brand / Title shown only on mobile when sidebar is closed */}
        <div className="md:hidden flex items-center gap-2 shrink-0">
          <div className="relative w-6 h-6 rounded-lg overflow-hidden border border-cyan-500/30 bg-[#0F1629] p-0.5 shrink-0 shadow-[0_0_10px_rgba(0,212,255,0.2)]">
            <Image
              src="/brand/icon.png"
              alt="CallPulse"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <span className="text-xs font-black text-white tracking-wider uppercase hidden sm:inline">CallPulse</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 ml-auto">
          {/* Active Call Live Indicator */}
          {activeCallCount > 0 && (
            <Link
              href="/dashboard/calls"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] sm:text-xs font-bold animate-pulse shrink-0"
              title={`${activeCallCount} active call in progress`}
            >
              <PhoneIncoming className="h-3 w-3 shrink-0" />
              <span className="hidden xs:inline">Active:</span>
              <span>{activeCallCount}</span>
            </Link>
          )}

          {/* Interactive Wallet Balance Badge */}
          <button
            onClick={() => setIsTopUpOpen(true)}
            title="Available wallet balance for voice minutes and dedicated numbers. Click to top up."
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400/50 rounded-xl cursor-pointer transition-all text-xs shrink-0 shadow-sm active:scale-[0.98]"
          >
            <Coins className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400 font-semibold hidden md:inline text-[11px]">Wallet:</span>
            <span className="font-mono font-black text-cyan-300 tracking-wide text-xs">
              ${walletBalance.toFixed(2)}
            </span>
          </button>

          {/* 6-Digit Merchant Code Badge */}
          <button
            onClick={copyMerchantCode}
            title="Callers to +1 (251) 357-1708 enter this code to reach you. Click to copy."
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-cyan-500/40 rounded-xl cursor-pointer transition-all text-xs shrink-0 active:scale-[0.98]"
          >
            <Hash className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400 font-semibold hidden md:inline text-[11px]">Merchant:</span>
            <span className="font-mono font-bold text-white tracking-wider text-xs">{merchantCode}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400 ml-0.5" />
            ) : (
              <Copy className="h-3 w-3 text-slate-400 hover:text-white ml-0.5 hidden sm:inline" />
            )}
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08] shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs sm:text-sm font-semibold text-white max-w-[90px] sm:max-w-[130px] truncate">
                {userName || 'User'}
              </p>
              <p className="text-[10px] text-slate-400 truncate max-w-[130px] hidden md:block">
                {userEmail}
              </p>
            </div>
            <Avatar size="sm" fallback={initials} />
          </div>
        </div>
      </div>

      {/* TopUpModal */}
      <TopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={(newBal) => {
          setWalletBalance(newBal);
          fetchWallet();
        }}
      />
    </header>
  );
}
