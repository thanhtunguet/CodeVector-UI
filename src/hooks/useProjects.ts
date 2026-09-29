import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cleanupSnapshots,
  createProject,
  createSource,
  deleteProject,
  getHealth,
  getProject,
  getProjectIngestion,
  getProjects,
  getProjectSnapshots,
  getProjectSources,
  searchProject,
  triggerIngest,
  updateProject,
  type CleanupSnapshotsResult,
  type CreateProjectInput,
  type CreateSourceInput,
  type HealthReport,
  type IngestResult,
  type IngestionStatus,
  type Project,
  type SearchResponse,
  type Snapshot,
  type Source,
} from '@/services/api';

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

export function useProjectSources(code: string | undefined) {
  return useQuery<Source[]>({
    queryKey: ['projects', code, 'sources'],
    queryFn: () => getProjectSources(code!),
    enabled: Boolean(code),
  });
}

export function useProjectSnapshots(code: string | undefined) {
  return useQuery<Snapshot[]>({
    queryKey: ['projects', code, 'snapshots'],
    queryFn: () => getProjectSnapshots(code!),
    enabled: Boolean(code),
  });
}

export function useProjectIngestion(code: string | undefined) {
  return useQuery<IngestionStatus>({
    queryKey: ['projects', code, 'ingestion'],
    queryFn: () => getProjectIngestion(code!),
    enabled: Boolean(code),
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

export function useSearchProject(
  code: string | undefined,
  q: string,
  type: 'symbol' | 'path' | 'semantic' = 'symbol',
  options?: { enabled?: boolean; limit?: number }
) {
  return useQuery<SearchResponse>({
    queryKey: ['projects', code, 'search', q, type, options?.limit],
    queryFn: () => searchProject(code!, { q, type, limit: options?.limit }),
    enabled: Boolean(code && q.trim().length > 0 && (options?.enabled ?? true)),
  });
}
