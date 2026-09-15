import { Panel } from '@/components/ui/Panel';
import { Book, MessageCircle, ExternalLink } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Help & Support</h1>
        <p className="text-slate-blue-400">
          Documentation, guides, and support resources
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Panel className="p-6 hover:shadow-panel-hover transition-shadow cursor-pointer">
          <Book className="h-8 w-8 text-accent-primary mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Documentation
          </h3>
          <p className="text-slate-blue-400 text-sm mb-4">
            Comprehensive guides for setting up and using CallPulse
          </p>
          <a
            href="#"
            className="text-accent-primary text-sm font-medium hover:underline inline-flex items-center gap-2"
          >
            Read Docs
            <ExternalLink className="h-3 w-3" />
          </a>
        </Panel>

        <Panel className="p-6 hover:shadow-panel-hover transition-shadow cursor-pointer">
          <MessageCircle className="h-8 w-8 text-chart-teal mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Contact Support
          </h3>
          <p className="text-slate-blue-400 text-sm mb-4">
            Get help from our support team via email or chat
          </p>
          <a
            href="mailto:support@callpulse.io"
            className="text-accent-primary text-sm font-medium hover:underline inline-flex items-center gap-2"
          >
            support@callpulse.io
            <ExternalLink className="h-3 w-3" />
          </a>
        </Panel>
      </div>
    </div>
  );
}
