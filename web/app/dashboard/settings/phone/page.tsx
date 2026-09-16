'use client';

import { useState, useEffect } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Phone, Hash, Globe, ShieldCheck, Check, Copy, ExternalLink, Search, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

import { useOrganization } from '@/lib/context/OrganizationContext';

export default function PhoneSettingsPage() {
  const { merchantCode: contextCode, organizationId, organizationName } = useOrganization();
  const [merchantCode, setMerchantCode] = useState(contextCode || '100001');
  const [copied, setCopied] = useState(false);
  const [searchCountry, setSearchCountry] = useState('US');
  const [areaCode, setAreaCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);

  const twilioPhone = process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708';

  useEffect(() => {
    if (contextCode) {
      setMerchantCode(contextCode);
    }
  }, [contextCode]);

  const copyCode = () => {
    navigator.clipboard.writeText(merchantCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSearchNumbers = () => {
    setIsSearching(true);
    // Simulate available number lookup
    setTimeout(() => {
      const prefix = areaCode ? `+1${areaCode}` : '+1251';
      setAvailableNumbers([
        `${prefix}${Math.floor(1000000 + Math.random() * 9000000)}`,
        `${prefix}${Math.floor(1000000 + Math.random() * 9000000)}`,
        `${prefix}${Math.floor(1000000 + Math.random() * 9000000)}`,
      ]);
      setIsSearching(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Phone Number & Merchant Routing</h1>
        <p className="text-slate-blue-400">
          Manage your call center line, 6-digit merchant routing code, and dedicated Twilio numbers
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Phone Plan / Shared Number */}
        <Panel className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Phone className="h-5 w-5 text-chart-cyan" />
              Your Active Call Center Line
            </h2>
            <Badge variant="resolved">Active</Badge>
          </div>

          <div className="p-4 bg-navy-dark-elevated border border-navy-dark-border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-blue-300">Shared Twilio Number:</span>
              <span className="font-mono text-white text-base font-semibold">{twilioPhone}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-navy-dark-border">
              <span className="text-sm text-slate-blue-300">Your 6-Digit Merchant ID:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-bold text-chart-cyan tracking-wider">
                  {merchantCode}
                </span>
                <button
                  onClick={copyCode}
                  className="p-1.5 hover:bg-navy-dark rounded text-slate-blue-400 hover:text-white transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-accent-success" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-blue-300">
            <h3 className="font-medium text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-accent-success" />
              How Inbound Routing Works:
            </h3>
            <p>
              1. Customers call <span className="font-mono text-white">{twilioPhone}</span>.
            </p>
            <p>
              2. The AI greets them and prompts: <span className="italic text-slate-blue-200">"Please enter your 6-digit merchant ID."</span>
            </p>
            <p>
              3. Once they type <span className="font-mono text-white">{merchantCode}</span>, the call is routed exclusively to your dashboard queue with hold music while you or your agents answer and transfer!
            </p>
          </div>
        </Panel>

        {/* Dedicated Twilio Number Provisioning */}
        <Panel className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-primary" />
              Get a Dedicated Twilio Number
            </h2>
            <Badge variant="waiting">Optional Upgrade</Badge>
          </div>

          <p className="text-sm text-slate-blue-300">
            Prefer not to use a 6-digit code? You can provision a dedicated phone number directly connected to your company.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-blue-300 mb-1">Country</label>
                <select
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  className="input !h-10 text-sm w-full"
                >
                  <option value="US">United States (+1)</option>
                  <option value="KE">Kenya (+254)</option>
                  <option value="GB">United Kingdom (+44)</option>
                  <option value="CA">Canada (+1)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-blue-300 mb-1">Area Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 251, 206, 706"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value)}
                  className="input !h-10 text-sm w-full"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleSearchNumbers}
              disabled={isSearching}
            >
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? 'Searching Twilio...' : 'Find Available Numbers'}
            </Button>
          </div>

          {availableNumbers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-navy-dark-border">
              <p className="text-xs font-semibold text-slate-blue-300 uppercase tracking-wider">
                Available Phone Numbers:
              </p>
              {availableNumbers.map((num) => (
                <div
                  key={num}
                  className="flex items-center justify-between p-2.5 bg-navy-dark-elevated rounded-md border border-navy-dark-border"
                >
                  <span className="font-mono text-sm text-white">{num}</span>
                  <Button variant="primary" size="sm">
                    Provision Number
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
