'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            organization_name: organizationName,
          },
        },
      });

      if (authError) throw authError;

      // Create organization with Twilio phone from environment
      if (authData.user) {
        const { error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: organizationName,
            twilio_phone_number: process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708',
          });

        if (orgError) throw orgError;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Phone className="h-10 w-10 text-accent-primary" />
            <h1 className="text-3xl font-bold text-white">CallPulse</h1>
          </div>
          <p className="text-slate-blue-400">
            Create your call center workspace
          </p>
        </div>

        {/* Signup Form */}
        <div className="panel p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-accent-danger/10 border border-accent-danger/20 rounded-md p-3">
                <p className="text-sm text-accent-danger">{error}</p>
              </div>
            )}

            <Input
              label="Organization Name"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Corp"
              required
              disabled={isLoading}
            />

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
              helperText="Minimum 6 characters"
              required
              minLength={6}
              disabled={isLoading}
            />

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-blue-400">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-accent-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-blue-500 mt-6">
          By signing up, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
