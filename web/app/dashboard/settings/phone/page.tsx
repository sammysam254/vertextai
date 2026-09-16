'use client';

import React, { useState, useEffect } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Phone,
  Hash,
  Globe,
  ShieldCheck,
  Check,
  Copy,
  Search,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  CheckCircle,
  ExternalLink,
  PhoneCall,
} from 'lucide-react';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { formatPhoneNumber } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface AvailableNumberItem {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
}

export default function PhoneSettingsPage() {
  const {
    merchantCode,
    organizationId,
    organizationName,
    twilioPhoneNumber,
    isDedicatedNumber,
    refetch,
    loading: orgLoading,
  } = useOrganization();

  const [copied, setCopied] = useState(false);
  const activePhoneNumber = twilioPhoneNumber || '+12513571708';

  // Search state
  const [searchCountry, setSearchCountry] = useState('US');
  const [areaCode, setAreaCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumberItem[]>([]);
  const [searchError, setSearchError] = useState('');

  // Provision state
  const [provisioningNumber, setProvisioningNumber] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState('');
  const [provisionError, setProvisionError] = useState('');

  // Forwarding / Escalation Phone
  const [escalationPhone, setEscalationPhone] = useState('+254706499848');
  const [savingEscalation, setSavingEscalation] = useState(false);
  const [escalationSaved, setEscalationSaved] = useState(false);

  const supabase = createClient();

  const getApiEndpoint = (path: string): string => {
    if (typeof window !== 'undefined') {
      if (process.env.NEXT_PUBLIC_API_URL) {
        return `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${path}`;
      }
      if (window.location.hostname.includes('vertext.site')) {
        return `https://vertext.site${path}`;
      }
    }
    return path;
  };

  // Load current escalation phone
  useEffect(() => {
    async function loadOrgEscalation() {
      if (!organizationId) return;
      try {
        const { data: org } = await supabase
          .from('organizations')
          .select('escalation_phone_number')
          .eq('id', organizationId)
          .maybeSingle();

        if (org?.escalation_phone_number) {
          setEscalationPhone(org.escalation_phone_number);
        }
      } catch (e) {}
    }
    loadOrgEscalation();
  }, [organizationId, supabase]);

  const copyCode = () => {
    if (merchantCode) {
      navigator.clipboard.writeText(merchantCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Real Twilio Available Phone Numbers Search
  const handleSearchNumbers = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setSearchError('');
    setProvisionSuccess('');
    setProvisionError('');

    try {
      const queryParams = new URLSearchParams({
        country: searchCountry,
        ...(areaCode.trim() ? { areaCode: areaCode.trim() } : {}),
      });

      const res = await fetch(getApiEndpoint(`/api/v1/phone/search?${queryParams.toString()}`));
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to search available numbers');
      }

      if (data.numbers && data.numbers.length > 0) {
        setAvailableNumbers(data.numbers);
      } else {
        setAvailableNumbers([]);
        setSearchError('No available numbers found with that criteria. Try another area code or country.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Failed to search numbers. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Real Twilio Number Provisioning
  const handleProvisionNumber = async (numberToBuy: string) => {
    if (!organizationId) {
      setProvisionError('Organization not resolved. Please refresh.');
      return;
    }

    const confirmed = window.confirm(
      `Purchase and configure ${numberToBuy} as your dedicated business phone line? Inbound calls will ring directly to your dashboard.`
    );
    if (!confirmed) return;

    setProvisioningNumber(numberToBuy);
    setProvisionError('');
    setProvisionSuccess('');

    try {
      const res = await fetch(getApiEndpoint('/api/v1/phone/provision'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: numberToBuy,
          organizationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to provision number');
      }

      setProvisionSuccess(
        `Successfully purchased and configured ${numberToBuy} as your dedicated business line! Inbound calls now route directly to your dashboard.`
      );
      setAvailableNumbers((prev) => prev.filter((n) => n.phoneNumber !== numberToBuy));

      // Refresh organization context across all tabs
      await refetch();
    } catch (err: any) {
      setProvisionError(err.message || 'Failed to purchase phone number on Twilio.');
    } finally {
      setProvisioningNumber(null);
    }
  };

  // Save Forwarding Phone
  const handleSaveEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || savingEscalation) return;

    setSavingEscalation(true);
    setEscalationSaved(false);

    try {
      const formatted = formatPhoneNumber(escalationPhone);
      const { error } = await supabase
        .from('organizations')
        .update({ escalation_phone_number: formatted })
        .eq('id', organizationId);

      if (error) throw error;
      setEscalationSaved(true);
      setTimeout(() => setEscalationSaved(false), 3000);
    } catch (e: any) {
      alert(e.message || 'Failed to update forwarding phone');
    } finally {
      setSavingEscalation(false);
    }
  };

  const isDedicatedActive = isDedicatedNumber || (activePhoneNumber && activePhoneNumber !== '+12513571708');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
          Phone Number &amp; Merchant Routing
        </h1>
        <p className="text-xs sm:text-sm text-slate-blue-400">
          Manage your call center line, provision dedicated Twilio phone numbers, and configure fallback routing
        </p>
      </div>

      {/* Status Alerts */}
      {provisionSuccess && (
        <div className="p-4 bg-accent-success/20 border border-accent-success/40 rounded-xl text-accent-success text-sm flex items-start gap-3 shadow-lg">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <span className="font-medium">{provisionSuccess}</span>
        </div>
      )}

      {provisionError && (
        <div className="p-4 bg-accent-danger/20 border border-accent-danger/40 rounded-xl text-accent-danger text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{provisionError}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Line Card */}
        <Panel className="p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <Phone className="h-5 w-5 text-chart-cyan" />
              Your Active Call Center Line
            </h2>
            <Badge variant={isDedicatedActive ? 'resolved' : 'default'}>
              {isDedicatedActive ? 'DEDICATED LINE' : 'SHARED + MERCHANT CODE'}
            </Badge>
          </div>

          {/* Active number box */}
          <div className="p-4 bg-navy-dark-elevated border border-navy-dark-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-slate-blue-300">
                {isDedicatedActive ? 'Your Dedicated Business Line:' : 'Shared Platform Line:'}
              </span>
              <span className="font-mono text-white text-base sm:text-lg font-bold">
                {activePhoneNumber}
              </span>
            </div>

            {!isDedicatedActive && (
              <div className="flex items-center justify-between pt-2.5 border-t border-navy-dark-border">
                <span className="text-xs sm:text-sm text-slate-blue-300">Your 6-Digit Merchant Code:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-extrabold text-chart-cyan tracking-wider">
                    {merchantCode || (orgLoading ? '...' : '100001')}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-1.5 hover:bg-navy-dark rounded text-slate-blue-400 hover:text-white transition-colors"
                    title="Copy Merchant Code"
                  >
                    {copied ? <Check className="h-4 w-4 text-accent-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inbound instructions */}
          <div className="space-y-2.5 text-xs sm:text-sm text-slate-blue-300 p-3.5 bg-navy-dark rounded-xl border border-navy-dark-border">
            <h3 className="font-semibold text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-accent-success" />
              {isDedicatedActive ? 'Direct Inbound Routing:' : 'Shared Line Inbound Routing:'}
            </h3>
            {isDedicatedActive ? (
              <p>
                Callers dial <span className="font-mono text-white font-semibold">{activePhoneNumber}</span> and connect <strong>directly to your dashboard</strong> with zero prompt delay. You do not need to share a 6-digit code!
              </p>
            ) : (
              <>
                <p>
                  1. Callers dial <span className="font-mono text-white font-semibold">{activePhoneNumber}</span>.
                </p>
                <p>
                  2. Prompt asks for merchant ID; customer enters <span className="font-mono text-white font-bold">{merchantCode}</span>.
                </p>
                <p>
                  3. Call connects immediately to your web dashboard and team!
                </p>
              </>
            )}
          </div>

          {/* Fallback forwarding phone */}
          <div className="pt-2 border-t border-navy-dark-border space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-blue-400">
              Mobile Fallback Forwarding
            </h3>
            <p className="text-xs text-slate-blue-400">
              If an incoming call is not answered on your web dashboard, forward it to this physical phone:
            </p>
            <form onSubmit={handleSaveEscalation} className="flex gap-2">
              <input
                type="tel"
                value={escalationPhone}
                onChange={(e) => setEscalationPhone(e.target.value)}
                placeholder="+254706499848"
                className="input text-xs font-mono flex-1 !h-9"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={savingEscalation} className="h-9 text-xs">
                {savingEscalation ? 'Saving...' : 'Save Phone'}
              </Button>
            </form>
            {escalationSaved && (
              <span className="text-xs text-accent-success flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Forwarding phone updated
              </span>
            )}
          </div>
        </Panel>

        {/* Dedicated Twilio Number Provisioning via API */}
        <Panel className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-primary" />
              Provision Dedicated Twilio Number
            </h2>
            <Badge variant="waiting">Real Twilio API</Badge>
          </div>

          <p className="text-xs sm:text-sm text-slate-blue-300">
            Search live available phone numbers on Twilio and provision a dedicated number directly bound to your dashboard:
          </p>

          <form onSubmit={handleSearchNumbers} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-blue-300 mb-1">Country</label>
                <select
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-dark border border-navy-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
                >
                  <option value="US">United States (+1)</option>
                  <option value="KE">Kenya (+254)</option>
                  <option value="GB">United Kingdom (+44)</option>
                  <option value="CA">Canada (+1)</option>
                  <option value="AU">Australia (+61)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-blue-300 mb-1">Area Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 251, 206, 706"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value)}
                  className="input !h-9 text-xs w-full font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-10 text-xs bg-accent-primary font-semibold"
              disabled={isSearching}
            >
              <Search className="h-4 w-4 mr-1.5" />
              {isSearching ? 'Searching Twilio Live...' : 'Search Available Phone Numbers'}
            </Button>
          </form>

          {searchError && (
            <div className="p-3 bg-accent-danger/20 border border-accent-danger/30 rounded-lg text-accent-danger text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Results list */}
          {availableNumbers.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-navy-dark-border">
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                Available Phone Numbers ({availableNumbers.length}):
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {availableNumbers.map((num) => (
                  <div
                    key={num.phoneNumber}
                    className="flex items-center justify-between p-3 bg-navy-dark-elevated rounded-lg border border-navy-dark-border"
                  >
                    <div>
                      <span className="font-mono text-sm font-bold text-chart-cyan">
                        {num.phoneNumber}
                      </span>
                      {num.locality && (
                        <p className="text-[10px] text-slate-blue-400">
                          {num.locality}, {num.region}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleProvisionNumber(num.phoneNumber)}
                      disabled={provisioningNumber !== null}
                      className="h-8 px-3 bg-accent-success hover:bg-accent-success/90 text-white font-semibold text-xs"
                    >
                      {provisioningNumber === num.phoneNumber ? 'Purchasing...' : 'Provision Number'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
