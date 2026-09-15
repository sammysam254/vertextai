'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Search, Plus, Edit2, Trash2, Upload } from 'lucide-react';
import { getRelativeTime } from '@/lib/utils';

export default function ContactsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const contacts = [
    {
      id: '1',
      name: 'John Smith',
      phoneNumber: '+1 555-0123',
      email: 'john.smith@email.com',
      lastContactedAt: new Date(Date.now() - 3600000).toISOString(),
      totalInteractions: 15,
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      phoneNumber: '+1 555-0456',
      email: 'sarah.j@email.com',
      lastContactedAt: new Date(Date.now() - 7200000).toISOString(),
      totalInteractions: 8,
    },
    {
      id: '3',
      name: 'Mike Davis',
      phoneNumber: '+1 555-0789',
      email: null,
      lastContactedAt: new Date(Date.now() - 14400000).toISOString(),
      totalInteractions: 23,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Contacts</h1>
          <p className="text-slate-blue-400">Manage customer contact information</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Panel className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-blue-500" />
          <input
            type="search"
            placeholder="Search by name, phone, or email..."
            className="input pl-10"
          />
        </div>
      </Panel>

      {/* Contacts Table */}
      <Panel className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead>Interactions</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">{contact.name}</TableCell>
                <TableCell className="font-mono text-sm">{contact.phoneNumber}</TableCell>
                <TableCell className="text-sm">
                  {contact.email || (
                    <span className="text-slate-blue-500">No email</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {getRelativeTime(contact.lastContactedAt)}
                </TableCell>
                <TableCell className="tabular-nums">{contact.totalInteractions}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedContact(contact);
                        setIsEditModalOpen(true);
                      }}
                      className="p-1 rounded hover:bg-navy-dark-elevated text-slate-blue-400 hover:text-white"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button className="p-1 rounded hover:bg-navy-dark-elevated text-accent-danger hover:text-accent-danger">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* Add Contact Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Contact"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary">Add Contact</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" placeholder="John Doe" required />
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+1 555-0000"
            helperText="E.164 format (e.g., +1 555-0000)"
            required
          />
          <Input label="Email" type="email" placeholder="john@example.com" />
        </div>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Contact"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary">Save Changes</Button>
          </>
        }
      >
        {selectedContact && (
          <div className="space-y-4">
            <Input label="Name" defaultValue={selectedContact.name} required />
            <Input
              label="Phone Number"
              type="tel"
              defaultValue={selectedContact.phoneNumber}
              required
            />
            <Input
              label="Email"
              type="email"
              defaultValue={selectedContact.email || ''}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
