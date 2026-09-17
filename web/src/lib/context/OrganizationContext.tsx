'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getApiEndpoint } from '@/lib/utils';

export interface OrganizationContextType {
  organizationId: string | null;
  merchantCode: string;
  organizationName: string;
  twilioPhoneNumber: string;
  isDedicatedNumber: boolean;
  role: string;
  user: any | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isBlocked: boolean;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizationId: null,
  merchantCode: '',
  organizationName: '',
  twilioPhoneNumber: '+12513571708',
  isDedicatedNumber: false,
  role: 'owner',
  user: null,
  loading: true,
  isSuperAdmin: false,
  isBlocked: false,
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
    twilioPhoneNumber?: string;
    isDedicatedNumber?: boolean;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [organizationId, setOrganizationId] = useState<string | null>(initialOrg?.organizationId || null);
  const [merchantCode, setMerchantCode] = useState<string>(initialOrg?.merchantCode || '');
  const [organizationName, setOrganizationName] = useState<string>(initialOrg?.organizationName || '');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState<string>(initialOrg?.twilioPhoneNumber || '+12513571708');
  const [isDedicatedNumber, setIsDedicatedNumber] = useState<boolean>(initialOrg?.isDedicatedNumber || false);
  const [role, setRole] = useState<string>(initialOrg?.role || 'owner');
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialOrg);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  const supabase = createClient();

  const resolveOrg = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }
      setUser(authUser);

      const isSuper = Boolean(
        authUser.email?.toLowerCase().includes('sammyseth260') ||
        authUser.app_metadata?.role === 'super_admin' ||
        authUser.user_metadata?.is_super_admin === true ||
        authUser.user_metadata?.role === 'super_admin'
      );
      setIsSuperAdmin(isSuper);

      // Check existing membership directly
      const { data: mem } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations ( id, name, metadata, twilio_phone_number, is_blocked )')
        .eq('user_id', authUser.id)
        .limit(1)
        .maybeSingle();

      if (mem && mem.organization_id) {
        const org = (mem as any).organizations;
        const orgId = mem.organization_id;

        // Check if blocked
        const blocked = Boolean(
          authUser.app_metadata?.is_blocked === true ||
          authUser.user_metadata?.is_blocked === true ||
          org?.is_blocked === true ||
          org?.metadata?.is_blocked === true
        );
        setIsBlocked(blocked);

        if (blocked && pathname && !pathname.includes('/suspended') && !pathname.includes('/login')) {
          router.push('/suspended');
          setLoading(false);
          return;
        }
        
        let code = org?.metadata?.merchant_code ? String(org.metadata.merchant_code) : '';
        
        if (!code) {
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
              if (data.merchantCode) code = data.merchantCode;
            }
          } catch (e) {}
        }

        if (!code) {
          let hash = 0;
          for (let i = 0; i < orgId.length; i++) {
            hash = (hash * 31 + orgId.charCodeAt(i)) >>> 0;
          }
          code = String(100000 + (hash % 900000));
        }

        const phone = org?.twilio_phone_number || '+12513571708';
        const isDedicated = Boolean(phone !== '+12513571708' || org?.metadata?.dedicated_number);

        setOrganizationId(orgId);
        setOrganizationName(org?.name || 'My Call Center');
        setMerchantCode(code);
        setTwilioPhoneNumber(phone);
        setIsDedicatedNumber(isDedicated);
        setRole(isSuper ? 'super_admin' : (mem.role || 'owner'));
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
          setRole(isSuper ? 'super_admin' : data.role);
          if (data.twilioPhoneNumber) setTwilioPhoneNumber(data.twilioPhoneNumber);
          if (data.isDedicatedNumber !== undefined) setIsDedicatedNumber(data.isDedicatedNumber);
        }
      } catch (err) {
        console.error('Failed to auto-resolve organization:', err);
      }
    } catch (e) {
      console.error('Error resolving organization:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase, pathname, router]);

  useEffect(() => {
    resolveOrg();
  }, [resolveOrg]);

  return (
    <OrganizationContext.Provider
      value={{
        organizationId,
        merchantCode,
        organizationName,
        twilioPhoneNumber,
        isDedicatedNumber,
        role,
        user,
        loading,
        isSuperAdmin,
        isBlocked,
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
