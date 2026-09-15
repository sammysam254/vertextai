import Link from 'next/link';
import { ArrowRight, Phone, MessageSquare, BarChart3 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-navy-dark flex flex-col">
      {/* Header */}
      <header className="border-b border-navy-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone className="h-8 w-8 text-accent-primary" />
              <h1 className="text-2xl font-bold text-white">CallPulse</h1>
            </div>
            <Link
              href="/login"
              className="btn btn-primary"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            AI-Powered Call Center
            <br />
            <span className="text-chart-teal">Built for Scale</span>
          </h2>
          <p className="text-xl text-slate-blue-300 mb-12 max-w-2xl mx-auto">
            Multi-tenant call center and SMS automation platform with ultra-low
            latency AI responses, powered by Groq Llama 3 and Twilio.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/login" className="btn btn-primary text-lg px-8 py-3">
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/dashboard"
              className="btn btn-secondary text-lg px-8 py-3"
            >
              View Demo
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="panel p-6 text-left">
              <div className="bg-accent-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-accent-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Voice AI
              </h3>
              <p className="text-slate-blue-400">
                Turn-based voice conversations with sub-500ms AI response times
                using Twilio native transcription.
              </p>
            </div>

            <div className="panel p-6 text-left">
              <div className="bg-chart-teal/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-chart-teal" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                SMS Automation
              </h3>
              <p className="text-slate-blue-400">
                Context-aware SMS conversations with automatic replies and full
                message history.
              </p>
            </div>

            <div className="panel p-6 text-left">
              <div className="bg-chart-cyan/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-chart-cyan" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Real-Time Analytics
              </h3>
              <p className="text-slate-blue-400">
                Live performance dashboards with agent metrics, call queues, and
                sentiment analysis.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-dark-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-blue-500 text-sm">
            © 2026 CallPulse. Built with Next.js, Fastify, Supabase, and Groq AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
