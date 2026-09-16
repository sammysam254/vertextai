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
      <div className="flex items-center justify-between px-6 py-4">
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-blue-500" />
            <input
              type="search"
              placeholder="Search calls, contacts, or messages..."
              className="w-full pl-10 pr-4 py-2 bg-navy-dark-elevated border border-navy-dark-border rounded-md text-sm text-slate-blue-100 placeholder:text-slate-blue-500 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Active Call Live Indicator */}
          {activeCallCount > 0 && (
            <Link
              href="/dashboard/calls"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-success/20 border border-accent-success/40 text-accent-success text-xs font-semibold animate-pulse"
            >
              <PhoneIncoming className="h-3.5 w-3.5" />
              <span>{activeCallCount} Active Call{activeCallCount > 1 ? 's' : ''}</span>
            </Link>
          )}

          {/* 6-Digit Merchant Code Badge */}
          <div
            onClick={copyMerchantCode}
            title="Callers to +1 (251) 357-1708 can dial this 6-digit merchant code to reach your dashboard"
            className="flex items-center gap-2 px-3 py-1.5 bg-navy-dark-elevated hover:bg-navy-dark-elevated/80 border border-chart-cyan/30 hover:border-chart-cyan rounded-lg cursor-pointer transition-colors text-xs"
          >
            <Hash className="h-3.5 w-3.5 text-chart-cyan" />
            <span className="text-slate-blue-300 font-medium">Merchant ID:</span>
            <span className="font-mono font-bold text-white tracking-widest">{merchantCode}</span>
            {copied ? (
              <Check className="h-3 w-3 text-accent-success ml-1" />
            ) : (
              <Copy className="h-3 w-3 text-slate-blue-400 hover:text-white ml-1" />
            )}
          </div>

          {/* Notifications */}
          <button className="relative p-2 rounded-md text-slate-blue-300 hover:text-white hover:bg-navy-dark-elevated transition-colors">
            <Bell className="h-5 w-5" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-navy-dark-border">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{userName || '...'}</p>
              <p className="text-xs text-slate-blue-400 truncate max-w-[140px]">{userEmail}</p>
            </div>
            <Avatar size="md" fallback={initials} />
          </div>
        </div>
      </div>
    </header>
  );
}
