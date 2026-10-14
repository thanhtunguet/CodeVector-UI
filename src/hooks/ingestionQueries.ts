import type { QueryClient } from '@tanstack/react-query';
import type { IngestionOperation, IngestionStatus, SnapshotPipeline } from '@/services/api';

export const ingestionKeys = {
  status: (code: string | undefined) => ['projects', code, 'ingestion'] as const,
  pipeline: (code: string | undefined, pipeline: string) => ['projects', code, 'ingestion', 'pipeline', pipeline] as const,
  operation: (code: string | undefined, operationId: string | undefined) =>
    ['projects', code, 'ingestion', 'operations', operationId] as const,
  snapshots: (code: string | undefined, pipeline?: SnapshotPipeline) =>
    pipeline ? ['projects', code, 'snapshots', 'pipeline', pipeline] as const
      : ['projects', code, 'snapshots'] as const,
};

export function isIngestionTerminal(state: string): boolean {
  return ['succeeded', 'failed', 'cancelled', 'partial_success'].includes(state);
}

export function isOperationActive(operation?: Pick<IngestionOperation, 'state' | 'children'> | null): boolean {
  return Boolean(operation && (!isIngestionTerminal(operation.state)
    || operation.children.some(child => child.state === 'pending' || child.state === 'running')));
}

export function isIngestionActive(status?: IngestionStatus): boolean {
  return Boolean(status && (isOperationActive(status.activeOperation)
    || status.activeRun?.state === 'running'
    || Object.values(status.pipelines ?? {}).some(pipeline => pipeline.activeRun?.state === 'running')));
}

/** Includes already finished siblings on reload so cached snapshot readiness is refreshed. */
export function terminalIngestionKeys(status?: IngestionStatus, operation?: IngestionOperation): string[] {
  const operations = [status?.activeOperation, operation].filter(Boolean);
  const children = operations.flatMap(item => item.children
    .filter(child => isIngestionTerminal(child.state))
    .map(child => `child:${item.operationId}:${child.id}:${child.state}`));
  const groups = operations.filter(item => isIngestionTerminal(item.state))
    .map(item => `operation:${item.operationId}:${item.state}`);
  const runs = [...(status?.runs ?? []), ...Object.values(status?.pipelines ?? {}).flatMap(pipeline => pipeline.runs)]
    .filter(run => isIngestionTerminal(run.state)).map(run => `run:${run.id}:${run.state}`);
  return [...new Set([...children, ...groups, ...runs])];
}

export async function invalidateIngestionViews(queryClient: QueryClient, code: string): Promise<void> {
  await Promise.all([
    // Prefixes include every pipeline status, operation, list and snapshot detail.
    queryClient.invalidateQueries({ queryKey: ingestionKeys.status(code) }),
    queryClient.invalidateQueries({ queryKey: ingestionKeys.snapshots(code) }),
    queryClient.invalidateQueries({ queryKey: ['document-parser-catalog', code] }),
    queryClient.invalidateQueries({ queryKey: ['projects', code, 'readiness'] }),
    queryClient.invalidateQueries({ queryKey: ['projects', code, 'search'] }),
    queryClient.invalidateQueries({ queryKey: ['projects', code, 'entities'] }),
    queryClient.invalidateQueries({ queryKey: ['projects', code, 'evidence'] }),
  ]);
}
