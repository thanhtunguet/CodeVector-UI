export interface Project {
  code: string;
  name: string;
  createdAt: string;
}

export interface CreateProjectInput {
  code: string;
  name: string;
}

export type SourceLocator =
  | { type: 'local_directory'; path: string }
  | { type: string; [key: string]: unknown };

export interface Source {
  id: string;
  projectCode: string;
  kind: 'repository' | 'documentation';
  name: string;
  locator: SourceLocator;
  createdAt: string;
}

export interface SnapshotRevision {
  sourceId: string;
  sourceName?: string;
  revision: string;
  manifestHash: string;
  fileCount: number;
}

export interface Snapshot {
  id: string;
  projectCode: string;
  state: 'building' | 'published' | 'failed';
  createdAt: string;
  publishedAt?: string;
  failureReason?: string;
  indexCapability?: 'full' | 'graph_only' | 'none' | string;
  indexCapabilityReason?: string;
  embeddingModelId?: string;
  embeddingDimensions?: number;
  revisions?: SnapshotRevision[];
}

export interface IngestionRun {
  id: string;
  projectCode: string;
  snapshotId: string;
  state: 'running' | 'succeeded' | 'failed';
  startedAt: string;
  finishedAt?: string;
  failureReason?: string;
  leaseExpiresAt?: string;
  ownerId?: string;
}

export interface IngestionStatus {
  projectCode?: string;
  activeRun?: IngestionRun | null;
  published?: Snapshot;
  latest?: Snapshot;
  latestSnapshot?: Snapshot;
  latestSuccessfulSnapshot?: Snapshot;
  runs?: IngestionRun[];
  ingestionImplemented?: boolean;
}

export interface HealthReport {
  ready?: boolean;
  live?: boolean;
  version?: string;
  probes?: Record<string, unknown>;
  [key: string]: unknown;
}

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  } catch {
    // Non-JSON response
  }
  return `Request failed with status ${res.status}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function getProjects(): Promise<Project[]> {
  const data = await requestJson<{ projects: Project[] }>(`${BASE_URL}/projects`);
  return data.projects;
}

export async function getProject(code: string): Promise<Project> {
  return requestJson<Project>(`${BASE_URL}/projects/${encodeURIComponent(code)}`);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  return requestJson<Project>(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function updateProject(code: string, data: { name: string }): Promise<Project> {
  return requestJson<Project>(`${BASE_URL}/projects/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function deleteProject(code: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(message);
  }
}

export interface CreateSourceInput {
  name: string;
  kind: 'repository' | 'documentation';
  locator: { type: 'local_directory'; path: string };
}

export async function createSource(
  code: string,
  input: CreateSourceInput
): Promise<Source> {
  return requestJson<Source>(`${BASE_URL}/projects/${encodeURIComponent(code)}/sources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function getProjectSources(code: string): Promise<Source[]> {
  const data = await requestJson<{ sources: Source[] }>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/sources`
  );
  return data.sources;
}

export async function getProjectSnapshots(code: string): Promise<Snapshot[]> {
  const data = await requestJson<{ snapshots: Snapshot[] }>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/snapshots`
  );
  return data.snapshots;
}

export async function getProjectSnapshot(code: string, snapshotId: string): Promise<Snapshot> {
  return requestJson<Snapshot>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/snapshots/${encodeURIComponent(snapshotId)}`
  );
}

export interface CleanupSnapshotsResult {
  projectCode?: string;
  inspectedCount?: number;
  deletedSnapshots: string[];
  retainedSnapshots: string[];
  deletedSnapshotIds: string[];
  retainedSnapshotIds: string[];
  deleteErrors?: string[];
}

export async function cleanupSnapshots(
  code: string,
  options?: { retainCount?: number }
): Promise<CleanupSnapshotsResult> {
  const data = await requestJson<Record<string, unknown>>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/snapshots/cleanup`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options ?? {}),
    }
  );
  const deleted =
    (data.deletedSnapshots as string[] | undefined) ??
    (data.deletedSnapshotIds as string[] | undefined) ??
    [];
  const retained =
    (data.retainedSnapshots as string[] | undefined) ??
    (data.retainedSnapshotIds as string[] | undefined) ??
    [];
  return {
    ...data,
    deletedSnapshots: deleted,
    retainedSnapshots: retained,
    deletedSnapshotIds: deleted,
    retainedSnapshotIds: retained,
  };
}

export async function getProjectIngestion(code: string): Promise<IngestionStatus> {
  const data = await requestJson<Record<string, unknown>>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/ingestion`
  );
  const published =
    (data.published as Snapshot | undefined) ??
    (data.latestSuccessfulSnapshot as Snapshot | undefined);
  const latest =
    (data.latest as Snapshot | undefined) ??
    (data.latestSnapshot as Snapshot | undefined);
  return {
    ...data,
    published,
    latest,
    latestSuccessfulSnapshot: published,
    latestSnapshot: latest,
  };
}

export interface IngestResult {
  runId?: string;
  snapshotId?: string;
  state?: string;
  [key: string]: unknown;
}

export async function triggerIngest(
  code: string,
  options?: { requireSemantic?: boolean }
): Promise<IngestResult> {
  return requestJson<IngestResult>(`${BASE_URL}/projects/${encodeURIComponent(code)}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options ?? {}),
  });
}

export interface SearchLocation {
  projectCode?: string;
  sourceId?: string;
  revision?: string;
  path: string;
  startByte?: number;
  endByte?: number;
  startLine?: number | null;
  endLine?: number | null;
}

export interface SearchResultItem {
  id?: string;
  entityId?: string;
  name?: string;
  kind?: string;
  path?: string;
  score?: number;
  location?: SearchLocation;
  diagnostics?: unknown[];
  snapshotId?: string;
  [key: string]: unknown;
}

export interface SearchResponse {
  projectCode: string;
  query: string;
  type: string;
  results: SearchResultItem[];
}

export async function searchProject(
  code: string,
  params: {
    q: string;
    type?: 'symbol' | 'path' | 'semantic';
    limit?: number;
    snapshotId?: string;
  }
): Promise<SearchResponse> {
  const query = new URLSearchParams();
  query.set('q', params.q);
  if (params.type) query.set('type', params.type);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.snapshotId) query.set('snapshotId', params.snapshotId);

  return requestJson<SearchResponse>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/search?${query.toString()}`
  );
}

export interface GraphEntityNode {
  id: string;
  projectCode: string;
  sourceId: string;
  revision: string;
  snapshotId: string;
  kind: string;
  name: string;
  qualifiedName: string | null;
  path: string;
  startByte: number;
  endByte: number;
  startLine: number | null;
  endLine: number | null;
  language: string;
  unresolvedRelationCount?: number;
}

export interface GraphRelationEdge {
  type: string;
  source: string;
  target: string;
  resolution: string;
  method: string;
  analyzer: string;
}

export interface DependencyGraph {
  rootEntityId: string;
  depth: number;
  entities: GraphEntityNode[];
  relations: GraphRelationEdge[];
}

export interface EntityDetailResponse {
  projectCode: string;
  entity: GraphEntityNode;
  incomingRelations: GraphRelationEdge[];
  outgoingRelations: GraphRelationEdge[];
  dependencies?: DependencyGraph;
}

export interface EvidenceResult {
  projectCode: string;
  snapshotId: string;
  sourceId: string;
  revision?: string;
  path: string;
  contentHash: string;
  byteSize: number;
  text: string;
}

export async function getEntityDetail(
  code: string,
  id: string,
  options?: { snapshotId?: string; depth?: number }
): Promise<EntityDetailResponse> {
  const query = new URLSearchParams();
  if (options?.snapshotId) query.set('snapshotId', options.snapshotId);
  if (options?.depth !== undefined) query.set('depth', String(options.depth));

  const qs = query.toString();
  return requestJson<EntityDetailResponse>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/entities/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`
  );
}

export async function getEntityDependencies(
  code: string,
  id: string,
  options?: { snapshotId?: string; depth?: number }
): Promise<DependencyGraph> {
  const query = new URLSearchParams();
  if (options?.snapshotId) query.set('snapshotId', options.snapshotId);
  if (options?.depth !== undefined) query.set('depth', String(options.depth));

  const qs = query.toString();
  return requestJson<DependencyGraph>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/entities/${encodeURIComponent(id)}/dependencies${qs ? `?${qs}` : ''}`
  );
}

export async function getEvidence(
  code: string,
  path: string,
  options?: { snapshotId?: string; sourceId?: string }
): Promise<EvidenceResult> {
  const query = new URLSearchParams();
  query.set('path', path);
  if (options?.snapshotId) query.set('snapshotId', options.snapshotId);
  if (options?.sourceId) query.set('sourceId', options.sourceId);

  return requestJson<EvidenceResult>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/evidence?${query.toString()}`
  );
}

export async function getHealth(): Promise<HealthReport> {
  const res = await fetch(`${BASE_URL}/health`);
  // 503 is returned when some dependencies are not ready, but the body still contains readiness status
  if (!res.ok && res.status !== 503) {
    const message = await parseError(res);
    throw new Error(message);
  }
  return res.json() as Promise<HealthReport>;
}
