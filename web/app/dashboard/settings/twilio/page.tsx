import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Phone, CheckCircle, XCircle } from 'lucide-react';

export default function TwilioSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Phone className="h-8 w-8 text-chart-cyan" />
        <div>
          <h1 className="text-3xl font-bold text-white">Twilio Credentials</h1>
          <p className="text-slate-blue-400 mt-1">
            Connect your Twilio account
          </p>
        </div>
      </div>

      <Panel className="p-6 space-y-6">
        <Input
          label="Account SID"
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          helperText="Found in your Twilio Console dashboard"
        />

        <Input
          label="Auth Token"
          type="password"
          placeholder="••••••••••••••••••••••••••••••••"
          helperText="Keep this secret and secure"
        />

        <Input
          label="Phone Number"
          type="tel"
          placeholder="+1 555-0000"
          helperText="Your Twilio phone number in E.164 format"
        />

        <div className="flex items-center justify-between p-4 bg-navy-dark-elevated rounded-md">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-accent-success" />
            <span className="text-sm text-white">Connection Status</span>
          </div>
          <span className="text-sm text-accent-success font-medium">Connected</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-dark-border">
          <Button variant="secondary">Test Connection</Button>
          <Button variant="primary">Save Credentials</Button>
        </div>
      </Panel>
    </div>
  );
}
