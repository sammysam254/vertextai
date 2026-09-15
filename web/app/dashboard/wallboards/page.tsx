import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';

export default function WallboardsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-white">Wallboards</h1>
        <Badge variant="default">NEW</Badge>
      </div>
      <p className="text-slate-blue-400">
        Full-screen performance dashboards for team visibility
      </p>

      <Panel className="p-6">
        <p className="text-slate-blue-300">
          Wallboard displays coming soon...
        </p>
      </Panel>
    </div>
  );
}
