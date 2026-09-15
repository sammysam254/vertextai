import { Panel } from '@/components/ui/Panel';
import { Phone } from 'lucide-react';

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to CallPulse!</h1>
        <p className="text-slate-blue-400">
          Your AI-powered call center platform is ready
        </p>
      </div>

      {/* Welcome Panel */}
      <Panel className="p-8 text-center">
        <Phone className="h-16 w-16 text-accent-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">
          🎉 Setup Complete!
        </h2>
        <p className="text-slate-blue-300 mb-6 max-w-2xl mx-auto">
          Your CallPulse workspace has been created successfully. 
          Start by configuring your AI assistant and adding contacts.
        </p>
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <div className="p-4 bg-navy-dark-elevated rounded-lg">
            <h3 className="font-semibold text-white mb-2">1. Configure AI</h3>
            <p className="text-sm text-slate-blue-400">
              Set up your AI assistant's behavior and voice
            </p>
          </div>
          <div className="p-4 bg-navy-dark-elevated rounded-lg">
            <h3 className="font-semibold text-white mb-2">2. Add Contacts</h3>
            <p className="text-sm text-slate-blue-400">
              Import or manually add your customer contacts
            </p>
          </div>
          <div className="p-4 bg-navy-dark-elevated rounded-lg">
            <h3 className="font-semibold text-white mb-2">3. Test Calls</h3>
            <p className="text-sm text-slate-blue-400">
              Make a test call to see your AI in action
            </p>
          </div>
        </div>
      </Panel>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Panel className="p-6">
          <p className="text-slate-blue-400 text-sm mb-1">Total Calls</p>
          <p className="text-3xl font-bold text-white">0</p>
        </Panel>
        <Panel className="p-6">
          <p className="text-slate-blue-400 text-sm mb-1">Active Agents</p>
          <p className="text-3xl font-bold text-white">0</p>
        </Panel>
        <Panel className="p-6">
          <p className="text-slate-blue-400 text-sm mb-1">Contacts</p>
          <p className="text-3xl font-bold text-white">0</p>
        </Panel>
        <Panel className="p-6">
          <p className="text-slate-blue-400 text-sm mb-1">Messages</p>
          <p className="text-3xl font-bold text-white">0</p>
        </Panel>
      </div>
    </div>
  );
}
