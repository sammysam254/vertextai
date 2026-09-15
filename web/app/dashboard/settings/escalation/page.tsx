'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, X } from 'lucide-react';

export default function EscalationSettingsPage() {
  const [keywords, setKeywords] = useState([
    'manager',
    'supervisor',
    'human',
    'agent',
    'representative',
    'escalate',
  ]);
  const [newKeyword, setNewKeyword] = useState('');

  const handleAddKeyword = () => {
    if (newKeyword && !keywords.includes(newKeyword.toLowerCase())) {
      setKeywords([...keywords, newKeyword.toLowerCase()]);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-8 w-8 text-accent-warning" />
        <div>
          <h1 className="text-3xl font-bold text-white">Escalation Rules</h1>
          <p className="text-slate-blue-400 mt-1">
            Configure call escalation to human agents
          </p>
        </div>
      </div>

      <Panel className="p-6 space-y-6">
        <Input
          label="Escalation Phone Number"
          type="tel"
          placeholder="+1 555-0100"
          helperText="Calls will be transferred to this number when escalated"
        />

        <div>
          <label className="block text-sm font-medium text-slate-blue-300 mb-2">
            Escalation Keywords
          </label>
          <p className="text-sm text-slate-blue-500 mb-4">
            AI will escalate calls when customers use these words
          </p>

          {/* Keyword Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {keywords.map((keyword) => (
              <Badge
                key={keyword}
                variant="default"
                className="!px-3 !py-1.5 flex items-center gap-2"
              >
                <span>{keyword}</span>
                <button
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="hover:text-accent-danger"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Add Keyword Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              placeholder="Add keyword..."
              className="input flex-1"
            />
            <Button variant="secondary" onClick={handleAddKeyword}>
              Add
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-dark-border">
          <Button variant="secondary">Test Escalation</Button>
          <Button variant="primary">Save Rules</Button>
        </div>
      </Panel>
    </div>
  );
}
