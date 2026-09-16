'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, CheckCircle2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSplash } from '@/components/ui/LoadingSplash';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Show full-screen cyber workspace loading animation before navigating
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-dark flex items-center justify-center px-4">
      {/* Full screen cyber loading animation taking over the whole screen */}
      {isSuccess && <LoadingSplash persist={true} />}

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center gap-3 mb-3">
            <div className="w-16 h-16 rounded-2xl bg-[#0F1629] border border-cyan-500/40 p-2 shadow-[0_0_30px_rgba(0,212,255,0.3)] flex items-center justify-center">
              <Image
                src="/brand/icon.png"
                alt="Contact Centre Insights"
                width={56}
                height={56}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
              Contact Centre Insights
            </h1>
          </div>
          <p className="text-sm text-slate-blue-400">
            Sign in to your AI voice and call operations platform
          </p>
        </div>

        {/* Login Form */}
        <div className="panel p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-accent-danger/10 border border-accent-danger/20 rounded-md p-3">
                  <p className="text-sm text-accent-danger">{error}</p>
                </div>
              )}

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={isLoading}
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                loadingText="Authenticating..."
                disabled={isLoading}
              >
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-blue-400">
                Don't have an account?{' '}
                <Link
                  href="/signup"
                  className="text-accent-primary hover:underline font-medium"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-blue-500 mt-6">
          Protected by Supabase Auth
        </p>
      </div>
    </div>
  );
}
