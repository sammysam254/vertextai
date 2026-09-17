'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogOut, Mail, RefreshCw, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export default function SuspendedPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }
      } catch (err) {
        console.error('Error fetching auth user:', err);
      } finally {
        setLoading(false);
      }
    }
    checkUser();
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Sign out error:', err);
      router.push('/login');
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Check organization membership block status
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id, organizations ( is_blocked, metadata )')
        .eq('user_id', user.id)
        .maybeSingle();

      const org = (membership as any)?.organizations;
      const isBlocked = Boolean(
        user.app_metadata?.is_blocked === true ||
        user.user_metadata?.is_blocked === true ||
        org?.is_blocked === true ||
        org?.metadata?.is_blocked === true
      );

      if (!isBlocked) {
        // Unblocked! Redirect back to dashboard
        router.push('/dashboard');
        return;
      }
    } catch (e) {
      console.error('Error rechecking status:', e);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg bg-[#0F1629]/90 border border-rose-500/30 rounded-2xl p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(244,63,94,0.15)] text-center">
        {/* Warning Icon Badge */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center mb-6 shadow-[0_0_25px_rgba(244,63,94,0.3)] animate-pulse">
          <ShieldAlert className="w-10 h-10 text-rose-400" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider mb-2">
          Account Suspended
        </h1>
        <p className="text-rose-400 font-mono text-sm tracking-wide mb-6 uppercase">
          Access Restricted by System Administration
        </p>

        {/* Informational Card */}
        <div className="bg-[#0B1120] border border-white/5 rounded-xl p-5 mb-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">
              Your account or organization has been suspended. During this suspension:
            </p>
          </div>

          <ul className="text-xs text-slate-400 space-y-2 pl-8 list-disc font-sans">
            <li><strong className="text-slate-200">Voice Calling Disabled:</strong> Inbound and outbound browser/dialer calls cannot be placed.</li>
            <li><strong className="text-slate-200">Workspace Locked:</strong> Workspace tools, communications, and settings are inaccessible.</li>
            <li><strong className="text-slate-200">Wallet Operations Halted:</strong> Automated transactions and balances are placed on hold.</li>
          </ul>

          {userEmail && (
            <div className="pt-2 border-t border-white/5 text-xs text-slate-400 flex items-center justify-between">
              <span>Account Email:</span>
              <span className="font-mono text-cyan-400 font-semibold">{userEmail}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking Status...' : 'Check If Reactivated'}
          </Button>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <a
              href="mailto:support@vertext.site?subject=Account%20Suspension%20Appeal"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700/60 transition-colors"
            >
              <Mail className="w-4 h-4 text-cyan-400" />
              Contact Support
            </a>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-sm font-medium border border-rose-800/40 transition-colors"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
