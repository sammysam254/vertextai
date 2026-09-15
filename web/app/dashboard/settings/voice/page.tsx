import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Mic } from 'lucide-react';

export default function VoiceSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Mic className="h-8 w-8 text-chart-teal" />
        <div>
          <h1 className="text-3xl font-bold text-white">Voice Models</h1>
          <p className="text-slate-blue-400 mt-1">
            Configure text-to-speech voices
          </p>
        </div>
      </div>

      <Panel className="p-6 space-y-6">
        <Select
          label="Voice Model"
          options={[
            { value: 'Polly.Joanna', label: 'Joanna (US English, Female)' },
            { value: 'Polly.Matthew', label: 'Matthew (US English, Male)' },
            { value: 'Polly.Amy', label: 'Amy (UK English, Female)' },
            { value: 'Polly.Brian', label: 'Brian (UK English, Male)' },
          ]}
          defaultValue="Polly.Joanna"
          helperText="Twilio Polly Neural voices"
        />

        <div className="pt-4 border-t border-navy-dark-border">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="enable-elevenlabs"
              className="w-4 h-4 rounded bg-navy-dark border-navy-dark-border text-accent-primary focus:ring-accent-primary"
            />
            <label htmlFor="enable-elevenlabs" className="text-sm font-medium text-white">
              Enable ElevenLabs Premium TTS (Optional)
            </label>
          </div>
          <Input
            label="ElevenLabs Voice ID"
            placeholder="voice_id_here"
            helperText="Find voice IDs in your ElevenLabs dashboard"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-dark-border">
          <Button variant="secondary">Test Voice</Button>
          <Button variant="primary">Save Changes</Button>
        </div>
      </Panel>
    </div>
  );
}
