'use client';

import { Bell, Search, Copy, Check, Hash, PhoneIncoming } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export function DashboardHeader() {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [merchantCode, setMerchantCode] = useState('104829');
  const [copied, setCopied] = useState(false);
  const [activeCallCount, setActiveCallCount] = useState(0);

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

        // Fetch user's organization to get deterministic merchant code
        try {
          const { data: member } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', data.user.id)
            .limit(1)
            .single();

          const targetId = member?.organization_id || data.user.id;
          let hash = 0;
          for (let i = 0; i < targetId.length; i++) {
            hash = (hash * 31 + targetId.charCodeAt(i)) >>> 0;
          }
          const code = String(100000 + (hash % 900000));
          setMerchantCode(code);

          // Check live calls count
          const { data: liveCalls } = await supabase
            .from('communications')
            .select('id')
            .eq('organization_id', targetId)
            .in('status', ['in-progress', 'ringing']);

          setActiveCallCount(liveCalls?.length || 0);
        } catch {
          // Fallback code
          setMerchantCode('104829');
        }
      }
    });
  }, []);

  const copyMerchantCode = () => {
    navigator.clipboard.writeText(merchantCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="sticky top-0 z-30 bg-navy-dark/95 backdrop-blur-sm border-b border-navy-dark-border">
      <div className="flex items-center justify-between pl-14 pr-3 sm:px-6 py-2.5 sm:py-4 min-h-[58px]">
        {/* Search - Visible on tablet and desktop */}
        <div className="hidden md:block flex-1 max-w-xs lg:max-w-md mr-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-blue-500" />
            <input
              type="search"
              placeholder="Search calls, contacts, or messages..."
              className="w-full pl-9 pr-4 py-1.5 bg-navy-dark-elevated border border-navy-dark-border rounded-md text-xs sm:text-sm text-slate-blue-100 placeholder:text-slate-blue-500 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Brand / Title shown only on mobile when sidebar is closed */}
        <div className="md:hidden flex items-center gap-1.5">
          <span className="text-sm font-bold text-white tracking-wide">CallPulse</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5 sm:gap-3 ml-auto">
          {/* Active Call Live Indicator */}
          {activeCallCount > 0 && (
            <Link
              href="/dashboard/calls"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-accent-success/20 border border-accent-success/40 text-accent-success text-[11px] sm:text-xs font-semibold animate-pulse shrink-0"
              title={`${activeCallCount} active call in progress`}
            >
              <PhoneIncoming className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="hidden xs:inline">Active:</span>
              <span>{activeCallCount}</span>
            </Link>
          )}

          {/* 6-Digit Merchant Code Badge */}
          <div
            onClick={copyMerchantCode}
            title="Callers to +1 (251) 357-1708 dial this 6-digit merchant code to reach you. Click to copy."
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-navy-dark-elevated hover:bg-navy-dark-elevated/80 border border-chart-cyan/30 hover:border-chart-cyan rounded-lg cursor-pointer transition-colors text-xs shrink-0"
          >
            <Hash className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-chart-cyan shrink-0" />
            <span className="text-slate-blue-300 font-medium hidden sm:inline text-xs">Merchant:</span>
            <span className="font-mono font-bold text-white tracking-wider text-[11px] sm:text-xs">{merchantCode}</span>
            {copied ? (
              <Check className="h-3 w-3 text-accent-success ml-0.5" />
            ) : (
              <Copy className="h-3 w-3 text-slate-blue-400 hover:text-white ml-0.5 hidden xs:inline" />
            )}
          </div>

          {/* Notifications */}
          <button className="relative p-1.5 sm:p-2 rounded-md text-slate-blue-300 hover:text-white hover:bg-navy-dark-elevated transition-colors shrink-0">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-navy-dark-border shrink-0">
            <div className="text-right hidden xs:block">
              <p className="text-xs sm:text-sm font-medium text-white max-w-[80px] sm:max-w-[130px] truncate">
                {userName || 'User'}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-blue-400 truncate max-w-[130px] hidden sm:block">
                {userEmail}
              </p>
            </div>
            <Avatar size="sm" fallback={initials} className="sm:hidden" />
            <Avatar size="md" fallback={initials} className="hidden sm:inline-flex" />
          </div>
        </div>
      </div>
    </header>
  );
}
