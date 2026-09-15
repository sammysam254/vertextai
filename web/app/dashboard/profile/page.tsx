import { Panel } from '@/components/ui/Panel';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ProfilePage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
        <p className="text-slate-blue-400">
          Manage your account information and preferences
        </p>
      </div>

      <Panel className="p-6">
        <div className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <Avatar size="xl" fallback="John Doe" />
            <div>
              <Button variant="secondary" size="sm">
                Change Photo
              </Button>
              <p className="text-xs text-slate-blue-500 mt-2">
                JPG, PNG or GIF. Max 2MB.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="First Name" defaultValue="John" />
              <Input label="Last Name" defaultValue="Doe" />
            </div>
            <Input
              label="Email"
              type="email"
              defaultValue="john.doe@company.com"
            />
            <Input label="Phone" type="tel" defaultValue="+1 555-0100" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-dark-border">
            <Button variant="secondary">Cancel</Button>
            <Button variant="primary">Save Changes</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
