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

export interface Snapshot {
  id: string;
  projectCode: string;
  state: 'building' | 'published' | 'failed';
  createdAt: string;
  publishedAt?: string;
  failureReason?: string;
  indexCapability?: string;
}

export interface IngestionStatus {
  activeRun?: unknown;
  latestSnapshot?: Snapshot;
  latestSuccessfulSnapshot?: Snapshot;
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

export async function deleteProject(code: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(message);
  }
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

export async function getProjectIngestion(code: string): Promise<IngestionStatus> {
  return requestJson<IngestionStatus>(
    `${BASE_URL}/projects/${encodeURIComponent(code)}/ingestion`
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
