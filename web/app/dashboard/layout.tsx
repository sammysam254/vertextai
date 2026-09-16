import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { OrganizationProvider } from '@/lib/context/OrganizationContext';
import { IncomingCallBar } from '@/components/calls/IncomingCallBar';
import { RouteProgressBar } from '@/components/layout/RouteProgressBar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Resolve user organization server-side
  let initialOrg: any = null;
  try {
    const { data: mem } = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations ( id, name, metadata, twilio_phone_number )')
      .eq('user_id', user.id)
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
      const phone = org?.twilio_phone_number || '+12513571708';
      const isDedicated = Boolean(phone !== '+12513571708' || org?.metadata?.dedicated_number);

      initialOrg = {
        organizationId: orgId,
        merchantCode: code,
        organizationName: org?.name || 'My Call Center',
        role: mem.role || 'owner',
        twilioPhoneNumber: phone,
        isDedicatedNumber: isDedicated,
      };
    }
  } catch (e) {
    console.error('Error resolving user org in layout:', e);
  }

  return (
    <OrganizationProvider initialOrg={initialOrg}>
      <RouteProgressBar />
      <div className="flex h-screen overflow-hidden bg-navy-dark relative">
        {/* Global WebRTC Incoming Call Bar */}
        <IncomingCallBar />

        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <DashboardHeader />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 animate-fadeIn">
            {children}
          </main>
        </div>
      </div>
    </OrganizationProvider>
  );
}
