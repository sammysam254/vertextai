'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserCheck, UserPlus, Phone, Mail, Trash2, Search, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { formatPhoneNumber } from '@/lib/utils';

interface AgentItem {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  status: 'available' | 'in_call' | 'busy' | 'offline';
  is_active: boolean;
  created_at: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'available' | 'offline' | 'busy'>('available');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const supabase = createClient();

  // Load Organization ID
  useEffect(() => {
    async function loadOrg() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: mem } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          if (mem?.organization_id) {
            setOrganizationId(mem.organization_id);
            return;
          }
        }
        const { data: firstOrg } = await supabase
          .from('organizations')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (firstOrg?.id) {
          setOrganizationId(firstOrg.id);
        }
      } catch (e) {
        console.error('Error resolving organization:', e);
      }
    }
    loadOrg();
  }, [supabase]);

  // Fetch Agents
  const fetchAgents = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await api.get<{ agents: AgentItem[] }>(
        `/api/v1/agents?organizationId=${encodeURIComponent(organizationId)}`
      );
      setAgents(res.agents || []);
    } catch (err: any) {
      console.error('Error loading agents:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchAgents();
    }
  }, [organizationId, fetchAgents]);

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Agent name is required');
      return;
    }
    if (!phone.trim()) {
      setFormError('Phone number is required');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      const formattedPhone = formatPhoneNumber(phone);
      await api.post('/api/v1/agents', {
        organizationId: organizationId || 'default',
        name: name.trim(),
        phoneNumber: formattedPhone,
        email: email.trim() || undefined,
        status,
      });

      setSuccessMessage(`Agent "${name}" successfully registered!`);
      setName('');
      setPhone('');
      setEmail('');
      setStatus('available');
      setIsModalOpen(false);
      fetchAgents();

      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAgent = async (id: string, agentName: string) => {
    if (!confirm(`Are you sure you want to remove agent "${agentName}"?`)) return;

    try {
      await api.delete(`/api/v1/agents/${id}`);
      setAgents((prev) => prev.filter((a) => a.id !== id));
      setSuccessMessage(`Agent "${agentName}" removed.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete agent');
    }
  };

  const filteredAgents = agents.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.phone_number.toLowerCase().includes(q) ||
      (a.email && a.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-accent-primary" />
            Agent Management
          </h1>
          <p className="text-slate-blue-400">
            Add team agents one by one with their phone numbers for seamless call transfer and dispatching
          </p>
        </div>

        <Button
          onClick={() => {
            setFormError('');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          Add New Agent
        </Button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-status-available/10 border border-status-available/30 text-status-available flex items-center gap-3 text-sm animate-fade-in">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Search & Info Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-blue-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents by name, phone (+254...), or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-navy-dark-elevated border border-navy-dark-border rounded-lg text-white placeholder-slate-blue-400 text-sm focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>
        </div>

        <div className="p-3 bg-navy-dark-elevated border border-navy-dark-border rounded-lg flex items-center gap-3 text-xs text-slate-blue-300">
          <ShieldCheck className="h-6 w-6 text-accent-primary shrink-0" />
          <span>Agents added here will automatically populate your transfer lists and call center directory.</span>
        </div>
      </div>

      {/* Agents Table */}
      <Panel className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wide">
            Registered Agents ({filteredAgents.length})
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-blue-400 text-sm">
            Loading organization agents...
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <UserCheck className="h-10 w-10 text-slate-blue-600 mb-3" />
            <p className="text-white font-medium text-sm">No agents registered yet</p>
            <p className="text-slate-blue-400 text-xs mt-1 max-w-sm">
              Click "Add New Agent" above to register agents with their mobile or customer care phone numbers.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-bold uppercase">
                        {agent.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{agent.name}</p>
                        <p className="text-xs text-slate-blue-500">
                          Added {new Date(agent.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-slate-blue-200 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-blue-400" />
                      {agent.phone_number}
                    </span>
                  </TableCell>
                  <TableCell>
                    {agent.email ? (
                      <span className="text-xs text-slate-blue-300 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-blue-400" />
                        {agent.email}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-blue-600">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        agent.status === 'available'
                          ? 'available'
                          : agent.status === 'in_call'
                          ? 'in-call'
                          : agent.status === 'busy'
                          ? 'waiting'
                          : 'offline'
                      }
                      dot
                    >
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => handleDeleteAgent(agent.id, agent.name)}
                      className="p-1.5 text-slate-blue-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete agent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      {/* Add Agent Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Agent"
      >
        <form onSubmit={handleAddAgent} className="space-y-4">
          {formError && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-blue-300 mb-1">
              Agent Full Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Kamau"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-blue-300 mb-1">
              Phone Number (for call transfers) *
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0706499848 or +254706499848"
              required
            />
            <p className="text-[11px] text-slate-blue-500 mt-1">
              Kenyan numbers (07... / 01...) and international (+...) are automatically formatted to E.164.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-blue-300 mb-1">
              Email Address (optional)
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-blue-300 mb-1">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-navy-dark border border-navy-dark-border rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
            >
              <option value="available">Available (Ready to receive transfers)</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-dark-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Add Agent'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
