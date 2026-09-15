import { Panel } from '@/components/ui/Panel';

export default function WorkspacePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My Workspace</h1>
        <p className="text-slate-blue-400">
          Personalized dashboard and quick actions
        </p>
      </div>

      <Panel className="p-6">
        <p className="text-slate-blue-300">
          Workspace features coming soon...
        </p>
      </Panel>
    </div>
  );
}
