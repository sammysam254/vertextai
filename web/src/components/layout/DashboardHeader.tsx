'use client';

import { Bell, Search } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function DashboardHeader() {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata;
        const name =
          meta?.full_name ||
          meta?.name ||
          data.user.email?.split('@')[0] ||
          'User';
        setUserName(name);
        setUserEmail(data.user.email || '');
      }
    });
  }, []);

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
