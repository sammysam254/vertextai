'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Send, Plus, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getRelativeTime, formatPhoneNumber } from '@/lib/utils';

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

const initialConversations: Conversation[] = [
  {
    id: '1',
    contactName: 'John Smith',
    contactPhone: '+15550123',
    lastMessage: 'Thanks for your help with the order!',
    unreadCount: 0,
    timestamp: new Date(Date.now() - 120000).toISOString(),
    messages: [
      {
        id: '1',
        sender: 'customer',
        body: 'Hello, I have a question about my recent order',
        timestamp: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: '2',
        sender: 'ai',
        body: "Hi! I'd be happy to help you with your order. Could you please provide your order number?",
        timestamp: new Date(Date.now() - 240000).toISOString(),
      },
      {
        id: '3',
        sender: 'customer',
        body: "It's order #12345",
        timestamp: new Date(Date.now() - 180000).toISOString(),
      },
      {
        id: '4',
        sender: 'ai',
        body: 'Thank you! Your order #12345 was shipped and should arrive within 2-3 business days.',
        timestamp: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: '5',
        sender: 'customer',
        body: 'Thanks for your help with the order!',
        timestamp: new Date(Date.now() - 60000).toISOString(),
      },
    ],
  },
  {
    id: '2',
    contactName: 'Sarah Johnson',
    contactPhone: '+15550456',
    lastMessage: 'When will my package arrive?',
    unreadCount: 1,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    messages: [
      {
        id: '1',
        sender: 'customer',
        body: 'When will my package arrive?',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  },
];

export default function InboxPage() {
  const [conversationsList, setConversationsList] = useState<Conversation[]>(initialConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation>(initialConversations[0]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New message modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newModalError, setNewModalError] = useState('');
  const [newModalSuccess, setNewModalSuccess] = useState('');

  const sendSmsRequest = async (to: string, body: string) => {
    const formattedTo = formatPhoneNumber(to);
    let endpoint = '/api/v1/sms/outbound';
    if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
      endpoint = `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/sms/outbound`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: formattedTo,
        body,
        from: process.env.NEXT_PUBLIC_TWILIO_PHONE || '+12513571708',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send SMS');
    }
    return { data, formattedTo };
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;

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
        id: String(Date.now()),
        contactName: null,
        contactPhone: formattedTo,
        lastMessage: newBody.trim(),
        unreadCount: 0,
        timestamp: new Date().toISOString(),
        messages: [newMessage],
      };

      setConversationsList((prev) => [newConversation, ...prev]);
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Inbox</h1>
          <p className="text-slate-blue-400">SMS conversations and message history</p>
        </div>
        <Button variant="primary" onClick={() => setIsNewModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New SMS
        </Button>
      </div>

      {/* Two-Pane Layout */}
      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-240px)]">
        {/* Contact Thread List */}
        <Panel className="lg:col-span-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-navy-dark-border">
            <input
              type="search"
              placeholder="Search conversations..."
              className="input w-full"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsList.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedConversation(conv);
                  setStatusMessage(null);
                }}
                className={`w-full p-4 border-b border-navy-dark-border text-left hover:bg-navy-dark-elevated transition-colors ${
                  selectedConversation.id === conv.id ? 'bg-navy-dark-elevated' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    size="md"
                    fallback={conv.contactName || conv.contactPhone}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-white truncate">
                        {conv.contactName || conv.contactPhone}
                      </p>
                      <span className="text-xs text-slate-blue-500">
                        {getRelativeTime(conv.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-blue-400 truncate">
                      {conv.lastMessage}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge variant="in-call" className="!px-2">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Panel>

        {/* Message Stream */}
        <Panel className="lg:col-span-2 overflow-hidden flex flex-col">
          {/* Conversation Header */}
          <div className="p-4 border-b border-navy-dark-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar
                size="md"
                fallback={
                  selectedConversation.contactName ||
                  selectedConversation.contactPhone
                }
              />
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedConversation.contactName ||
                    selectedConversation.contactPhone}
                </p>
                <p className="text-xs text-slate-blue-400 font-mono">
                  {selectedConversation.contactPhone}
                </p>
              </div>
            </div>
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`mx-4 mt-3 p-3 rounded-md text-sm flex items-start gap-2 ${
                statusMessage.type === 'error'
                  ? 'bg-accent-danger/10 border border-accent-danger/30 text-accent-danger'
                  : 'bg-accent-success/10 border border-accent-success/30 text-accent-success'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
              <span className="flex-1">{statusMessage.text}</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedConversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === 'customer' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.sender === 'customer'
                      ? 'bg-navy-dark-elevated'
                      : 'bg-accent-primary'
                  }`}
                >
                  <p
                    className={`text-sm ${
                      message.sender === 'customer'
                        ? 'text-slate-blue-100'
                        : 'text-white'
                    }`}
                  >
                    {message.body}
                  </p>
                  <div className="flex items-center justify-between mt-2 gap-4">
                    <span
                      className={`text-xs ${
                        message.sender === 'customer'
                          ? 'text-slate-blue-500'
                          : 'text-white/70'
                      }`}
                    >
                      {message.sender === 'ai' ? 'Vertex AI' : 'Customer'}
                    </span>
                    <span
                      className={`text-xs ${
                        message.sender === 'customer'
                          ? 'text-slate-blue-500'
                          : 'text-white/70'
                      }`}
                    >
                      {getRelativeTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Input */}
          <div className="p-4 border-t border-navy-dark-border">
            <div className="flex gap-3">
              <Textarea
                placeholder="Type your message..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                className="flex-1 !min-h-[60px]"
                disabled={isSending}
              />
              <Button
                variant="primary"
                className="self-end"
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSending}
              >
                <Send className="h-4 w-4" />
                {isSending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
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
        title="New SMS Message"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-blue-300 mb-1">
              Recipient Phone Number
            </label>
            <input
              type="tel"
              placeholder="e.g. 0706499848 or +254706499848"
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                setNewModalError('');
              }}
              className="input w-full font-mono"
            />
            <p className="text-xs text-slate-blue-400 mt-1">
              Kenyan numbers (07... / 01...) and international numbers (+...) are automatically formatted.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-blue-300 mb-1">
              Message
            </label>
            <Textarea
              placeholder="Type your SMS message here..."
              value={newBody}
              onChange={(e) => {
                setNewBody(e.target.value);
                setNewModalError('');
              }}
              rows={4}
              className="w-full"
            />
          </div>

          {newModalError && (
            <div className="p-3 bg-accent-danger/10 border border-accent-danger/30 rounded-md text-accent-danger text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{newModalError}</span>
            </div>
          )}

          {newModalSuccess && (
            <div className="p-3 bg-accent-success/10 border border-accent-success/30 rounded-md text-accent-success text-sm flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{newModalSuccess}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setIsNewModalOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSendNewMessage}
              disabled={!newPhone.trim() || !newBody.trim() || isSending}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Send SMS'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
