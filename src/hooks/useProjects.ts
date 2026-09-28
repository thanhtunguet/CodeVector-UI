import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProject,
  deleteProject,
  getHealth,
  getProject,
  getProjectIngestion,
  getProjects,
  getProjectSnapshots,
  getProjectSources,
  type CreateProjectInput,
  type HealthReport,
  type IngestionStatus,
  type Project,
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

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (code: string) => deleteProject(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
