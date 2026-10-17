import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cleanupSnapshots,
  createProject,
  createSource,
  deleteProject,
  getHealth,
  getProject,
  getProjects,
  getProjectSnapshot,
  getProjectSnapshots,
  getProjectSources,
  updateSourceEncodingPolicy,
  searchProject,
  triggerIngest,
  updateProject,
  deleteSnapshot,
  type CleanupSnapshotsResult,
  type CreateProjectInput,
  type CreateSourceInput,
  type HealthReport,
  type IngestResult,
  type Project,
  type SearchResponse,
  type Snapshot,
  type SnapshotPipeline,
  type Source,
  type SourceEncodingPolicy,
} from '@/services/api';
import { ingestionKeys } from './ingestionQueries';

export {
  useProjectIngestion, usePipelineIngestion, useIngestionOperation,
  useTriggerPipelineIngest, useRetryPipelineIngest, useCancelIngestionOperation, useCancelIngestionRun,
} from './useIngestion';

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
}

export function useProject(code: string | undefined) {
  return useQuery<Project>({
    queryKey: ['projects', code],
    queryFn: () => getProject(code!),
    enabled: Boolean(code),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation<Project, Error, CreateProjectInput>({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation<Project, Error, { code: string; name: string }>({
    mutationFn: ({ code, name }) => updateProject(code, { name }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', updated.code] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (code: string) => deleteProject(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useTriggerIngest() {
  const queryClient = useQueryClient();
  return useMutation<IngestResult, Error, { code: string; requireSemantic?: boolean }>({
    mutationFn: ({ code, requireSemantic }) => triggerIngest(code, { requireSemantic }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.code, 'ingestion'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.code, 'snapshots'] });
    },
  });
}

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation<Source, Error, { code: string; input: CreateSourceInput }>({
    mutationFn: ({ code, input }) => createSource(code, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.code, 'sources'] });
    },
  });
}

/** Saves (or with `null` clears) a source's encoding policy; applies to the next ingestion only. */
export function useUpdateSourceEncodingPolicy() {
  const queryClient = useQueryClient();
  return useMutation<
    Source,
    Error,
    { code: string; sourceId: string; encodingPolicy: SourceEncodingPolicy | null }
  >({
    mutationFn: ({ code, sourceId, encodingPolicy }) =>
      updateSourceEncodingPolicy(code, sourceId, encodingPolicy),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.code, 'sources'] });
    },
  });
}

export function useCleanupSnapshots() {
  const queryClient = useQueryClient();
  return useMutation<CleanupSnapshotsResult, Error, { code: string; retainCount?: number }>({
    mutationFn: ({ code, retainCount }) => cleanupSnapshots(code, { retainCount }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.code, 'snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.code, 'ingestion'] });
    },
  });
}

export function useDeleteSnapshot() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { code: string; snapshotId: string }>({
    mutationFn: ({ code, snapshotId }) => deleteSnapshot(code, snapshotId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.code, 'snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.code, 'ingestion'] });
    },
  });
}

export function useProjectSources(code: string | undefined) {
  return useQuery<Source[]>({
    queryKey: ['projects', code, 'sources'],
    queryFn: () => getProjectSources(code!),
    enabled: Boolean(code),
  });
}

export function useProjectSnapshots(code: string | undefined, pipeline?: SnapshotPipeline) {
  return useQuery<Snapshot[]>({
    queryKey: ingestionKeys.snapshots(code, pipeline),
    queryFn: () => getProjectSnapshots(code!, pipeline),
    enabled: Boolean(code),
  });
}

export function useProjectSnapshot(code: string | undefined, snapshotId: string | undefined) {
  return useQuery<Snapshot>({
    queryKey: ['projects', code, 'snapshots', snapshotId],
    queryFn: () => getProjectSnapshot(code!, snapshotId!),
    enabled: Boolean(code && snapshotId),
  });
}

export function useHealth() {
  return useQuery<HealthReport>({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 10000,
    retry: false,
  });
}

export {
  useEntityDetail,
  useEntityDependencies,
  useEvidence,
} from './useRetrieval';

export { useCapabilities, useSystemHealth } from './useSettings';

export function useSearchProject(
  code: string | undefined,
  q: string,
  type: 'symbol' | 'path' | 'semantic' = 'symbol',
  options?: { enabled?: boolean; limit?: number; snapshotId?: string }
) {
  return useQuery<SearchResponse>({
    queryKey: ['projects', code, 'search', q, type, options?.limit, options?.snapshotId],
    queryFn: () =>
      searchProject(code!, {
        q,
        type,
        limit: options?.limit,
        snapshotId: options?.snapshotId,
      }),
    enabled: Boolean(code && q.trim().length > 0 && (options?.enabled ?? true)),
    retry: false,
  });
}

