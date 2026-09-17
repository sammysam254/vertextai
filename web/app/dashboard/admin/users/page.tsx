'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Users,
  Search,
  RefreshCw,
  Ban,
  CheckCircle,
  AlertTriangle,
  Wallet,
  Building2,
  Phone,
  ShieldCheck,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { getApiEndpoint } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  isSuperAdmin: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  organization: {
    id: string;
    name: string;
    merchantCode: string;
    walletBalance: number;
    twilioPhoneNumber: string;
    subscriptionTier: string;
    isBlocked: boolean;
  } | null;
}

export default function SuperAdminUsersPage() {
  const { user, isSuperAdmin } = useOrganization();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isResettingBalances, setIsResettingBalances] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiEndpoint('/api/v1/admin/users'), {
        headers: {
          'x-user-email': user?.email || 'sammyseth260@gmail.com',
          'x-admin-key': 'sammyseth260_superadmin_secret',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load user roster');
      }

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      console.error('Error fetching admin users:', err);
      showToast(err.message || 'Failed to fetch registered users', 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Block / Suspend User
  const handleBlockUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to SUSPEND ${userEmail}? They will be logged out and cannot make calls.`)) {
      return;
    }

    setActionLoadingId(userId);
    try {
      const res = await fetch(getApiEndpoint(`/api/v1/admin/users/${userId}/block`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || 'sammyseth260@gmail.com',
          'x-admin-key': 'sammyseth260_superadmin_secret',
        },
        body: JSON.stringify({ reason: 'Suspended by Super Administrator' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to suspend user');

      showToast(`User ${userEmail} has been suspended`, 'success');
      // Update local state immediately
      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
                ...u,
                isBlocked: true,
                blockedReason: 'Suspended by Super Administrator',
                organization: u.organization ? { ...u.organization, isBlocked: true } : null,
              }
            : u
        )
      );
    } catch (err: any) {
      showToast(err.message || 'Error suspending user', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Unblock / Reactivate User
  const handleUnblockUser = async (userId: string, userEmail: string) => {
    setActionLoadingId(userId);
    try {
      const res = await fetch(getApiEndpoint(`/api/v1/admin/users/${userId}/unblock`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || 'sammyseth260@gmail.com',
          'x-admin-key': 'sammyseth260_superadmin_secret',
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reactivate user');

      showToast(`User ${userEmail} has been reactivated`, 'success');
      // Update local state immediately
      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
                ...u,
                isBlocked: false,
                blockedReason: undefined,
                organization: u.organization ? { ...u.organization, isBlocked: false } : null,
              }
            : u
        )
      );
    } catch (err: any) {
      showToast(err.message || 'Error reactivating user', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reset all wallet balances across platform
  const handleResetAllBalances = async () => {
    if (!confirm('⚠️ DANGER: Reset ALL users and organizations wallet balances to $0.00 right now? This cannot be undone.')) {
      return;
    }

    setIsResettingBalances(true);
    try {
      const res = await fetch(getApiEndpoint('/api/v1/admin/wallets/reset-all'), {
        method: 'POST',
        headers: {
          'x-user-email': user?.email || 'sammyseth260@gmail.com',
          'x-admin-key': 'sammyseth260_superadmin_secret',
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset balances');

      showToast(data.message || 'All organization wallet balances have been reset to $0.00', 'success');
      // Update local balances
      setUsers(prev =>
        prev.map(u => ({
          ...u,
          organization: u.organization ? { ...u.organization, walletBalance: 0.00 } : null,
        }))
      );
    } catch (err: any) {
      showToast(err.message || 'Error resetting balances', 'error');
    } finally {
      setIsResettingBalances(false);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.organization?.name && u.organization.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.organization?.merchantCode && u.organization.merchantCode.includes(searchQuery));

    if (!matchesSearch) return false;

    if (statusFilter === 'active') return !u.isBlocked;
    if (statusFilter === 'suspended') return u.isBlocked;
    return true;
  });

  const totalUsersCount = users.length;
  const suspendedCount = users.filter(u => u.isBlocked).length;
  const activeCount = totalUsersCount - suspendedCount;
  const totalPlatformBalance = users.reduce((acc, u) => acc + (u.organization?.walletBalance || 0), 0);

  // Check super admin authorization
  const isSuper = Boolean(
    isSuperAdmin ||
    user?.email?.toLowerCase().includes('sammyseth260')
  );

  if (!isSuper && !loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0F1629] border border-rose-500/30 rounded-2xl p-8 text-center backdrop-blur-xl">
          <Lock className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white uppercase mb-2">Access Denied</h2>
          <p className="text-sm text-slate-400 mb-6">
            Super Administrator permissions are required to access user moderation and platform controls.
          </p>
          <p className="text-xs font-mono text-cyan-400">Authenticated user: {user?.email || 'Guest'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Super Admin Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
              Super Admin Portal
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              Restricted Area
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Moderate registered accounts, toggle system suspensions, and control platform wallet balances.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleResetAllBalances}
            disabled={isResettingBalances}
            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-[0_0_20px_rgba(225,29,72,0.4)] border border-rose-400/30 flex items-center gap-2"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResettingBalances ? 'animate-spin' : ''}`} />
            {isResettingBalances ? 'Resetting Balances...' : 'Reset All Wallets to $0.00'}
          </Button>

          <Button
            onClick={loadUsers}
            disabled={loading}
            variant="secondary"
            className="text-xs py-2 px-3 border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel p-5 bg-[#0F1629]/80 border border-cyan-500/20 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Total Users</p>
              <h3 className="text-2xl font-black text-white mt-1">{totalUsersCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="panel p-5 bg-[#0F1629]/80 border border-emerald-500/20 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Active Accounts</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="panel p-5 bg-[#0F1629]/80 border border-rose-500/20 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Suspended Users</p>
              <h3 className="text-2xl font-black text-rose-400 mt-1">{suspendedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Ban className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="panel p-5 bg-[#0F1629]/80 border border-amber-500/20 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Platform Balances</p>
              <h3 className="text-2xl font-black text-amber-400 mt-1">${totalPlatformBalance.toFixed(2)}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="panel p-4 bg-[#0F1629]/90 border border-white/5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search email, name, merchant code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#070B14] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                : 'text-slate-400 hover:text-white bg-slate-800/40'
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'text-slate-400 hover:text-white bg-slate-800/40'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('suspended')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'suspended'
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                : 'text-slate-400 hover:text-white bg-slate-800/40'
            }`}
          >
            Suspended ({suspendedCount})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="panel bg-[#0F1629]/90 border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070B14] border-b border-white/5 text-slate-400 font-mono uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">User Profile</th>
                <th className="px-5 py-3.5">Organization & Code</th>
                <th className="px-5 py-3.5">Phone Number</th>
                <th className="px-5 py-3.5">Wallet Balance</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Moderation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading registered users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No users found matching your query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(item => {
                  const isSuspended = item.isBlocked;
                  const isItemSuper = item.isSuperAdmin || item.email.toLowerCase().includes('sammyseth260');

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isSuspended ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* User Profile */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-slate-300 uppercase">
                            {item.email.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{item.name}</span>
                              {isItemSuper && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-black">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 font-mono text-[11px]">{item.email}</p>
                            <p className="text-[10px] text-slate-600 font-mono">{item.id.slice(0, 13)}...</p>
                          </div>
                        </div>
                      </td>

                      {/* Organization & Code */}
                      <td className="px-5 py-4">
                        {item.organization ? (
                          <div>
                            <p className="font-medium text-slate-200 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              {item.organization.name}
                            </p>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-cyan-300 font-bold">
                              Code: {item.organization.merchantCode}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No Organization</span>
                        )}
                      </td>

                      {/* Phone Number */}
                      <td className="px-5 py-4">
                        {item.organization?.twilioPhoneNumber ? (
                          <span className="font-mono text-slate-300 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.organization.twilioPhoneNumber}
                          </span>
                        ) : (
                          <span className="text-slate-600">Default (+12513571708)</span>
                        )}
                      </td>

                      {/* Wallet Balance */}
                      <td className="px-5 py-4">
                        <span
                          className={`font-mono font-bold text-sm ${
                            (item.organization?.walletBalance || 0) > 0
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          ${(item.organization?.walletBalance || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {isSuspended ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-semibold">
                            <Ban className="w-3 h-3" />
                            <span>SUSPENDED</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            <span>ACTIVE</span>
                          </div>
                        )}
                      </td>

                      {/* Moderation Action Button */}
                      <td className="px-5 py-4 text-right">
                        {isItemSuper ? (
                          <span className="text-[11px] text-slate-500 font-mono">Protected (Super Admin)</span>
                        ) : isSuspended ? (
                          <Button
                            onClick={() => handleUnblockUser(item.id, item.email)}
                            disabled={actionLoadingId === item.id}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-1.5 px-3 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)] inline-flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {actionLoadingId === item.id ? 'Reactivating...' : 'Reactivate / Unblock'}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleBlockUser(item.id, item.email)}
                            disabled={actionLoadingId === item.id}
                            className="bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 font-medium text-xs py-1.5 px-3 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-400" />
                            {actionLoadingId === item.id ? 'Suspending...' : 'Suspend / Block'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
