'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Briefcase,
  BarChart3,
  Phone,
  MessageSquare,
  Users,
  Smartphone,
  Settings,
  HelpCircle,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface NavItemProps {
  href: string;
  icon: any;
  label: string;
  badge?: string;
  isActive?: boolean;
}

function NavItem({ href, icon: Icon, label, badge, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'nav-item',
        isActive && 'nav-item-active'
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <Badge variant="default" className="ml-auto">
          {badge}
        </Badge>
      )}
    </Link>
  );
}

interface NavGroupProps {
  label?: string;
  children: React.ReactNode;
}

function NavGroup({ label, children }: NavGroupProps) {
  return (
    <div>
      {label && <div className="nav-group-label">{label}</div>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface ExpandableNavItemProps {
  icon: any;
  label: string;
  children: React.ReactNode;
}

function ExpandableNavItem({ icon: Icon, label, children }: ExpandableNavItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="nav-item w-full"
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && <div className="ml-7 mt-1 space-y-1">{children}</div>}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-navy-dark-panel border-r border-navy-dark-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-navy-dark-border">
        <div className="flex items-center gap-3">
          <Phone className="h-6 w-6 text-accent-primary" />
          <h1 className="text-lg font-bold text-white">CallPulse</h1>
        </div>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden text-slate-blue-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-6">
        <NavGroup>
          <NavItem
            href="/dashboard"
            icon={Home}
            label="HOME"
            isActive={isActive('/dashboard')}
          />
          <NavItem
            href="/dashboard/workspace"
            icon={Briefcase}
            label="MY WORKSPACE"
            isActive={isActive('/dashboard/workspace')}
          />
          <NavItem
            href="/dashboard/wallboards"
            icon={BarChart3}
            label="WALLBOARDS"
            badge="NEW"
            isActive={isActive('/dashboard/wallboards')}
          />
        </NavGroup>

        <div className="nav-separator" />

        <NavGroup label="COMMUNICATIONS">
          <NavItem
            href="/dashboard/calls"
            icon={Phone}
            label="CALLS"
            isActive={isActive('/dashboard/calls')}
          />
          <NavItem
            href="/dashboard/inbox"
            icon={MessageSquare}
            label="INBOX"
            isActive={isActive('/dashboard/inbox')}
          />
          <NavItem
            href="/dashboard/contacts"
            icon={Users}
            label="CONTACTS"
            isActive={isActive('/dashboard/contacts')}
          />
          <NavItem
            href="/dashboard/dialer"
            icon={Smartphone}
            label="DIALER"
            isActive={isActive('/dashboard/dialer')}
          />
        </NavGroup>

        <div className="nav-separator" />

        <NavGroup label="CONFIGURATION">
          <ExpandableNavItem icon={Settings} label="SETTINGS">
            <Link
              href="/dashboard/settings/ai"
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/ai') && 'text-accent-primary'
              )}
            >
              AI Configuration
            </Link>
            <Link
              href="/dashboard/settings/voice"
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/voice') && 'text-accent-primary'
              )}
            >
              Voice Models
            </Link>
            <Link
              href="/dashboard/settings/twilio"
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/twilio') && 'text-accent-primary'
              )}
            >
              Twilio Credentials
            </Link>
            <Link
              href="/dashboard/settings/escalation"
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/escalation') && 'text-accent-primary'
              )}
            >
              Escalation Rules
            </Link>
          </ExpandableNavItem>
        </NavGroup>
      </nav>

      {/* Footer */}
      <div className="border-t border-navy-dark-border p-3 space-y-1">
        <NavItem
          href="/dashboard/help"
          icon={HelpCircle}
          label="HELP"
          isActive={isActive('/dashboard/help')}
        />
        <NavItem
          href="/dashboard/profile"
          icon={User}
          label="PROFILE"
          isActive={isActive('/dashboard/profile')}
        />
        <button className="nav-item w-full text-left text-accent-danger hover:bg-accent-danger/10">
          <LogOut className="h-4 w-4" />
          <span>LOGOUT</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-md bg-navy-dark-panel border border-navy-dark-border text-slate-blue-300 hover:text-white"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-64"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0">
        {sidebarContent}
      </aside>
    </>
  );
}
