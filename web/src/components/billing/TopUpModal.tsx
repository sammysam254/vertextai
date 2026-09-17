'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  X,
  CreditCard,
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useOrganization } from '@/lib/context/OrganizationContext';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
}

// Hardcoded exchange rate: 1 USD = 134 KES
const USD_TO_KES_RATE = 134;

type UsdtNetwork = 'TRC20' | 'BEP20' | 'SOL' | 'POLYGON' | 'ERC20' | 'TON' | 'ARBITRUM';

interface UsdtNetworkOption {
  id: UsdtNetwork;
  name: string;
  chain: string;
  badge?: string;
  speed: string;
  feeTier: 'Lowest' | 'Low' | 'Medium';
}

const USDT_NETWORKS: UsdtNetworkOption[] = [
  { id: 'TRC20', name: 'USDT (TRC20)', chain: 'Tron', badge: 'Popular', speed: '~1 min', feeTier: 'Lowest' },
  { id: 'BEP20', name: 'USDT (BEP20)', chain: 'BNB Smart Chain', speed: '~1 min', feeTier: 'Lowest' },
  { id: 'SOL', name: 'USDT (Solana)', chain: 'Solana', speed: '~30 sec', feeTier: 'Lowest' },
  { id: 'POLYGON', name: 'USDT (Polygon)', chain: 'Polygon (MATIC)', speed: '~2 min', feeTier: 'Lowest' },
  { id: 'TON', name: 'USDT (TON)', chain: 'The Open Network', speed: '~1 min', feeTier: 'Lowest' },
  { id: 'ARBITRUM', name: 'USDT (Arbitrum)', chain: 'Arbitrum One', speed: '~2 min', feeTier: 'Low' },
  { id: 'ERC20', name: 'USDT (ERC20)', chain: 'Ethereum', speed: '~5 min', feeTier: 'Medium' },
];

export function TopUpModal({ isOpen, onClose, onSuccess }: TopUpModalProps) {
  const { organizationId, user } = useOrganization();

  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'crypto' | 'instant'>('paystack');
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<UsdtNetwork>('TRC20');

  // In-App Paystack state
  const [paystackCheckoutUrl, setPaystackCheckoutUrl] = useState<string | null>(null);
  const [paystackRef, setPaystackRef] = useState<string | null>(null);
  const [isVerifyingPaystack, setIsVerifyingPaystack] = useState(false);

  // Crypto USDT payment state
  const [cryptoPayment, setCryptoPayment] = useState<{
    paymentId: string;
    payAddress: string;
    payAmount: number;
    network: UsdtNetwork;
    networkName: string;
    qrCodeUrl: string;
    orderId: string;
    invoiceUrl?: string;
  } | null>(null);

  const [cryptoStatus, setCryptoStatus] = useState<string>('waiting');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const statusPollRef = useRef<NodeJS.Timeout | null>(null);
  const paystackPollRef = useRef<NodeJS.Timeout | null>(null);

  const presetAmounts = [10, 25, 50, 100];
  const finalAmountUSD = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
  const finalAmountKES = Math.round(finalAmountUSD * USD_TO_KES_RATE);

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

  // Check Crypto status callback
  const checkCryptoStatus = useCallback(
    async (paymentId: string, showSpinner = true) => {
      if (!paymentId) return;
      if (showSpinner) setIsCheckingStatus(true);

      try {
        const res = await fetch(getApiEndpoint(`/api/v1/billing/nowpayments/verify/${paymentId}`));
        const data = await res.json();

        if (res.ok) {
          setCryptoStatus(data.status || 'waiting');

          if (data.confirmed) {
            setSuccessMessage(`USDT deposit confirmed! Added $${data.amountCredited.toFixed(2)} USD to your wallet.`);
            if (onSuccess) onSuccess(data.newBalance);
            if (statusPollRef.current) clearInterval(statusPollRef.current);
            setTimeout(() => {
              onClose();
            }, 2500);
          }
        }
      } catch (e) {
        console.error('Error verifying crypto payment status:', e);
      } finally {
        if (showSpinner) setIsCheckingStatus(false);
      }
    },
    [onSuccess, onClose]
  );

  // Auto-poll crypto payment status while active
  useEffect(() => {
    if (cryptoPayment?.paymentId && cryptoStatus !== 'finished' && cryptoStatus !== 'confirmed') {
      statusPollRef.current = setInterval(() => {
        checkCryptoStatus(cryptoPayment.paymentId, false);
      }, 7000);
    }
    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, [cryptoPayment?.paymentId, cryptoStatus, checkCryptoStatus]);

  // Verify Paystack with backend
  const verifyPaystackPayment = useCallback(
    async (reference: string, silent = false) => {
      if (!silent) setIsVerifyingPaystack(true);
      setError('');
      try {
        const res = await fetch(getApiEndpoint('/api/v1/billing/paystack/verify'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference,
            organizationId,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setSuccessMessage(`Payment confirmed! Credited $${data.amountCredited.toFixed(2)} USD to your wallet.`);
          setPaystackCheckoutUrl(null);
          if (paystackPollRef.current) clearInterval(paystackPollRef.current);
          if (onSuccess) onSuccess(data.newBalance);
          setTimeout(() => {
            onClose();
          }, 2000);
          return true;
        } else if (!silent) {
          setError(data.message || 'Payment not yet confirmed by Paystack. Please complete the prompt and retry.');
        }
      } catch (err: any) {
        if (!silent) {
          setError(err.message || 'Could not verify payment yet. Please ensure payment completed.');
        }
      } finally {
        if (!silent) setIsVerifyingPaystack(false);
      }
      return false;
    },
    [organizationId, onSuccess, onClose]
  );

  // Auto-poll Paystack verification while awaiting confirmation
  useEffect(() => {
    if (paystackRef && paystackCheckoutUrl) {
      paystackPollRef.current = setInterval(() => {
        verifyPaystackPayment(paystackRef, true);
      }, 3000);
    }
    return () => {
      if (paystackPollRef.current) clearInterval(paystackPollRef.current);
    };
  }, [paystackRef, paystackCheckoutUrl, verifyPaystackPayment]);

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handlePay = async () => {
    if (!organizationId) {
      setError('Organization not found. Please refresh page.');
      return;
    }

    if (finalAmountUSD < 1) {
      setError('Minimum top-up amount is $1.00 USD');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccessMessage('');

    try {
      // OPTION 1: INSTANT DEMO / TEST TOP-UP
      if (paymentMethod === 'instant') {
        const res = await fetch(getApiEndpoint('/api/v1/billing/wallet/deposit'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            amountUSD: finalAmountUSD,
            method: 'fast_topup',
            description: `Fast Top-up ($${finalAmountUSD.toFixed(2)} USD)`,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to deposit funds');
        }

        setSuccessMessage(`Success! Credited $${finalAmountUSD.toFixed(2)} USD to your wallet.`);
        if (onSuccess) onSuccess(data.newBalance);
        setTimeout(() => {
          onClose();
        }, 1800);
        return;
      }

      // OPTION 2: PAYSTACK (Cards, M-Pesa, Mobile Money)
      if (paymentMethod === 'paystack') {
        const res = await fetch(getApiEndpoint('/api/v1/billing/paystack/initialize'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            amountUSD: finalAmountUSD,
            email: user?.email || 'customer@vertext.site',
            callbackUrl: `${window.location.origin}/dashboard/billing`,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.reference) {
          throw new Error(data.message || 'Failed to initialize Paystack payment');
        }

        setPaystackRef(data.reference);
        setPaystackCheckoutUrl(data.authorization_url);

        // Open Paystack Checkout in secure window
        if (typeof window !== 'undefined' && data.authorization_url) {
          window.open(data.authorization_url, '_blank', 'width=520,height=700');
        }

        setIsProcessing(false);
        return;
      }

      // OPTION 3: CRYPTO (USDT Multi-Network)
      const res = await fetch(getApiEndpoint('/api/v1/billing/nowpayments/usdt-deposit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          amountUSD: finalAmountUSD,
          network: selectedNetwork,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.payment_id) {
        throw new Error(data.message || 'Failed to generate USDT deposit address');
      }

      setCryptoPayment({
        paymentId: data.payment_id,
        payAddress: data.pay_address,
        payAmount: data.pay_amount || finalAmountUSD,
        network: data.network,
        networkName: data.networkName,
        qrCodeUrl: data.qrCodeUrl,
        orderId: data.order_id,
        invoiceUrl: data.invoice_url,
      });

      setCryptoStatus(data.payment_status || 'waiting');
    } catch (err: any) {
      setError(err.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPaystackCheckoutUrl(null);
    setPaystackRef(null);
    setCryptoPayment(null);
    setError('');
    setSuccessMessage('');
    if (paystackPollRef.current) clearInterval(paystackPollRef.current);
    if (statusPollRef.current) clearInterval(statusPollRef.current);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <Panel
        className={`w-full ${
          paystackCheckoutUrl ? 'max-w-xl' : 'max-w-lg'
        } p-5 sm:p-6 bg-navy-dark-panel border border-navy-dark-border shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto transition-all`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-blue-400 hover:text-white rounded-lg hover:bg-navy-dark transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center text-chart-cyan shrink-0">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              Top Up In-App Wallet
              <Badge variant="resolved" className="text-[10px]">
                Instant Sync
              </Badge>
            </h2>
            <p className="text-xs text-slate-blue-400">
              Recharge your balance for outbound voice calls and dedicated numbers
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

        {/* 1. Paystack Checkout Status Card */}
        {paystackCheckoutUrl ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-navy-dark rounded-xl border border-navy-dark-border text-xs">
              <span className="text-slate-blue-300">
                Amount to Pay: <strong className="text-white font-mono text-sm">KES {finalAmountKES.toLocaleString()}</strong> (Credits{' '}
                <span className="text-accent-success font-mono font-bold">${finalAmountUSD.toFixed(2)} USD</span>)
              </span>
              <span className="text-[11px] text-chart-cyan flex items-center gap-1 font-mono">
                <ShieldCheck className="h-3.5 w-3.5" /> 256-bit Secure
              </span>
            </div>

            <div className="p-6 bg-navy-dark-elevated border border-navy-dark-border rounded-xl text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-full bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center text-chart-cyan mx-auto animate-pulse">
                <CreditCard className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Awaiting Paystack Payment</h3>
                <p className="text-xs text-slate-blue-300 max-w-sm mx-auto leading-relaxed">
                  Complete your Card or M-Pesa transaction in the secure checkout window. Your wallet balance will automatically credit the moment payment succeeds.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => window.open(paystackCheckoutUrl, '_blank', 'width=520,height=700')}
                  className="w-full sm:w-auto text-xs font-semibold h-10 px-4 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Re-open Paystack Checkout
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => paystackRef && verifyPaystackPayment(paystackRef)}
                  disabled={isVerifyingPaystack}
                  isLoading={isVerifyingPaystack}
                  loadingText="Verifying..."
                  className="w-full sm:w-auto text-xs bg-accent-success hover:bg-accent-success/90 text-white font-bold h-10 px-5 shadow-lg shadow-accent-success/20"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  I Have Completed Payment
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 text-xs text-slate-blue-400">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Clock className="h-3.5 w-3.5 text-chart-cyan animate-spin" /> Auto-checking payment every 3s...
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-blue-400 hover:text-white underline"
              >
                Cancel &amp; Change Method
              </button>
            </div>
          </div>
        ) : cryptoPayment ? (
          /* 2. In-App Crypto USDT Address & QR Code View */
          <div className="space-y-4">
            <div className="p-3.5 bg-navy-dark border border-navy-dark-border rounded-xl text-center">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="waiting" className="text-[11px] font-mono">
                  {cryptoPayment.networkName}
                </Badge>
                <div className="flex items-center gap-1.5 text-xs text-slate-blue-300">
                  <Clock className="h-3.5 w-3.5 text-chart-cyan animate-pulse" />
                  <span>
                    Status:{' '}
                    <strong className="text-white capitalize">
                      {cryptoStatus === 'waiting'
                        ? 'Awaiting Transfer'
                        : cryptoStatus === 'confirming'
                        ? 'Confirming on Chain'
                        : cryptoStatus}
                    </strong>
                  </span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-xl inline-block shadow-lg mx-auto my-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cryptoPayment.qrCodeUrl} alt="Scan to pay USDT" className="w-44 h-44 mx-auto" />
              </div>

              <div className="mt-2 text-xs text-slate-blue-300">
                Send exactly{' '}
                <strong className="text-chart-cyan text-sm font-mono font-bold">
                  {cryptoPayment.payAmount.toFixed(2)} USDT
                </strong>
              </div>
            </div>

            {/* Address Box or Portal Link */}
            {cryptoPayment.payAddress.startsWith('http') ? (
              <div className="p-3.5 bg-navy-dark-elevated border border-navy-dark-border rounded-xl text-center space-y-2">
                <p className="text-xs text-slate-blue-300">
                  Open NOWPayments secure portal to complete your USDT deposit:
                </p>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => window.open(cryptoPayment.payAddress, '_blank')}
                  className="w-full h-10 text-xs font-bold bg-accent-primary hover:bg-accent-primary/90 text-white flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open NOWPayments Portal ({cryptoPayment.payAmount.toFixed(2)} USDT)
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-blue-300 uppercase tracking-wider">
                  Deposit Address ({cryptoPayment.networkName})
                </label>
                <div className="flex items-center gap-2 p-2.5 bg-navy-dark-elevated border border-navy-dark-border rounded-xl">
                  <span className="font-mono text-xs text-white break-all flex-1 select-all px-1">
                    {cryptoPayment.payAddress}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopyAddress(cryptoPayment.payAddress)}
                    className="h-8 px-3 shrink-0 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {copiedAddress ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-accent-success" />
                        <span className="text-accent-success">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-blue-300" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-accent-warning flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Transfer ONLY USDT on the {cryptoPayment.networkName} network to this address.
                </p>
              </div>
            )}

            {/* Status Tracking Card */}
            <div className="p-3 bg-navy-dark-elevated border border-navy-dark-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-blue-300 flex items-center gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 text-chart-cyan ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  Live Blockchain Tracking
                </span>
                <button
                  type="button"
                  onClick={() => checkCryptoStatus(cryptoPayment.paymentId, true)}
                  disabled={isCheckingStatus}
                  className="text-xs text-chart-cyan hover:underline font-semibold"
                >
                  {isCheckingStatus ? 'Checking...' : 'Check Status Now'}
                </button>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[10px]">
                <div
                  className={`p-1.5 rounded-lg ${
                    cryptoStatus === 'waiting'
                      ? 'bg-chart-cyan/20 text-chart-cyan font-bold border border-chart-cyan/40'
                      : 'bg-navy-dark text-slate-blue-400'
                  }`}
                >
                  1. Awaiting
                </div>
                <div
                  className={`p-1.5 rounded-lg ${
                    cryptoStatus === 'confirming'
                      ? 'bg-chart-cyan/20 text-chart-cyan font-bold border border-chart-cyan/40'
                      : 'bg-navy-dark text-slate-blue-400'
                  }`}
                >
                  2. Confirming
                </div>
                <div
                  className={`p-1.5 rounded-lg ${
                    cryptoStatus === 'finished' || cryptoStatus === 'confirmed'
                      ? 'bg-accent-success/20 text-accent-success font-bold border border-accent-success/40'
                      : 'bg-navy-dark text-slate-blue-400'
                  }`}
                >
                  3. Credited
                </div>
              </div>
            </div>

            {/* Back / Reset */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="w-full text-xs text-slate-blue-300 hover:text-white"
            >
              Change Amount or Network
            </Button>
          </div>
        ) : (
          /* 3. Main Method Selection Screen */
          <div className="space-y-4">
            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-blue-300 uppercase tracking-wider mb-2">
                Select Payment Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paystack')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                    paymentMethod === 'paystack'
                      ? 'bg-accent-primary/20 border-chart-cyan shadow-sm shadow-chart-cyan/20 ring-1 ring-chart-cyan'
                      : 'bg-navy-dark-elevated border-navy-dark-border hover:border-slate-blue-400/50'
                  }`}
                >
                  <CreditCard
                    className={`h-5 w-5 ${paymentMethod === 'paystack' ? 'text-chart-cyan' : 'text-slate-blue-400'}`}
                  />
                  <span className="text-xs font-bold text-white">Paystack (M-Pesa/Card)</span>
                  <span className="text-[10px] text-slate-blue-400 font-mono">1 USD = 134 KES</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('crypto')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                    paymentMethod === 'crypto'
                      ? 'bg-accent-primary/20 border-chart-cyan shadow-sm shadow-chart-cyan/20 ring-1 ring-chart-cyan'
                      : 'bg-navy-dark-elevated border-navy-dark-border hover:border-slate-blue-400/50'
                  }`}
                >
                  <Coins
                    className={`h-5 w-5 ${paymentMethod === 'crypto' ? 'text-chart-cyan' : 'text-slate-blue-400'}`}
                  />
                  <span className="text-xs font-bold text-white">Crypto (USDT)</span>
                  <span className="text-[10px] text-slate-blue-400">TRC20, BEP20...</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('instant')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                    paymentMethod === 'instant'
                      ? 'bg-accent-primary/20 border-chart-cyan shadow-sm shadow-chart-cyan/20 ring-1 ring-chart-cyan'
                      : 'bg-navy-dark-elevated border-navy-dark-border hover:border-slate-blue-400/50'
                  }`}
                >
                  <Sparkles
                    className={`h-5 w-5 ${paymentMethod === 'instant' ? 'text-chart-cyan' : 'text-slate-blue-400'}`}
                  />
                  <span className="text-xs font-bold text-white">⚡ Instant Top-Up</span>
                  <span className="text-[10px] text-slate-blue-400">Direct credit / Testing</span>
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

            {/* If Crypto USDT: Network Selector */}
            {paymentMethod === 'crypto' && (
              <div>
                <label className="block text-xs font-semibold text-slate-blue-300 uppercase tracking-wider mb-2">
                  Select USDT Blockchain Network
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {USDT_NETWORKS.map((net) => (
                    <button
                      key={net.id}
                      type="button"
                      onClick={() => setSelectedNetwork(net.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        selectedNetwork === net.id
                          ? 'bg-chart-cyan/15 border-chart-cyan text-white shadow-sm ring-1 ring-chart-cyan'
                          : 'bg-navy-dark-elevated border-navy-dark-border text-slate-blue-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono">{net.id}</span>
                        {net.badge && (
                          <span className="text-[9px] px-1 py-0.2 bg-chart-cyan text-navy-dark font-bold rounded">
                            {net.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-blue-400 truncate mt-0.5">{net.chain}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Currency Breakdown & Rate Transparency */}
            <div className="p-3.5 bg-navy-dark border border-navy-dark-border rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-blue-300">
                <span>Top-Up Amount:</span>
                <span className="font-mono text-white font-bold">${finalAmountUSD.toFixed(2)} USD</span>
              </div>

              {paymentMethod === 'paystack' ? (
                <>
                  <div className="flex justify-between text-slate-blue-300">
                    <span>Paystack Exchange Rate:</span>
                    <span className="font-mono text-chart-cyan font-semibold">1 USD = 134 KES</span>
                  </div>
                  <div className="flex justify-between text-slate-blue-300 pt-1 border-t border-navy-dark-border">
                    <span>Amount Charged in KES:</span>
                    <span className="font-mono text-white font-bold text-sm">
                      KES {finalAmountKES.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-blue-400 italic">
                    Paystack charges in KES (KES {finalAmountKES.toLocaleString()}) via Card or M-Pesa. Wallet credits with exact ${finalAmountUSD.toFixed(2)} USD upon confirmation.
                  </div>
                </>
              ) : paymentMethod === 'crypto' ? (
                <>
                  <div className="flex justify-between text-slate-blue-300">
                    <span>Selected Currency:</span>
                    <span className="font-mono text-chart-cyan font-bold">
                      {finalAmountUSD.toFixed(2)} USDT ({selectedNetwork})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-blue-400 italic">
                    You will receive a dedicated deposit address and QR code to transfer directly.
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-accent-success flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Instant deposit will add ${finalAmountUSD.toFixed(2)} USD directly to your organization wallet.
                </div>
              )}
            </div>

            {/* Action Button */}
            <Button
              variant="primary"
              onClick={handlePay}
              disabled={isProcessing || finalAmountUSD <= 0}
              isLoading={isProcessing}
              loadingText={
                paymentMethod === 'paystack'
                  ? `Opening Paystack...`
                  : paymentMethod === 'crypto'
                  ? `Generating USDT (${selectedNetwork}) Address...`
                  : `Crediting Wallet...`
              }
              className="w-full h-11 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold text-xs shadow-lg shadow-accent-primary/20"
            >
              {paymentMethod === 'paystack'
                ? `Pay KES ${finalAmountKES.toLocaleString()} via Paystack (Card / M-Pesa)`
                : paymentMethod === 'crypto'
                ? `Generate ${finalAmountUSD.toFixed(2)} USDT (${selectedNetwork}) Address & QR`
                : `⚡ Credit $${finalAmountUSD.toFixed(2)} USD Directly to Wallet`}
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>

            <p className="text-[11px] text-center text-slate-blue-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent-success" />
              Secure 256-bit encryption • Live wallet balance sync
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
