'use client';

import { Bell, Search } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

export function DashboardHeader() {
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
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent-danger rounded-full" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-navy-dark-border">
            <div className="text-right">
              <p className="text-sm font-medium text-white">John Doe</p>
              <p className="text-xs text-slate-blue-400">Admin</p>
            </div>
            <Avatar size="md" fallback="John Doe" />
          </div>
        </div>
      </div>

      {/* Active Calls Banner (optional) */}
      <div className="px-6 py-2 bg-status-in-call/10 border-t border-status-in-call/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="in-call" dot>
              IN CALL
            </Badge>
            <span className="text-slate-blue-300">
              3 active calls • 2 waiting
            </span>
          </div>
          <button className="text-sm text-accent-primary hover:underline">
            View All
          </button>
        </div>
      </div>
    </header>
  );
}
