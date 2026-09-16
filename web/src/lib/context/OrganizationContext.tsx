'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface OrganizationContextType {
  organizationId: string | null;
  merchantCode: string;
  organizationName: string;
  role: string;
  user: any | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizationId: null,
  merchantCode: '',
  organizationName: '',
  role: 'owner',
  user: null,
  loading: true,
  refetch: async () => {},
});

export function OrganizationProvider({
  children,
  initialOrg,
}: {
  children: React.ReactNode;
  initialOrg?: {
    organizationId: string;
    merchantCode: string;
    organizationName: string;
    role: string;
  };
}) {
  const [organizationId, setOrganizationId] = useState<string | null>(initialOrg?.organizationId || null);
  const [merchantCode, setMerchantCode] = useState<string>(initialOrg?.merchantCode || '');
  const [organizationName, setOrganizationName] = useState<string>(initialOrg?.organizationName || '');
  const [role, setRole] = useState<string>(initialOrg?.role || 'owner');
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialOrg);

  const supabase = createClient();

  const getApiEndpoint = (path: string): string => {
    if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
      return `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${path}`;
    }
    return path;
  };

  const resolveOrg = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }
      setUser(authUser);

      // Check existing membership directly
      const { data: mem } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations ( id, name, metadata )')
        .eq('user_id', authUser.id)
        .limit(1)
        .maybeSingle();

      if (mem && mem.organization_id) {
        const org = (mem as any).organizations;
        const orgId = mem.organization_id;
        let hash = 0;
        for (let i = 0; i < orgId.length; i++) {
          hash = (hash * 31 + orgId.charCodeAt(i)) >>> 0;
        }
        const code = org?.metadata?.merchant_code || String(100000 + (hash % 900000));

        setOrganizationId(orgId);
        setOrganizationName(org?.name || 'My Call Center');
        setMerchantCode(code);
        setRole(mem.role || 'owner');
        setLoading(false);
        return;
      }

      // If no membership found, call backend resolve to auto-provision dedicated org
      try {
        const res = await fetch(getApiEndpoint('/api/v1/auth/resolve'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setOrganizationId(data.organizationId);
          setOrganizationName(data.organizationName);
          setMerchantCode(data.merchantCode);
          setRole(data.role);
        }
      } catch (err) {
        console.error('Failed to auto-resolve organization:', err);
      }
    } catch (e) {
      console.error('Error resolving organization:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    resolveOrg();
  }, [resolveOrg]);

  return (
    <OrganizationContext.Provider
      value={{
        organizationId,
        merchantCode,
        organizationName,
        role,
        user,
        loading,
        refetch: resolveOrg,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
