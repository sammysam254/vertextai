'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Briefcase,
  BarChart3,
  Phone,
  MessageSquare,
  Users,
  UserCheck,
  Smartphone,
  Settings,
  HelpCircle,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Wallet,
  ShieldAlert,
} from 'lucide-react';
import { cn, getApiEndpoint } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/lib/context/OrganizationContext';

interface NavItemProps {
  href: string;
  icon: any;
  label: string;
  badge?: string;
  isActive?: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, badge, isActive, onClick }: NavItemProps) {
  return (
    <Link
      href={href as any}
      onClick={onClick}
      className={cn(
        'nav-item group relative overflow-hidden transition-all duration-200 active:scale-[0.98]',
        isActive
          ? 'nav-item-active font-semibold text-white bg-accent-primary/20 border-l-2 border-chart-cyan'
          : 'text-slate-blue-300 hover:text-white hover:bg-navy-dark-elevated'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
          isActive ? 'text-chart-cyan' : 'text-slate-blue-400 group-hover:text-chart-cyan'
        )}
      />
      <span className="flex-1 text-xs sm:text-sm">{label}</span>
      {isActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-chart-cyan shadow-[0_0_8px_#00D4FF] mr-1" />
      )}
      {badge && (
        <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0.5">
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
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { organizationId, user, isSuperAdmin } = useOrganization();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const isSuperAdminUser = Boolean(
    isSuperAdmin ||
    user?.email?.toLowerCase().includes('sammyseth260')
  );

  useEffect(() => {
    if (!organizationId) return;
    const fetchBalance = async () => {
      try {
        const res = await fetch(getApiEndpoint(`/api/v1/billing/wallet?organizationId=${organizationId}`));
        if (res.ok) {
          const data = await res.json();
          setWalletBalance(typeof data.balance === 'number' ? data.balance : 0);
        }
      } catch (e) {}
    };
    fetchBalance();
  }, [organizationId, pathname]);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-navy-dark-panel border-r border-navy-dark-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-navy-dark-border">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-chart-cyan/40 bg-[#0F1629] p-0.5 shadow-[0_0_12px_rgba(0,212,255,0.3)] shrink-0 group-hover:border-chart-cyan transition-colors">
            <Image
              src="/brand/icon.png"
              alt="Contact Centre Insights"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xs font-black text-white tracking-wider uppercase leading-tight">
              Contact Centre
            </h1>
            <span className="text-[10px] font-semibold text-chart-cyan tracking-widest uppercase">
              Insights
            </span>
          </div>
        </Link>
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
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/dashboard/workspace"
            icon={Briefcase}
            label="MY WORKSPACE"
            isActive={isActive('/dashboard/workspace')}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/dashboard/wallboards"
            icon={BarChart3}
            label="WALLBOARDS"
            badge="NEW"
            isActive={isActive('/dashboard/wallboards')}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/dashboard/billing"
            icon={Wallet}
            label="WALLET"
            badge={walletBalance !== null ? `$${walletBalance.toFixed(2)}` : undefined}
            isActive={isActive('/dashboard/billing')}
            onClick={() => setIsMobileOpen(false)}
          />
        </NavGroup>

        <div className="nav-separator" />

        <NavGroup label="COMMUNICATIONS">
          <NavItem
            href="/dashboard/calls"
            icon={Phone}
            label="CALLS"
            isActive={isActive('/dashboard/calls')}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/dashboard/inbox"
            icon={MessageSquare}
            label="INBOX"
            isActive={isActive('/dashboard/inbox')}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/dashboard/contacts"
            icon={Users}
            label="CONTACTS"
            isActive={isActive('/dashboard/contacts')}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/dashboard/dialer"
            icon={Smartphone}
            label="DIALER"
            isActive={isActive('/dashboard/dialer')}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/dashboard/agents"
            icon={UserCheck}
            label="AGENTS"
            isActive={isActive('/dashboard/agents')}
            onClick={() => setIsMobileOpen(false)}
          />
        </NavGroup>

        <div className="nav-separator" />

        <NavGroup label="CONFIGURATION">
          <ExpandableNavItem icon={Settings} label="SETTINGS">
            <Link
              href={'/dashboard/settings/phone' as any}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/phone') && 'text-accent-primary'
              )}
            >
              Phone &amp; Merchant Routing
            </Link>
            <Link
              href={'/dashboard/billing' as any}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors flex items-center justify-between',
                isActive('/dashboard/billing') && 'text-chart-cyan font-semibold'
              )}
            >
              <span>Billing &amp; Wallet</span>
              <span className="text-[10px] bg-chart-cyan/20 text-chart-cyan px-1.5 py-0.5 rounded font-mono">USD</span>
            </Link>
            <Link
              href="/dashboard/settings/ai"
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/ai') && 'text-accent-primary'
              )}
            >
              AI Configuration
            </Link>
            <Link
              href="/dashboard/settings/voice"
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/voice') && 'text-accent-primary'
              )}
            >
              Voice Models
            </Link>
            <Link
              href="/dashboard/settings/twilio"
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/twilio') && 'text-accent-primary'
              )}
            >
              Twilio Credentials
            </Link>
            <Link
              href="/dashboard/settings/escalation"
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'block px-3 py-2 text-sm text-slate-blue-300 hover:text-white rounded-md hover:bg-navy-dark-elevated transition-colors',
                isActive('/dashboard/settings/escalation') && 'text-accent-primary'
              )}
            >
              Escalation Rules
            </Link>
          </ExpandableNavItem>
        </NavGroup>

        {isSuperAdminUser && (
          <>
            <div className="nav-separator" />
            <NavGroup label="ADMINISTRATION">
              <NavItem
                href="/dashboard/admin/users"
                icon={ShieldAlert}
                label="USER MANAGEMENT"
                badge="SUPER"
                isActive={isActive('/dashboard/admin/users')}
                onClick={() => setIsMobileOpen(false)}
              />
            </NavGroup>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-navy-dark-border p-3 space-y-1">
        <NavItem
          href="/dashboard/help"
          icon={HelpCircle}
          label="HELP"
          isActive={isActive('/dashboard/help')}
          onClick={() => setIsMobileOpen(false)}
        />
        <NavItem
          href="/dashboard/profile"
          icon={User}
          label="PROFILE"
          isActive={isActive('/dashboard/profile')}
          onClick={() => setIsMobileOpen(false)}
        />
        <button 
          onClick={handleLogout}
          className="nav-item w-full text-left text-accent-danger hover:bg-accent-danger/10"
        >
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
        className="lg:hidden fixed top-[max(calc(env(safe-area-inset-top,0px)+2.15rem),2.15rem)] left-3 z-40 p-2 rounded-xl bg-navy-dark-panel/95 backdrop-blur-xl border border-navy-dark-border text-slate-blue-300 hover:text-white shadow-lg active:scale-95 transition-all focus:outline-none"
        aria-label="Open Navigation Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl"
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
