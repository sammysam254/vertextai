'use client';

import React, { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  X,
  CreditCard,
  Coins,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useOrganization } from '@/lib/context/OrganizationContext';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
}

export function TopUpModal({ isOpen, onClose, onSuccess }: TopUpModalProps) {
  const { organizationId, user } = useOrganization();

  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'crypto'>('paystack');
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const presetAmounts = [10, 25, 50, 100];
  const finalAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

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

  const handlePay = async () => {
    if (!organizationId) {
      setError('Organization not found. Please refresh page.');
      return;
    }

    if (finalAmount < 1) {
      setError('Minimum top-up amount is $1.00 USD');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccessMessage('');

    try {
      if (paymentMethod === 'paystack') {
        // Initialize Paystack transaction
        const res = await fetch(getApiEndpoint('/api/v1/billing/paystack/initialize'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            amountUSD: finalAmount,
            email: user?.email || 'customer@vertext.site',
            callbackUrl: window.location.href,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.reference) {
          throw new Error(data.message || 'Failed to initialize Paystack payment');
        }

        // Check if Paystack returned an authorization URL
        if (data.authorization_url && data.authorization_url !== '#') {
          // If simulation mode or direct redirect
          if (data.authorization_url.includes('status=success')) {
            // Auto-verify simulation
            const verifyRes = await fetch(getApiEndpoint('/api/v1/billing/paystack/verify'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference: data.reference,
                organizationId,
              }),
            });
            const vData = await verifyRes.json();
            if (verifyRes.ok) {
              setSuccessMessage(vData.message || `Successfully credited $${finalAmount.toFixed(2)} USD!`);
              if (onSuccess) onSuccess(vData.newBalance);
              setTimeout(() => {
                onClose();
              }, 1800);
              return;
            }
          }
          // Redirect to Paystack secure checkout
          window.location.href = data.authorization_url;
          return;
        }

        // Direct verification fallback
        const verifyRes = await fetch(getApiEndpoint('/api/v1/billing/paystack/verify'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: data.reference,
            organizationId,
          }),
        });

        const vData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(vData.message || 'Verification failed');

        setSuccessMessage(`Successfully credited $${finalAmount.toFixed(2)} USD to your wallet!`);
        if (onSuccess) onSuccess(vData.newBalance);
        setTimeout(() => onClose(), 1800);
      } else {
        // NOWPayments Crypto Checkout
        const res = await fetch(getApiEndpoint('/api/v1/billing/nowpayments/invoice'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            amountUSD: finalAmount,
            successUrl: window.location.href,
            cancelUrl: window.location.href,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.invoice_url) {
          throw new Error(data.message || 'Failed to generate crypto invoice');
        }

        // Open crypto invoice
        if (data.invoice_url && data.invoice_url !== '#') {
          window.open(data.invoice_url, '_blank');
          setSuccessMessage(
            `Crypto invoice created! Complete your payment in the opened tab. Your wallet will credit automatically upon blockchain confirmation.`
          );
        } else {
          setSuccessMessage(`Simulated crypto invoice generated for $${finalAmount.toFixed(2)} USD!`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <Panel className="w-full max-w-lg p-6 bg-navy-dark-panel border border-navy-dark-border shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-blue-400 hover:text-white rounded-lg hover:bg-navy-dark transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center text-chart-cyan">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Top Up In-App Wallet
              <Badge variant="resolved" className="text-[10px]">Instant Credit</Badge>
            </h2>
            <p className="text-xs text-slate-blue-400">
              Recharge your business line for calls and dedicated phone numbers
            </p>
          </div>
        </div>

        {/* Status Alerts */}
        {successMessage && (
          <div className="mb-4 p-3.5 bg-accent-success/20 border border-accent-success/40 rounded-xl text-accent-success text-xs flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 bg-accent-danger/20 border border-accent-danger/40 rounded-xl text-accent-danger text-xs flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment Method Selector */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-blue-300 uppercase tracking-wider mb-2">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('paystack')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                  paymentMethod === 'paystack'
                    ? 'bg-accent-primary/20 border-chart-cyan shadow-sm shadow-chart-cyan/20'
                    : 'bg-navy-dark-elevated border-navy-dark-border hover:border-slate-blue-400/50'
                }`}
              >
                <CreditCard className={`h-5 w-5 ${paymentMethod === 'paystack' ? 'text-chart-cyan' : 'text-slate-blue-400'}`} />
                <span className="text-xs font-semibold text-white">Cards &amp; M-Pesa</span>
                <span className="text-[10px] text-slate-blue-400">Visa, MC, M-Pesa, Bank</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('crypto')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                  paymentMethod === 'crypto'
                    ? 'bg-accent-primary/20 border-chart-cyan shadow-sm shadow-chart-cyan/20'
                    : 'bg-navy-dark-elevated border-navy-dark-border hover:border-slate-blue-400/50'
                }`}
              >
                <Coins className={`h-5 w-5 ${paymentMethod === 'crypto' ? 'text-chart-cyan' : 'text-slate-blue-400'}`} />
                <span className="text-xs font-semibold text-white">Cryptocurrency</span>
                <span className="text-[10px] text-slate-blue-400">USDT, BTC, ETH, SOL</span>
              </button>
            </div>
          </div>

          {/* Amount Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-blue-300 uppercase tracking-wider mb-2">
              Amount (USD)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2.5">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`py-2 px-3 rounded-lg font-mono text-xs font-bold border transition-all ${
                    selectedAmount === amt && !customAmount
                      ? 'bg-accent-primary text-white border-accent-primary shadow-md'
                      : 'bg-navy-dark-elevated text-slate-blue-300 border-navy-dark-border hover:text-white'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-blue-400 font-mono font-bold">$</span>
              <input
                type="number"
                min="1"
                step="any"
                placeholder="Or enter custom amount in USD..."
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="input !h-9 text-xs pl-7 font-mono w-full"
              />
            </div>
          </div>

          {/* Price Summary */}
          <div className="p-3 bg-navy-dark border border-navy-dark-border rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-blue-300">
              <span>Top-Up Credit:</span>
              <span className="font-mono text-white font-bold">${finalAmount.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-slate-blue-300">
              <span>Gateway:</span>
              <span className="text-chart-cyan font-medium">
                {paymentMethod === 'paystack' ? 'Paystack (Card / M-Pesa)' : 'NOWPayments (Crypto)'}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-blue-400 pt-1 border-t border-navy-dark-border">
              <span>3 Free Minutes Monthly:</span>
              <span className="text-accent-success font-semibold">Included</span>
            </div>
          </div>

          {/* Action Button */}
          <Button
            variant="primary"
            onClick={handlePay}
            disabled={isProcessing || finalAmount <= 0}
            isLoading={isProcessing}
            loadingText={paymentMethod === 'paystack' ? 'Connecting Paystack...' : 'Generating Crypto Invoice...'}
            className="w-full h-11 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold text-xs shadow-lg shadow-accent-primary/20"
          >
            Pay ${finalAmount.toFixed(2)} USD Now
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>

          <p className="text-[11px] text-center text-slate-blue-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-success" />
            256-bit SSL encrypted &amp; verified payment processing
          </p>
        </div>
      </Panel>
    </div>
  );
}
