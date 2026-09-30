export interface WorkerEvent {
  cursor: string;
  occurredAt: string;
  level: 'info' | 'warn' | 'error';
  kind: string;
  message: string;
  jobId?: string;
  attempt?: number;
  completed?: number;
  total?: number;
  consecutiveFailures?: number;
  reasonCode?: string;
  projectCode?: string;
  runId?: string;
  snapshotId?: string;
}

export interface WorkerEventPage {
  events: WorkerEvent[];
  hasMore: boolean;
  nextBefore?: string;
}

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

function endpoint(projectCode?: string, runId?: string, snapshotId?: string): string {
  if (projectCode && runId) {
    return `${BASE_URL}/projects/${encodeURIComponent(projectCode)}/ingestion/${encodeURIComponent(runId)}/worker-events`;
  }
  if (projectCode && snapshotId) {
    return `${BASE_URL}/projects/${encodeURIComponent(projectCode)}/snapshots/${encodeURIComponent(snapshotId)}/worker-events`;
  }
  return `${BASE_URL}/worker-events`;
}

async function responseError(response: Response): Promise<Error> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return new Error(data.error);
    }
  } catch {
    // Keep a status-based message for non-JSON errors.
  }
  return new Error(`Worker events request failed (${response.status})`);
}

export async function getWorkerEvents(
  scope: { projectCode?: string; runId?: string; snapshotId?: string },
  options: { after?: string; before?: string; limit?: number } = {}
): Promise<WorkerEventPage> {
  const url = new URL(endpoint(scope.projectCode, scope.runId, scope.snapshotId), window.location.origin);
  if (options.after) url.searchParams.set('after', options.after);
  if (options.before) url.searchParams.set('before', options.before);
  url.searchParams.set('limit', String(options.limit ?? 50));
  const response = await fetch(url.toString());
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<WorkerEventPage>;
}

export function workerEventStreamUrl(scope: {
  projectCode?: string;
  runId?: string;
  snapshotId?: string;
}, after?: string): string {
  const url = new URL(`${endpoint(scope.projectCode, scope.runId, scope.snapshotId)}/stream`, window.location.origin);
  if (after) url.searchParams.set('after', after);
  return url.toString();
}

export async function cancelIngestionRun(projectCode: string, runId: string): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/projects/${encodeURIComponent(projectCode)}/ingestion/${encodeURIComponent(runId)}/cancel`,
    { method: 'POST' }
  );
  if (!response.ok) throw await responseError(response);
}
