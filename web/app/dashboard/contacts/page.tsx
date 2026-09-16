'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  MessageSquare,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { formatPhoneNumber, getRelativeTime } from '@/lib/utils';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ContactItem {
  id: string;
  organization_id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function ContactsPage() {
  const { organizationId, merchantCode } = useOrganization();
  const supabase = createClient();

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch contacts from Supabase
  const loadContacts = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, supabase]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Add Contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPhone.trim() || !organizationId || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const formatted = formatPhoneNumber(formPhone);
      const { error } = await supabase.from('contacts').insert({
        organization_id: organizationId,
        name: formName.trim() || null,
        phone_number: formatted,
        email: formEmail.trim() || null,
        notes: formNotes.trim() || null,
      });

      if (error) throw error;

      setFeedback({ type: 'success', text: 'Contact created successfully' });
      setIsAddModalOpen(false);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormNotes('');
      loadContacts();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save contact' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Contact
  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !formPhone.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const formatted = formatPhoneNumber(formPhone);
      const { error } = await supabase
        .from('contacts')
        .update({
          name: formName.trim() || null,
          phone_number: formatted,
          email: formEmail.trim() || null,
          notes: formNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedContact.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      setSelectedContact(null);
      loadContacts();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update contact' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Contact
  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete contact');
    }
  };

  const openEditModal = (contact: ContactItem) => {
    setSelectedContact(contact);
    setFormName(contact.name || '');
    setFormPhone(contact.phone_number || '');
    setFormEmail(contact.email || '');
    setFormNotes(contact.notes || '');
    setIsEditModalOpen(true);
  };

  // Filter contacts by search query
  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(q);
    const phoneMatch = c.phone_number?.toLowerCase().includes(q);
    const emailMatch = c.email?.toLowerCase().includes(q);
    return nameMatch || phoneMatch || emailMatch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Contacts & Customers</h1>
          <p className="text-xs sm:text-sm text-slate-blue-400">
            Address book for merchant code <span className="font-mono text-white font-bold">{merchantCode}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              setFormName('');
              setFormPhone('');
              setFormEmail('');
              setFormNotes('');
              setFeedback(null);
              setIsAddModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Contact
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs sm:text-sm flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-accent-success/20 border border-accent-success/30 text-accent-success'
              : 'bg-accent-danger/20 border border-accent-danger/30 text-accent-danger'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Search Bar */}
      <Panel className="p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-blue-400" />
          <input
            type="search"
            placeholder="Search contacts by name, phone number, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full text-xs sm:text-sm"
          />
        </div>
      </Panel>

      {/* Contacts Table */}
      <Panel className="p-4 sm:p-6 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-blue-400 text-sm">Loading contacts...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="py-12 text-center text-slate-blue-400">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30 text-accent-primary" />
            <h3 className="text-base font-semibold text-white">No contacts found</h3>
            <p className="text-xs text-slate-blue-500 mt-1">
              {searchQuery ? 'No contacts match your query.' : 'Add your first customer contact to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Quick Actions</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-semibold text-white">
                      {contact.name || <span className="text-slate-500 font-normal">No name</span>}
                      {contact.notes && (
                        <p className="text-[11px] text-slate-blue-400 font-normal truncate max-w-xs">
                          {contact.notes}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="font-mono text-sm text-chart-cyan">
                      {contact.phone_number}
                    </TableCell>

                    <TableCell className="text-xs text-slate-blue-300">
                      {contact.email || <span className="text-slate-600">None</span>}
                    </TableCell>

                    <TableCell className="text-xs text-slate-blue-400">
                      {getRelativeTime(contact.created_at)}
                    </TableCell>

                    {/* Quick Dialer & SMS buttons */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/dialer?number=${encodeURIComponent(contact.phone_number)}`}
                          className="p-1.5 rounded-md bg-accent-success/15 text-accent-success hover:bg-accent-success/30 transition-colors"
                          title="Call via Web Dialer"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/dashboard/inbox?phone=${encodeURIComponent(contact.phone_number)}`}
                          className="p-1.5 rounded-md bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/30 transition-colors"
                          title="Send SMS Message"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(contact)}
                          className="p-1.5 rounded hover:bg-navy-dark-elevated text-slate-blue-400 hover:text-white"
                          title="Edit Contact"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1.5 rounded hover:bg-navy-dark-elevated text-accent-danger hover:text-accent-danger/90"
                          title="Delete Contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {/* Add Contact Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Customer Contact"
      >
        <form onSubmit={handleAddContact} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Jane Doe"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="+254... or 07..."
            helperText="Kenyan or international format"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            required
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="jane@example.com"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
          />

          <div>
            <label className="block text-xs font-medium text-slate-blue-300 mb-1">
              Customer Notes / Reference
            </label>
            <textarea
              placeholder="e.g. VIP client, preferred payment method M-Pesa..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-navy-dark border border-navy-dark-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Contact'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer Contact"
      >
        <form onSubmit={handleEditContact} className="space-y-4">
          <Input
            label="Full Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <Input
            label="Phone Number"
            type="tel"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
          />

          <div>
            <label className="block text-xs font-medium text-slate-blue-300 mb-1">
              Customer Notes / Reference
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-navy-dark border border-navy-dark-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Contact'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
