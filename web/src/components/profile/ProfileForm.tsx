'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';

interface ProfileFormProps {
  initialEmail: string;
  initialFullName: string;
  initialPhone: string;
  orgName: string | null;
  orgRole: string | null;
}

export function ProfileForm({
  initialEmail,
  initialFullName,
  initialPhone,
  orgName,
  orgRole,
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone]       = useState(initialPhone);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : initialEmail.slice(0, 2).toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone },
      });
      if (updateErr) throw updateErr;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="p-6">
      <div className="space-y-6">
        {/* Avatar + org badge */}
        <div className="flex items-center gap-5">
          <Avatar size="xl" fallback={initials} />
          <div>
            <p className="text-white font-semibold text-lg">
              {fullName || initialEmail}
            </p>
            <p className="text-slate-blue-400 text-sm">{initialEmail}</p>
            {orgName && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-blue-500 text-xs">{orgName}</span>
                {orgRole && (
                  <Badge variant="default" className="text-xs py-0">
                    {orgRole.toUpperCase()}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Success / error feedback */}
        {saved && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-status-available/10 border border-status-available/30">
            <CheckCircle className="h-4 w-4 text-status-available" />
            <p className="text-status-available text-sm">Profile saved</p>
          </div>
        )}
        {error && (
          <div className="bg-accent-danger/10 border border-accent-danger/20 rounded-md p-3">
            <p className="text-sm text-accent-danger">{error}</p>
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            disabled={saving}
          />
          <Input
            label="Email"
            type="email"
            value={initialEmail}
            disabled
            helperText="Email cannot be changed here"
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555-0100"
            disabled={saving}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-dark-border">
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={saving}
            disabled={saving}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Panel>
  );
}
