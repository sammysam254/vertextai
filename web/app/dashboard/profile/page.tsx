import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/profile/ProfileForm';

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Resolve org membership for display
  let orgName: string | null = null;
  let orgRole: string | null = null;

  if (user) {
    const { data } = await supabase
      .from('organization_members')
      .select('role, organizations ( name )')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    orgRole = data?.role ?? null;
    orgName = (data?.organizations as any)?.name ?? null;
  }

  const meta = user?.user_metadata ?? {};
  const email = user?.email ?? '';
  const fullName: string = meta.full_name ?? meta.name ?? '';
  const phone: string = meta.phone ?? '';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
        <p className="text-slate-blue-400">Your account details</p>
      </div>

      <ProfileForm
        initialEmail={email}
        initialFullName={fullName}
        initialPhone={phone}
        orgName={orgName}
        orgRole={orgRole}
      />
    </div>
  );
}
