import { Badge } from '@/components/ui/badge';
import type { Snapshot } from '@/services/api';
import { snapshotReadinessRows } from './snapshotReadiness';

export function SnapshotReadinessDisplay({ snapshot, compact = false, showPipeline = true }: { snapshot: Snapshot; compact?: boolean; showPipeline?: boolean }) {
  const pipeline = snapshot.pipeline === 'source' ? 'Source' : snapshot.pipeline === 'docs' ? 'Docs'
    : snapshot.pipeline === 'mixed' ? 'Legacy mixed' : 'Unknown (legacy snapshot)';
  return <div className="space-y-2">
    {showPipeline && <p className="text-[11px] text-muted-foreground">Pipeline: {pipeline}</p>}
    <div className={compact ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
      {snapshotReadinessRows(snapshot).map(({ label, readiness }) => <div key={label} className="min-w-0 space-y-1">
        <Badge variant="outline" className="text-[10px] font-normal" title={readiness?.reason}>
          {label}: {readiness?.state ?? 'unknown'}
        </Badge>
        {!compact && readiness?.reason && <p className="text-[11px] text-muted-foreground break-words">{readiness.reason}</p>}
      </div>)}
    </div>
    {!compact && snapshot.pipeline !== 'source' && snapshot.pipeline !== 'docs' && <p className="text-[11px] text-muted-foreground">Missing legacy readiness is unknown.</p>}
  </div>;
}
