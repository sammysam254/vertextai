'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Wallet,
  Coins,
  CreditCard,
  Phone,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { TopUpModal } from '@/components/billing/TopUpModal';

interface Transaction {
  id: string;
  type: 'topup' | 'number_purchase' | 'call_usage' | 'refund';
  amount: number;
  currency: string;
  status: string;
  payment_gateway: string;
  payment_reference?: string;
  description: string;
  created_at: string;
}

export default function BillingPage() {
  const { organizationId, organizationName } = useOrganization();

  const [balance, setBalance] = useState<number>(0);
  const [freeMinutesUsed, setFreeMinutesUsed] = useState<number>(0);
  const [freeMinutesLimit, setFreeMinutesLimit] = useState<number>(3);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const getApiEndpoint = (path: string): string => {
    if (typeof window !== 'undefined') {
      if (process.env.NEXT_PUBLIC_API_URL) {
        return `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${path}`;
      }
      if (window.location.hostname.includes('vertext.site')) {
        return `https://vertext.site${path}`;
      }
    }
    return path;
  };

  const fetchWallet = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const res = await fetch(getApiEndpoint(`/api/v1/billing/wallet?organizationId=${organizationId}`));
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance || 0);
        setFreeMinutesUsed(data.monthlyFreeMinutesUsed || 0);
        setFreeMinutesLimit(data.monthlyFreeMinutesLimit || 3);
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const remainingFree = Math.max(0, freeMinutesLimit - freeMinutesUsed);
  const freeMinutesPercentage = Math.min(100, Math.round((freeMinutesUsed / freeMinutesLimit) * 100));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top-up Modal */}
      <TopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={(newBalance) => {
          setBalance(newBalance);
          fetchWallet();
        }}
      />

      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 flex items-center gap-2.5">
            <Wallet className="h-7 w-7 text-chart-cyan" />
            Billing &amp; In-App Wallet
          </h1>
          <p className="text-xs sm:text-sm text-slate-blue-400">
            Manage your account balance, monthly free minutes, payment methods, and usage history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchWallet}
            disabled={loading}
            className="text-slate-blue-300 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsTopUpOpen(true)}
            className="bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold text-xs shadow-lg shadow-accent-primary/20"
          >
            <Coins className="h-4 w-4 mr-1.5" />
            Top Up Wallet
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Wallet Balance Card */}
        <Panel className="p-5 bg-gradient-to-br from-navy-dark-elevated to-navy-dark border-accent-primary/30 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-blue-300">
              Available Balance
            </span>
            <Badge variant="resolved">USD Active</Badge>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-white">
              ${balance.toFixed(2)}
            </span>
            <span className="text-xs text-slate-blue-400 font-medium">USD</span>
          </div>

          <p className="text-xs text-slate-blue-400">
            Used for dedicated phone provisioning and real-time voice call minutes
          </p>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsTopUpOpen(true)}
            className="w-full bg-accent-primary/20 hover:bg-accent-primary/30 text-chart-cyan border-accent-primary/40 text-xs font-semibold h-9"
          >
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            Top Up via Card, M-Pesa or Crypto
          </Button>
        </Panel>

        {/* Monthly Free Minutes Card */}
        <Panel className="p-5 bg-navy-dark-panel border-navy-dark-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-blue-300">
              Monthly Free Minutes
            </span>
            <Badge variant={remainingFree > 0 ? 'resolved' : 'waiting'}>
              {remainingFree > 0 ? `${remainingFree}m Left` : 'Exhausted'}
            </Badge>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold text-chart-cyan">
              {freeMinutesUsed} / {freeMinutesLimit}
            </span>
            <span className="text-xs text-slate-blue-400 font-medium">mins used</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-navy-dark rounded-full overflow-hidden border border-navy-dark-border">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                freeMinutesPercentage >= 100
                  ? 'bg-accent-danger'
                  : freeMinutesPercentage > 60
                  ? 'bg-accent-warning'
                  : 'bg-accent-success'
              }`}
              style={{ width: `${freeMinutesPercentage}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-blue-400">
            Resets automatically on the 1st of every calendar month
          </p>
        </Panel>

        {/* Transparent Rates Card */}
        <Panel className="p-5 bg-navy-dark-panel border-navy-dark-border space-y-2.5 sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-blue-300">
            Transparent Pricing
          </span>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 bg-navy-dark rounded-lg border border-navy-dark-border">
              <span className="text-slate-blue-300">Dedicated Number:</span>
              <span className="font-mono text-white font-bold">$1.15 + $5.00 setup</span>
            </div>

            <div className="flex justify-between p-2 bg-navy-dark rounded-lg border border-navy-dark-border">
              <span className="text-slate-blue-300">Voice Usage:</span>
              <span className="font-mono text-chart-cyan font-bold">Twilio rate + 20%</span>
            </div>

            <div className="flex justify-between p-2 bg-navy-dark rounded-lg border border-navy-dark-border">
              <span className="text-slate-blue-300">Free Monthly:</span>
              <span className="text-accent-success font-semibold">First 3 mins free</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Transaction History Ledger */}
      <Panel className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-chart-cyan" />
              Wallet Transaction Ledger
            </h2>
            <p className="text-xs text-slate-blue-400">
              Detailed breakdown of top-ups, number purchases, and call minutes
            </p>
          </div>
          <span className="text-xs font-mono text-slate-blue-400">
            {transactions.length} record{transactions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-navy-dark-border rounded-xl space-y-2">
            <Wallet className="h-8 w-8 text-slate-blue-500 mx-auto" />
            <p className="text-xs text-slate-blue-400">No transactions recorded yet.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsTopUpOpen(true)}
              className="text-xs mt-2"
            >
              Top Up Your Wallet Now
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-navy-dark-border text-slate-blue-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Gateway</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-dark-border">
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-navy-dark-elevated transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-blue-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            tx.type === 'topup'
                              ? 'resolved'
                              : tx.type === 'number_purchase'
                              ? 'default'
                              : 'waiting'
                          }
                          className="capitalize text-[10px]"
                        >
                          {tx.type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-white max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-blue-300">
                        {tx.payment_gateway}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isPositive ? 'text-accent-success' : 'text-white'}>
                          {isPositive ? '+' : ''}${Math.abs(tx.amount).toFixed(2)} USD
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Badge
                          variant={tx.status === 'completed' ? 'resolved' : 'offline'}
                          className="text-[10px]"
                        >
                          {tx.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
