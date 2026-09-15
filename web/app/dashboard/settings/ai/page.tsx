'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Brain } from 'lucide-react';

export default function AISettingsPage() {
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a professional call center assistant. Be helpful, concise, and friendly. Always maintain a professional tone and help customers resolve their issues efficiently.'
  );
  const [model, setModel] = useState('llama-3.1-8b-instant');
  const [temperature, setTemperature] = useState(0.7);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-accent-primary" />
        <div>
          <h1 className="text-3xl font-bold text-white">AI Configuration</h1>
          <p className="text-slate-blue-400 mt-1">
            Customize AI behavior and model settings
          </p>
        </div>
      </div>

      <Panel className="p-6 space-y-6">
        <Textarea
          label="System Prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          helperText="Instructions that guide the AI's behavior and personality"
        />

        <Select
          label="AI Model"
          options={[
            { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Fast)' },
            { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile (Accurate)' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fallback)' },
          ]}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          helperText="Select the AI model for voice and SMS responses"
        />

        <div>
          <label className="block text-sm font-medium text-slate-blue-300 mb-2">
            Temperature: {temperature}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-2 bg-navy-dark-elevated rounded-lg appearance-none cursor-pointer accent-accent-primary"
          />
          <p className="mt-2 text-sm text-slate-blue-500">
            Higher values make output more creative, lower values more focused
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-dark-border">
          <Button variant="secondary">Reset to Defaults</Button>
          <Button variant="primary">Save Changes</Button>
        </div>
      </Panel>
    </div>
  );
}
