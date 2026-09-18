import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Phone,
  MessageSquare,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  Headphones,
  Activity,
  CheckCircle2,
  Clock,
  Radio,
  Lock,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      {/* Background Decorative Mesh & Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] sm:w-[1000px] h-[450px] bg-gradient-to-b from-cyan-500/15 via-blue-600/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[40%] right-[-10%] w-[450px] h-[450px] bg-purple-600/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 blur-[140px] rounded-full" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#070B14]/80 border-b border-white/[0.06] transition-all pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-cyan-500/30 bg-[#0F1629] p-1 shadow-[0_0_20px_rgba(0,212,255,0.25)] flex items-center justify-center group-hover:border-cyan-400 transition-colors">
              <Image
                src="/brand/icon.png"
                alt="CallPulse"
                width={36}
                height={36}
                className="object-contain drop-shadow-[0_0_8px_#00D4FF]"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight text-white uppercase flex items-center gap-1.5">
                CallPulse
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00E5FF] animate-pulse" />
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 hidden sm:inline">
                AI Voice &amp; SMS Operations
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-cyan-400 transition-colors">Capabilities</a>
            <a href="#demo" className="hover:text-cyan-400 transition-colors">Live Architecture</a>
            <a href="#metrics" className="hover:text-cyan-400 transition-colors">Performance</a>
            <Link href="/dashboard/billing" className="hover:text-cyan-400 transition-colors">Rates &amp; Free Trial</Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/login"
              className="px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 hover:text-white hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/10"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="relative inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 bg-[length:200%_auto] hover:bg-right transition-all duration-300 shadow-[0_0_25px_rgba(0,212,255,0.35)] active:scale-[0.98]"
            >
              <span>Launch App</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col justify-center pt-8 sm:pt-14 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center text-center space-y-6 sm:space-y-8 max-w-4xl mx-auto">
          
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-white/[0.04] border border-cyan-500/30 text-cyan-300 text-xs sm:text-sm font-medium backdrop-blur-md shadow-[0_0_25px_rgba(0,212,255,0.15)] hover:border-cyan-400/50 transition-colors">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-semibold">Next-Gen Multi-Tenant Telephony</span>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">Sub-500ms AI Responses</span>
          </div>

          {/* Hero Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.1] max-w-4xl">
            AI-Powered Call Center{' '}
            <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(0,212,255,0.35)]">
              Built For Enterprise Scale
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-lg md:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed">
            Multi-tenant voice AI and automated SMS platform powered by Twilio, Groq Llama 3, and WebRTC. Turn-based voice calls, instant merchant routing, and live wallboards.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 w-full sm:w-auto pt-2">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-extrabold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_35px_rgba(0,212,255,0.4)] transition-all duration-200 active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-200" />
              <span>Start Free (3 Free Mins/Mo)</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>

            <Link
              href="/dashboard/dialer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-bold text-slate-200 bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 hover:border-cyan-500/40 transition-all duration-200"
            >
              <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
              <span>Open Live Dialer</span>
            </Link>
          </div>

          {/* Security & Telecom Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Dedicated Merchant Code</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-cyan-400" />
              <span>Per-Second Fair Billing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-blue-400" />
              <span>Browser WebRTC Audio</span>
            </div>
          </div>

          {/* Interactive Live Voice Simulation Card */}
          <div id="demo" className="w-full max-w-3xl mt-10 sm:mt-14 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-1 border border-cyan-500/30 shadow-[0_0_60px_rgba(0,212,255,0.15)] text-left">
            <div className="rounded-xl bg-[#0B101E]/95 p-4 sm:p-6 backdrop-blur-xl">
              {/* Terminal / Call Status Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10B981]" />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-white block">Active Voice Channel • WebRTC Bridge</span>
                    <span className="text-[11px] font-mono text-cyan-400">Carrier: Twilio Voice • Routing: Code #702122</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] sm:text-xs font-mono font-semibold">
                    Turn: 420ms
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] sm:text-xs font-mono font-semibold hidden sm:inline">
                    Loss: 0.0%
                  </span>
                </div>
              </div>

              {/* Dynamic Soundwave Simulation */}
              <div className="py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                    <Radio className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Live Audio Stream</p>
                    <p className="text-sm font-bold text-white">AI Agent (Alice - Kenyan Neutral)</p>
                  </div>
                </div>

                {/* Animated Waveform Bars */}
                <div className="flex items-center gap-1 sm:gap-1.5 h-8">
                  <span className="w-1 bg-cyan-400 rounded-full animate-[soundwave_1.1s_ease-in-out_infinite]" />
                  <span className="w-1 bg-cyan-300 rounded-full animate-[soundwave_1.4s_ease-in-out_infinite_0.2s]" />
                  <span className="w-1 bg-blue-400 rounded-full animate-[soundwave_0.9s_ease-in-out_infinite_0.4s]" />
                  <span className="w-1 bg-emerald-400 rounded-full animate-[soundwave_1.2s_ease-in-out_infinite_0.1s]" />
                  <span className="w-1 bg-cyan-400 rounded-full animate-[soundwave_1.5s_ease-in-out_infinite_0.3s]" />
                  <span className="w-1 bg-blue-300 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite_0.5s]" />
                  <span className="w-1 bg-cyan-400 rounded-full animate-[soundwave_1.3s_ease-in-out_infinite_0.2s]" />
                </div>
              </div>

              {/* Simulated Dialogue Bubble */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs sm:text-sm text-slate-200">
                <span className="text-cyan-400 font-bold mr-2">AI Assistant:</span>
                &ldquo;Hello! Welcome to Vertex AI Support. Your order #4092 has been processed and dispatched via courier. Would you like me to SMS you the live tracking link?&rdquo;
              </div>
            </div>
          </div>

        </div>

        {/* Capabilities Grid */}
        <section id="features" className="pt-20 sm:pt-28">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-cyan-400 mb-2">
              Engineered For Reliability
            </h2>
            <p className="text-2xl sm:text-4xl font-extrabold text-white">
              Everything Your Contact Centre Needs In One Place
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-cyan-500/40 p-6 sm:p-7 transition-all duration-300 group hover:-translate-y-1 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all">
                <Phone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                Sub-500ms Voice AI
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Direct in-browser WebRTC mic calling with zero plugins required. Fall back seamlessly to telecom carriers for inbound and outbound calls worldwide.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-blue-500/40 p-6 sm:p-7 transition-all duration-300 group hover:-translate-y-1 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-5 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                Context-Aware SMS Inbox
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Two-way conversational SMS with unified contact threading, automated replies, delivery webhook status, and multi-tenant customer records.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-emerald-500/40 p-6 sm:p-7 transition-all duration-300 group hover:-translate-y-1 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                Live Wallboards &amp; Metrics
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Real-time supervisor monitors with agent status, active call counters, duration charts, customer sentiment metrics, and queue analytics.
              </p>
            </div>
          </div>
        </section>

        {/* Metrics Ticker */}
        <section id="metrics" className="pt-20 sm:pt-28">
          <div className="rounded-2xl bg-gradient-to-r from-cyan-950/40 via-navy-dark-panel to-blue-950/40 border border-cyan-500/25 p-6 sm:p-10 shadow-[0_0_50px_rgba(0,212,255,0.1)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
              <div className="pt-4 sm:pt-0">
                <p className="text-2xl sm:text-4xl font-black text-cyan-400 font-mono tracking-tight">&lt; 450ms</p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Turn Latency</p>
              </div>
              <div className="pt-4 sm:pt-0">
                <p className="text-2xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">3 Min Free</p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Every Single Month</p>
              </div>
              <div className="pt-4 sm:pt-0">
                <p className="text-2xl sm:text-4xl font-black text-white font-mono tracking-tight">99.98%</p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Platform Uptime</p>
              </div>
              <div className="pt-4 sm:pt-0">
                <p className="text-2xl sm:text-4xl font-black text-purple-400 font-mono tracking-tight">180+ Countries</p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Carrier Coverage</p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#05080F] mt-20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-xs font-black">
              CP
            </div>
            <span className="text-sm font-bold text-white">CallPulse Platform</span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400">© 2026 Contact Centre Insights</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">Console</Link>
            <Link href="/dashboard/dialer" className="hover:text-cyan-400 transition-colors">Dialer</Link>
            <Link href="/dashboard/inbox" className="hover:text-cyan-400 transition-colors">SMS Inbox</Link>
            <Link href="/dashboard/billing" className="hover:text-cyan-400 transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
