'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Send } from 'lucide-react';
import { getRelativeTime, truncate } from '@/lib/utils';

const conversations = [
  {
    id: '1',
    contactName: 'John Smith',
    contactPhone: '+1 555-0123',
    lastMessage: 'Thanks for your help with the order!',
    unreadCount: 2,
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: '2',
    contactName: 'Sarah Johnson',
    contactPhone: '+1 555-0456',
    lastMessage: 'When will my package arrive?',
    unreadCount: 1,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    contactName: null,
    contactPhone: '+1 555-0789',
    lastMessage: 'Hello, I need assistance',
    unreadCount: 0,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
];

const messages = [
  {
    id: '1',
    sender: 'customer' as const,
    body: 'Hello, I have a question about my recent order',
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: '2',
    sender: 'ai' as const,
    body: 'Hi! I\'d be happy to help you with your order. Could you please provide your order number?',
    timestamp: new Date(Date.now() - 240000).toISOString(),
  },
  {
    id: '3',
    sender: 'customer' as const,
    body: 'It\'s order #12345',
    timestamp: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: '4',
    sender: 'ai' as const,
    body: 'Thank you! Let me look that up for you. Your order #12345 was shipped yesterday and should arrive within 2-3 business days.',
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: '5',
    sender: 'customer' as const,
    body: 'Thanks for your help with the order!',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
];

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);
  const [replyText, setReplyText] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Inbox</h1>
        <p className="text-slate-blue-400">SMS conversations and message history</p>
      </div>

      {/* Two-Pane Layout */}
      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-240px)]">
        {/* Contact Thread List */}
        <Panel className="lg:col-span-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-navy-dark-border">
            <input
              type="search"
              placeholder="Search conversations..."
              className="input"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
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
          <div className="p-4 border-b border-navy-dark-border">
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
                {selectedConversation.contactName && (
                  <p className="text-xs text-slate-blue-400 font-mono">
                    {selectedConversation.contactPhone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
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
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`text-xs ${
                        message.sender === 'customer'
                          ? 'text-slate-blue-500'
                          : 'text-white/70'
                      }`}
                    >
                      {message.sender === 'ai' ? 'AI Agent' : 'Customer'}
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
                className="flex-1 !min-h-[60px]"
              />
              <Button variant="primary" className="self-end">
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
