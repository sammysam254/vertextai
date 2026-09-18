'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Send, Plus, MessageSquare, AlertCircle, CheckCircle2, Phone } from 'lucide-react';
import { getRelativeTime, formatPhoneNumber, getApiEndpoint } from '@/lib/utils';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CallPulseLoader } from '@/components/ui/CallPulseLoader';

interface Message {
  id: string;
  sender: 'customer' | 'ai';
  body: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  contactName: string | null;
  contactPhone: string;
  lastMessage: string;
  unreadCount: number;
  timestamp: string;
  messages: Message[];
}

export default function InboxPage() {
  const { organizationId, merchantCode } = useOrganization();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const prefillPhone = searchParams.get('phone') || '';

  const [conversationsList, setConversationsList] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New message modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState(prefillPhone);
  const [newBody, setNewBody] = useState('');
  const [newModalError, setNewModalError] = useState('');
  const [newModalSuccess, setNewModalSuccess] = useState('');

  // Load real SMS messages from database
  const loadConversations = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      // 1. Fetch SMS communications
      const { data: comms, error } = await supabase
        .from('communications')
        .select('id, type, from_number, to_number, summary, status, created_at')
        .eq('organization_id', organizationId)
        .in('type', ['sms_in', 'sms_out'])
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Communications query error (fallback to empty):', error.message);
        setConversationsList([]);
        setSelectedConversation(null);
        setLoading(false);
        return;
      }

      if (!comms || comms.length === 0) {
        setConversationsList([]);
        setSelectedConversation(null);
        setLoading(false);
        return;
      }

      // 2. Group into threads by customer phone number
      const threadMap: { [phone: string]: Conversation } = {};

      for (const c of comms) {
        const isInbound = c.type === 'sms_in';
        const customerPhone = isInbound ? c.from_number : c.to_number;
        if (!customerPhone) continue;

        const contactName = null;
        const msgBody = (c as any).summary || (isInbound ? 'Inbound message' : 'Outbound message');

        const messageObj: Message = {
          id: c.id,
          sender: isInbound ? 'customer' : 'ai',
          body: msgBody,
          timestamp: c.created_at,
        };

        if (!threadMap[customerPhone]) {
          threadMap[customerPhone] = {
            id: customerPhone,
            contactName,
            contactPhone: customerPhone,
            lastMessage: msgBody,
            unreadCount: 0,
            timestamp: c.created_at,
            messages: [messageObj],
          };
        } else {
          threadMap[customerPhone].messages.push(messageObj);
          threadMap[customerPhone].lastMessage = msgBody;
          threadMap[customerPhone].timestamp = c.created_at;
          if (contactName && !threadMap[customerPhone].contactName) {
            threadMap[customerPhone].contactName = contactName;
          }
        }
      }

      const threads = Object.values(threadMap).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setConversationsList(threads);

      // Keep selection or select first
      if (threads.length > 0) {
        setSelectedConversation((prev) => {
          if (!prev) return threads[0];
          const found = threads.find((t) => t.id === prev.id);
          return found || threads[0];
        });
      }
    } catch (err) {
      console.error('Error loading SMS communications:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, supabase]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (prefillPhone) {
      setNewPhone(prefillPhone);
      setIsNewModalOpen(true);
    }
  }, [prefillPhone]);

  const sendSmsRequest = async (to: string, body: string) => {
    const formattedTo = formatPhoneNumber(to);
    const endpoint = getApiEndpoint('/api/v1/sms/outbound');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formattedTo,
          body,
          from: process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708',
          organizationId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `Failed to send SMS (Status ${res.status})`);
      }
      return { data, formattedTo };
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('Network error: Could not reach SMS service. Please verify your connection.');
      }
      throw err;
    }
  };

  const handleSendReply = async () => {
    if (!selectedConversation || !replyText.trim() || isSending) return;

    setIsSending(true);
    setStatusMessage(null);

    try {
      await sendSmsRequest(selectedConversation.contactPhone, replyText);

      const newMessage: Message = {
        id: String(Date.now()),
        sender: 'ai',
        body: replyText.trim(),
        timestamp: new Date().toISOString(),
      };

      const updatedConv: Conversation = {
        ...selectedConversation,
        lastMessage: replyText.trim(),
        timestamp: new Date().toISOString(),
        messages: [...selectedConversation.messages, newMessage],
      };

      setSelectedConversation(updatedConv);
      setConversationsList((prev) =>
        prev.map((c) => (c.id === updatedConv.id ? updatedConv : c))
      );
      setReplyText('');
      setStatusMessage({ type: 'success', text: 'SMS sent successfully!' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to send SMS.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendNewMessage = async () => {
    if (!newPhone.trim() || !newBody.trim() || isSending) return;

    setIsSending(true);
    setNewModalError('');
    setNewModalSuccess('');

    try {
      const { formattedTo } = await sendSmsRequest(newPhone, newBody);

      const newMessage: Message = {
        id: String(Date.now()),
        sender: 'ai',
        body: newBody.trim(),
        timestamp: new Date().toISOString(),
      };

      const newConversation: Conversation = {
        id: formattedTo,
        contactName: null,
        contactPhone: formattedTo,
        lastMessage: newBody.trim(),
        unreadCount: 0,
        timestamp: new Date().toISOString(),
        messages: [newMessage],
      };

      setConversationsList((prev) => [newConversation, ...prev.filter((c) => c.id !== formattedTo)]);
      setSelectedConversation(newConversation);
      setNewModalSuccess('SMS sent successfully!');
      setTimeout(() => {
        setIsNewModalOpen(false);
        setNewPhone('');
        setNewBody('');
        setNewModalSuccess('');
      }, 1500);
    } catch (err: any) {
      setNewModalError(err.message || 'Failed to send SMS.');
    } finally {
      setIsSending(false);
    }
  };

  // Filter conversations
  const filteredThreads = conversationsList.filter((conv) => {
    const q = searchQuery.toLowerCase();
    return (
      conv.contactPhone.toLowerCase().includes(q) ||
      (conv.contactName && conv.contactName.toLowerCase().includes(q)) ||
      conv.lastMessage.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">SMS Inbox</h1>
          <p className="text-xs sm:text-sm text-slate-blue-400">
            SMS conversations &amp; messaging for merchant code <span className="font-mono text-white font-bold">{merchantCode}</span>
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsNewModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New SMS
        </Button>
      </div>

      {/* Two-Pane Layout */}
      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
        {/* Contact Thread List */}
        <Panel className="lg:col-span-1 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-navy-dark-border">
            <input
              type="search"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-navy-dark-border">
            {loading ? (
              <div className="py-8">
                <CallPulseLoader size="sm" text="Loading conversations..." />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-slate-blue-400">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30 text-accent-primary" />
                <p className="text-sm font-medium text-white">No SMS messages yet</p>
                <p className="text-xs text-slate-blue-500 mt-1">
                  Click 'New SMS' to start a conversation with a customer.
                </p>
              </div>
            ) : (
              filteredThreads.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv);
                    setStatusMessage(null);
                  }}
                  className={`w-full p-3.5 text-left hover:bg-navy-dark-elevated transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-navy-dark-elevated border-l-2 border-accent-primary' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar size="md" fallback={conv.contactName || conv.contactPhone} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs sm:text-sm font-semibold text-white truncate">
                          {conv.contactName || conv.contactPhone}
                        </p>
                        <span className="text-[10px] text-slate-blue-500 shrink-0 ml-1">
                          {getRelativeTime(conv.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-blue-400 truncate">{conv.lastMessage}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Panel>

        {/* Message Stream */}
        <Panel className="lg:col-span-2 overflow-hidden flex flex-col">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-navy-dark-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    size="md"
                    fallback={selectedConversation.contactName || selectedConversation.contactPhone}
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedConversation.contactName || 'Customer'}
                    </p>
                    <p className="text-xs text-chart-cyan font-mono">
                      {selectedConversation.contactPhone}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/dashboard/dialer?number=${encodeURIComponent(selectedConversation.contactPhone)}`}
                  className="btn btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5 bg-navy-dark-elevated hover:bg-navy-dark text-white rounded-lg border border-navy-dark-border"
                >
                  <Phone className="h-3.5 w-3.5 text-accent-success" />
                  Call Customer
                </Link>
              </div>

              {/* Status Alert */}
              {statusMessage && (
                <div
                  className={`mx-4 mt-3 p-2.5 rounded-md text-xs flex items-center gap-2 ${
                    statusMessage.type === 'error'
                      ? 'bg-accent-danger/10 border border-accent-danger/30 text-accent-danger'
                      : 'bg-accent-success/10 border border-accent-success/30 text-accent-success'
                  }`}
                >
                  {statusMessage.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'customer' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl p-3 shadow-md ${
                        message.sender === 'customer'
                          ? 'bg-navy-dark-elevated border border-navy-dark-border text-slate-100'
                          : 'bg-accent-primary text-white'
                      }`}
                    >
                      <p className="text-xs sm:text-sm whitespace-pre-wrap">{message.body}</p>
                      <div className="flex items-center justify-between mt-1.5 gap-3 text-[10px] opacity-70">
                        <span>{message.sender === 'ai' ? 'You' : 'Customer'}</span>
                        <span>{getRelativeTime(message.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Input */}
              <div className="p-3 border-t border-navy-dark-border bg-navy-dark-panel">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type SMS reply... (Press Enter to send)"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    className="flex-1 !min-h-[50px] text-xs sm:text-sm"
                    disabled={isSending}
                  />
                  <Button
                    variant="primary"
                    className="self-end h-10 px-4 bg-accent-primary text-white text-xs"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isSending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {isSending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-blue-400">
              <MessageSquare className="h-12 w-12 opacity-20 text-accent-primary mb-3" />
              <h3 className="text-base font-semibold text-white">Select a Conversation</h3>
              <p className="text-xs text-slate-blue-500 mt-1 max-w-sm">
                Choose a customer thread from the left or click 'New SMS' to start messaging.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* New Message Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setNewModalError('');
          setNewModalSuccess('');
        }}
        title="Send New SMS Message"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-blue-300 mb-1">
              Recipient Phone Number
            </label>
            <input
              type="tel"
              placeholder="+254706499848 or 0706499848"
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                setNewModalError('');
              }}
              className="input w-full font-mono text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-blue-300 mb-1">
              Message Content
            </label>
            <Textarea
              placeholder="Type your SMS message here..."
              value={newBody}
              onChange={(e) => {
                setNewBody(e.target.value);
                setNewModalError('');
              }}
              rows={4}
              className="w-full text-xs sm:text-sm"
            />
          </div>

          {newModalError && (
            <div className="p-2.5 bg-accent-danger/20 border border-accent-danger/30 rounded-lg text-accent-danger text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{newModalError}</span>
            </div>
          )}

          {newModalSuccess && (
            <div className="p-2.5 bg-accent-success/20 border border-accent-success/30 rounded-lg text-accent-success text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{newModalSuccess}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsNewModalOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendNewMessage}
              disabled={!newPhone.trim() || !newBody.trim() || isSending}
            >
              <Send className="h-4 w-4 mr-1.5" />
              {isSending ? 'Sending...' : 'Send SMS'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
