import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Code2, Loader2, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectSources } from '@/hooks/useProjects';
import { useCancelIngestionOperation, useCancelIngestionRun, useIngestionOperation, useProjectIngestion } from '@/hooks/useIngestion';
import { isIngestionTerminal, isOperationActive } from '@/hooks/ingestionQueries';
import type { IngestionOperation, IngestionPipeline, IngestionRun, PipelineIngestionStatus, Snapshot, SnapshotReadiness } from '@/services/api';
import { useRememberedOperation } from './useRememberedOperation';
import { TriggerIngestionDialog } from './TriggerIngestionDialog';

const pipelineLabel = (pipeline: string) => pipeline === 'source' ? 'Source' : pipeline === 'docs' ? 'Docs' : pipeline === 'both' ? 'Both' : 'Legacy mixed';
const stateLabel = (state: string) => state.replaceAll('_', ' ');
const tone = (state: string) => ['ready', 'succeeded', 'published'].includes(state)
  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  : ['failed', 'unavailable'].includes(state) ? 'border-destructive/20 bg-destructive/5 text-destructive'
  : ['running', 'pending', 'partial', 'partial_success'].includes(state) ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
  : 'bg-muted text-muted-foreground';

function Readiness({ label, value }: { label: string; value?: Omit<SnapshotReadiness, 'state'> & { state: string } }) {
  return <div className="space-y-1"><Badge variant="outline" className={`text-[10px] font-normal ${tone(value?.state ?? 'unknown')}`} title={value?.reason}>
    {label}: {value?.state ?? 'unknown'}
  </Badge>{value?.reason && <p className="text-[10px] text-muted-foreground break-words">{value.reason}</p>}</div>;
}

function RunProgress({ run }: { run: IngestionRun }) {
  const fraction = typeof run.completedUnits === 'number' && typeof run.totalUnits === 'number' && run.totalUnits > 0
    ? Math.min(100, Math.max(0, run.completedUnits / run.totalUnits * 100)) : undefined;
  return <div className="space-y-2 text-[11px]">
    <div className="flex flex-wrap justify-between gap-2 text-muted-foreground"><span>{run.stage || 'Waiting for progress'}</span>
      {run.completedUnits !== undefined && <span>{run.completedUnits} / {run.totalUnits ?? '?'} units</span>}
    </div>
    {fraction !== undefined && <div role="progressbar" aria-label="Ingestion progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction)} className="h-1.5 rounded bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${fraction}%` }} /></div>}
    {run.counters && <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">{Object.entries(run.counters).map(([name, count]) => <span key={name}>{name.replace(/([A-Z])/g, ' $1').toLowerCase()}: <strong className="font-medium text-foreground">{count}</strong></span>)}</div>}
    {run.currentEmbeddingJobState && <p className="text-muted-foreground">Embeddings: {stateLabel(run.currentEmbeddingJobState)}{run.currentEmbeddingCompleted !== undefined ? ` · ${run.currentEmbeddingCompleted} / ${run.currentEmbeddingTotal ?? '?'}` : ''}</p>}
    {run.cancelRequestedAt && run.state === 'running' && <p className="text-amber-600 dark:text-amber-400">Cancellation requested; waiting for the worker to stop.</p>}
    {run.failureReason && <p className="text-destructive break-words">{run.failureReason}</p>}
  </div>;
}

function PipelineLane({ pipeline, status, childState, onCancel, cancelling }: {
  pipeline: IngestionPipeline; status?: PipelineIngestionStatus; childState?: string;
  onCancel: (run: IngestionRun) => void; cancelling: boolean;
}) {
  const Icon = pipeline === 'source' ? Code2 : BookOpen;
  const head = status?.published?.id === status?.headId ? status?.published : undefined;
  const run = status?.activeRun;
  const failedRefresh = status?.latest?.state === 'failed' && status.latest.id !== status.headId;
  const state = run ? 'running' : childState ?? (failedRefresh ? 'failed' : 'idle');
  return <section className={`min-w-0 rounded-lg border p-4 space-y-3 ${pipeline === 'source' ? 'bg-card' : 'bg-muted/20'}`} aria-label={`${pipelineLabel(pipeline)} pipeline status`}>
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{pipelineLabel(pipeline)}</h3>
      <Badge variant="outline" className={`text-[10px] capitalize ${tone(state)}`}>{run && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{stateLabel(state)}</Badge>
    </div>
    <div className="space-y-1 text-xs"><p className="text-muted-foreground">Current publication head</p><code className="block text-[11px] break-all">{status ? status.headId ?? 'No published head' : 'Head unavailable'}</code>
      {head?.publishedAt && <p className="text-[10px] text-muted-foreground">Published {new Date(head.publishedAt).toLocaleString()}</p>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {pipeline === 'source' ? <><Readiness label="Code graph" value={head?.codeGraph} /><Readiness label="Code semantics" value={head?.codeSemantic} /></>
        : <><Readiness label="Document parse" value={head?.documentParse} /><Readiness label="Document semantics" value={head?.documentSemantic} /></>}
    </div>
    {pipeline === 'docs' && head?.documentParse?.counts && <p className="text-[11px] text-muted-foreground">Eligible {head.documentParse.counts.eligible} · captured {head.documentParse.counts.captured} · parsed {head.documentParse.counts.parsed} · embedded {head.documentParse.counts.embedded}</p>}
    {head && (!head.pipeline || head.pipeline === 'mixed') && <p className="text-[10px] text-muted-foreground">Legacy mixed publication; missing readiness remains unknown.</p>}
    {run && <><RunProgress run={run} /><Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={cancelling || !!run.cancelRequestedAt} onClick={() => onCancel(run)}><X className="h-3 w-3" />{run.cancelRequestedAt ? 'Cancellation requested' : `Cancel ${pipelineLabel(pipeline)}`}</Button></>}
    {!run && childState === 'pending' && <p className="text-[11px] text-amber-600 dark:text-amber-400">Queued child · waiting for dispatch. The operation is still active.</p>}
    {failedRefresh && <div className="text-[11px] space-y-1"><p className="text-destructive">Latest refresh failed{status.latest?.failureReason ? `: ${status.latest.failureReason}` : '.'}</p><p className="text-muted-foreground">{status.headId ? 'The previous publication head remains current.' : 'No publication head is available yet.'}</p></div>}
    {status?.latest && <p className="text-[10px] text-muted-foreground break-all">Latest attempt: {status.latest.id} · {status.latest.state}</p>}
  </section>;
}

interface Props { projectCode: string; compact?: boolean }
export function IngestionStatusPanel(props: Props) {
  return <ProjectIngestionStatus key={props.projectCode} {...props} />;
}
function ProjectIngestionStatus({ projectCode, compact }: Props) {
  const { data: status, isPending, error, refetch } = useProjectIngestion(projectCode || undefined);
  const { data: sources, error: sourcesError, isPending: sourcesPending } = useProjectSources(projectCode || undefined);
  const { operationId: rememberedOperationId, remember } = useRememberedOperation(projectCode);
  const activeOperationId = status?.activeOperation?.operationId;
  useEffect(() => { if (activeOperationId && activeOperationId !== rememberedOperationId) remember(activeOperationId); }, [activeOperationId, rememberedOperationId, remember]);
  const cancelOperation = useCancelIngestionOperation();
  const cancelRun = useCancelIngestionRun();
  const [actionError, setActionError] = useState<string>();
  const [selectedOperation, setSelectedOperation] = useState<{ id: string; rememberedAtSelection?: string }>();
  const [retry, setRetry] = useState<{ operationId: string; pipeline: IngestionPipeline }>();
  const runs = useMemo(() => [...new Map([...(status?.runs ?? []), ...Object.values(status?.pipelines ?? {}).flatMap(item => item.runs)].map(run => [run.id, run])).values()]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [status]);
  const selectedOperationId = selectedOperation?.rememberedAtSelection === rememberedOperationId ? selectedOperation?.id : undefined;
  const operationId = activeOperationId ?? selectedOperationId ?? rememberedOperationId ?? runs.find(run => run.operationId)?.operationId;
  const { data: fetchedOperation, error: operationError } = useIngestionOperation(projectCode || undefined, operationId);
  const activeOperation = status?.activeOperation;
  const operation = activeOperation?.operationId === operationId ? fetchedOperation ?? activeOperation : fetchedOperation;
  const busy = Boolean(status?.activeOperation && isOperationActive(status.activeOperation)) || Boolean(status?.activeRun) || Object.values(status?.pipelines ?? {}).some(item => !!item.activeRun);
  const invoke = async (action: () => Promise<unknown>) => {
    setActionError(undefined);
    try { await action(); } catch (error) { setActionError(error instanceof Error ? error.message : 'Ingestion action failed.'); }
  };
  if (!projectCode) return null;
  if (isPending) return <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (error) return <div role="alert" className="rounded-lg border border-destructive/20 p-4 text-xs text-destructive">Could not load ingestion status: {error.message}<Button variant="link" size="sm" onClick={() => refetch()}>Retry status</Button></div>;
  return <div className="space-y-3" aria-label="Project ingestion status">
    {!sourcesPending && !sourcesError && !sources?.length && <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No registered inputs. Register a local directory to start Source or Docs ingestion.</div>}
    {sourcesError && <p role="alert" className="text-xs text-destructive">Could not load registered inputs: {sourcesError.message}</p>}
    <div className={`grid gap-3 ${compact ? '' : 'lg:grid-cols-[1.15fr_1fr]'}`}>
      {(['source', 'docs'] as const).map(pipeline => <PipelineLane key={pipeline} pipeline={pipeline} status={status?.pipelines?.[pipeline]} childState={status?.activeOperation?.children.find(child => child.pipeline === pipeline)?.state} onCancel={run => invoke(() => cancelRun.mutateAsync({ code: projectCode, runId: run.id }))} cancelling={cancelRun.isPending} />)}
    </div>
    {!status?.pipelines && <p className="text-xs text-muted-foreground">Pipeline status is unavailable from this server. Singleton snapshot aliases cannot establish independent heads.</p>}
    {status?.activeRun?.executionKind === 'legacy_mixed' && <div className="rounded-lg border p-3 text-xs space-y-2"><p>Legacy mixed ingestion is running.</p><RunProgress run={status.activeRun} /><Button variant="outline" size="sm" disabled={cancelRun.isPending || !!status.activeRun.cancelRequestedAt} onClick={() => invoke(() => cancelRun.mutateAsync({ code: projectCode, runId: status.activeRun!.id }))}>Cancel legacy run</Button></div>}
    {operationId && !operation && !operationError && <p role="status" className="text-xs text-muted-foreground">Loading operation {operationId}…</p>}
    {operationError && <p role="alert" className="text-xs text-destructive">Could not load operation {operationId}: {operationError.message}</p>}
    {operation && <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs space-y-1"><p className="font-semibold">{pipelineLabel(operation.target)} operation · {stateLabel(operation.state)}</p><code className="text-[10px] text-muted-foreground break-all">{operation.operationId}</code></div>
        {isOperationActive(operation) && <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={cancelOperation.isPending || !!operation.cancelRequestedAt} onClick={() => invoke(() => cancelOperation.mutateAsync({ code: projectCode, operationId: operation.operationId }))}><X className="h-3 w-3" />{operation.cancelRequestedAt ? 'Cancellation requested' : operation.target === 'both' ? 'Cancel Both' : 'Cancel operation'}</Button>}
      </div>
      {operation.state === 'partial_success' && <p className="text-xs text-amber-600 dark:text-amber-400">Partial success: the successful child is published; the other pipeline keeps its previous head.</p>}
      {operation.cancelRequestedAt && isOperationActive(operation) && <p className="text-[11px] text-amber-600 dark:text-amber-400">Cancellation requested. Running work is stopping and pending children will be cancelled.</p>}
      <div className="divide-y">{operation.children.map(child => <div key={child.id} className="py-2 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 text-xs"><div className="flex items-center gap-2"><span className="font-medium">{pipelineLabel(child.pipeline)}</span><Badge variant="outline" className={`text-[10px] capitalize ${tone(child.state)}`}>{child.state}</Badge></div>
          <p className="text-[10px] text-muted-foreground break-all">{child.runId ? `Run ${child.runId}` : child.state === 'pending' ? 'Pending dispatch · no run yet' : 'No run'}{child.snapshotId ? ` · Snapshot ${child.snapshotId}` : ''}</p>
          {child.failureReason && <p className="text-[11px] text-destructive break-words">{child.failureReason}</p>}
        </div>
        {['failed', 'cancelled'].includes(child.state) && child.pipeline !== 'mixed' && isIngestionTerminal(operation.state) && <Button size="sm" variant="outline" disabled={busy} className="h-7 text-[11px] gap-1" onClick={() => setRetry({ operationId: operation.operationId, pipeline: child.pipeline as IngestionPipeline })}><RotateCcw className="h-3 w-3" />Retry {pipelineLabel(child.pipeline)}</Button>}
      </div>)}</div>
      <p className="text-[10px] text-muted-foreground">{operation.options.requireSemantic ? 'Source semantics required' : 'Source semantics optional'} · {operation.options.requireDocumentSemantic ? 'Docs semantics required' : 'Docs semantics optional'}{operation.retryOfOperationId ? ` · Retry of ${operation.retryOfOperationId}` : ''}</p>
    </div>}
    {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
    {runs.length > 0 && <details className="rounded-lg border bg-card p-3" open={compact ? undefined : true}><summary className="cursor-pointer text-xs font-semibold">Recent ingestion runs ({runs.length})</summary><div className="mt-3 space-y-3">{runs.slice(0, compact ? 5 : 10).map(run => <div key={run.id} className="border-t pt-2 space-y-1.5 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2"><span>{pipelineLabel(run.executionKind ?? 'legacy_mixed')} · <span className={run.state === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>{run.state}</span></span><time className="text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</time></div>
      <code className="block text-[10px] text-muted-foreground break-all">Run {run.id} · Snapshot {run.snapshotId}</code><RunProgress run={run} />
      {run.operationId && <Button size="sm" variant="link" className="h-6 p-0 text-[11px]" disabled={!!activeOperationId && activeOperationId !== run.operationId} onClick={() => setSelectedOperation({ id: run.operationId!, rememberedAtSelection: rememberedOperationId })}>View operation{run.operationId === operationId ? ' (selected)' : ''}</Button>}
    </div>)}</div></details>}
    <TriggerIngestionDialog open={!!retry} onOpenChange={open => { if (!open) setRetry(undefined); }} projectCode={projectCode} pipeline={retry?.pipeline ?? 'source'} retryOfOperationId={retry?.operationId} onSuccess={() => setSelectedOperation(undefined)} />
  </div>;
}
