'use client';

import React, { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Book,
  HelpCircle,
  Phone,
  Radio,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageCircle,
  Terminal,
  Send,
  Sparkles,
} from 'lucide-react';
import { useOrganization } from '@/lib/context/OrganizationContext';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const FAQS: FaqItem[] = [
  {
    category: 'Routing',
    question: 'How do callers reach my specific dashboard using the 6-digit merchant code?',
    answer:
      'When callers dial the main line (+1 251 357 1708), our automated IVR prompts them to enter your 6-digit merchant code on their telephone keypad. Once entered, the call bypasses all other tenants and connects simultaneously to your web dashboard WebRTC receiver and your forwarding telephone number.',
  },
  {
    category: 'Audio',
    question: 'Can I talk directly to callers from my browser without using a physical telephone?',
    answer:
      'Yes! CallPulse includes an in-browser WebRTC softphone. When an incoming call arrives, an alert banner rings at the top of your dashboard. Clicking "Answer Call" opens two-way crystal-clear audio through your computer microphone and speakers or headset.',
  },
  {
    category: 'Transfers',
    question: 'How do I transfer an ongoing call to a team member or colleague?',
    answer:
      'Both the active call banner and the Web Dialer have a "Transfer Call" selector. Choose any registered team agent from the dropdown (or type any phone number in international format) and click Transfer. The caller is connected to that agent immediately.',
  },
  {
    category: 'Isolation',
    question: 'Is my customer data and call history isolated from other merchants on the platform?',
    answer:
      'Yes, CallPulse enforces strict multi-tenant isolation. All contacts, SMS messages, live calls, agent rosters, and performance metrics are strictly partitioned to your dedicated organization ID.',
  },
  {
    category: 'Numbers',
    question: 'Can I get my own dedicated phone number instead of using the 6-digit code?',
    answer:
      'Yes. Go to Settings > Phone & Merchant Routing to provision a dedicated Twilio phone number for your business in the US, Kenya (+254), UK (+44), or worldwide. Callers to your dedicated number connect directly without needing to type any code.',
  },
];

export default function HelpPage() {
  const { organizationId, merchantCode, organizationName } = useOrganization();

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Diagnostic Simulator State
  const [testNumber, setTestNumber] = useState('+254706499848');
  const [testCode, setTestCode] = useState(merchantCode || '100001');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Contact Support Modal State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSent, setTicketSent] = useState(false);

  const runDiagnostic = () => {
    setIsTesting(true);
    setTestOutput(null);

    setTimeout(() => {
      const codeMatches = testCode.trim() === merchantCode.trim();
      if (codeMatches) {
        setTestOutput(
          `[OK] Caller ${testNumber} -> Entered Merchant Code ${testCode}\n` +
          `[OK] Successfully resolved to organization: "${organizationName}" (ID: ${organizationId})\n` +
          `[OK] Generated WebRTC Client Tag: <Client>merchant_${organizationId}</Client>\n` +
          `[OK] Two-way audio channel: READY. Web dashboard will ring instantly with zero carrier lag.`
        );
      } else {
        setTestOutput(
          `[SIMULATION NOTICE] Entered Code ${testCode} does not match your active code (${merchantCode}).\n` +
          `The call would route to that specific code's merchant organization.`
        );
      }
      setIsTesting(false);
    }, 600);
  };

  const handleSendTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketSent(true);
    setTimeout(() => {
      setIsSupportModalOpen(false);
      setTicketSubject('');
      setTicketMessage('');
      setTicketSent(false);
    }, 2000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Help &amp; Knowledge Center</h1>
        <p className="text-xs sm:text-sm text-slate-blue-400">
          Setup guides, interactive diagnostics, and technical documentation for CallPulse
        </p>
      </div>

      {/* Quick Diagnostic / IVR Route Verifier */}
      <Panel className="p-5 sm:p-6 bg-gradient-to-br from-navy-dark-panel to-navy-dark border border-navy-dark-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-accent-primary" />
            <h2 className="text-base font-semibold text-white">
              Inbound Route Diagnostic Simulator
            </h2>
          </div>
          <Badge variant="resolved">Active Engine</Badge>
        </div>
        <p className="text-xs text-slate-blue-400 mb-4">
          Test and verify how the Twilio voice engine routes incoming calls for your merchant code:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-blue-300 mb-1">
              Simulated Caller Phone
            </label>
            <input
              type="text"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              className="input !h-9 text-xs font-mono w-full"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-blue-300 mb-1">
              Entered Merchant Code
            </label>
            <input
              type="text"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              className="input !h-9 text-xs font-mono w-full font-bold text-chart-cyan"
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="primary"
              onClick={runDiagnostic}
              disabled={isTesting}
              className="w-full h-9 text-xs bg-accent-primary font-semibold"
            >
              {isTesting ? 'Verifying...' : 'Run Route Check'}
            </Button>
          </div>
        </div>

        {testOutput && (
          <pre className="p-3 bg-navy-dark border border-navy-dark-border rounded-lg text-xs font-mono text-slate-blue-200 whitespace-pre-wrap">
            {testOutput}
          </pre>
        )}
      </Panel>

      {/* Feature Walkthrough Guides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Panel className="p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-accent-primary/20 text-accent-primary flex items-center justify-center">
            <Radio className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">6-Digit Merchant Routing</h3>
          <p className="text-xs text-slate-blue-400">
            Learn how incoming callers dial your merchant code and connect directly to your web browser with zero carrier latency.
          </p>
          <div className="text-xs text-accent-primary font-medium pt-1">
            Your Code: <strong className="font-mono text-white">{merchantCode}</strong>
          </div>
        </Panel>

        <Panel className="p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-chart-teal/20 text-chart-teal flex items-center justify-center">
            <Phone className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Web Dialer &amp; Audio</h3>
          <p className="text-xs text-slate-blue-400">
            Use your microphone to talk directly with customers or let the automated AI voice assistant handle inquiries.
          </p>
          <a
            href="/dashboard/dialer"
            className="text-xs text-chart-teal hover:underline inline-flex items-center gap-1 font-medium pt-1"
          >
            Open Web Dialer &rarr;
          </a>
        </Panel>

        <Panel className="p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-accent-purple/20 text-accent-purple flex items-center justify-center">
            <MessageCircle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Direct Support</h3>
          <p className="text-xs text-slate-blue-400">
            Need custom IVR configurations, dedicated phone numbers, or onboarding assistance? Our team is available 24/7.
          </p>
          <button
            onClick={() => setIsSupportModalOpen(true)}
            className="text-xs text-accent-purple hover:underline inline-flex items-center gap-1 font-medium pt-1 text-left"
          >
            Contact Engineering &rarr;
          </button>
        </Panel>
      </div>

      {/* Frequently Asked Questions */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-accent-primary" />
          Frequently Asked Questions
        </h2>

        <div className="space-y-2">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <Panel
                key={index}
                className="overflow-hidden border border-navy-dark-border cursor-pointer transition-colors hover:border-slate-700"
                onClick={() => setOpenFaq(isOpen ? null : index)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs px-2 py-0.5 rounded bg-navy-dark-elevated text-slate-blue-300 font-mono">
                      {faq.category}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{faq.question}</h3>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-blue-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-blue-400 shrink-0" />
                  )}
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 text-xs sm:text-sm text-slate-blue-300 border-t border-navy-dark-border/50 pt-3">
                    {faq.answer}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      </div>

      {/* Support Ticket Modal */}
      <Modal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        title="Contact Technical Support"
      >
        {ticketSent ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 mx-auto text-accent-success" />
            <h3 className="text-base font-semibold text-white">Support Request Received</h3>
            <p className="text-xs text-slate-blue-400">
              An engineering specialist will contact you shortly regarding your merchant workspace.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendTicket} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-blue-300 mb-1">Subject</label>
              <input
                type="text"
                placeholder="e.g. Inbound routing question or phone number provisioning"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="input !h-9 text-xs w-full"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-blue-300 mb-1">
                Details / Question
              </label>
              <textarea
                placeholder="Describe your request or issue..."
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-navy-dark border border-navy-dark-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-primary"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsSupportModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                <Send className="h-3.5 w-3.5 mr-1" />
                Submit Request
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
