import { useQuery } from '@tanstack/react-query';
import {
  getEntityDetail,
  getEntityDependencies,
  getEvidence,
  searchProject,
  type DependencyGraph,
  type EntityDetailResponse,
  type EvidenceResult,
  type SearchResponse,
} from '@/services/api';

export function useSearchProject(
  code: string | undefined,
  q: string,
  type: 'symbol' | 'path' | 'semantic' = 'symbol',
  options?: { enabled?: boolean; limit?: number; snapshotId?: string }
) {
  return useQuery<SearchResponse, Error>({
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

export function useEntityDetail(
  code: string | undefined,
  id: string | null | undefined,
  options?: { snapshotId?: string; depth?: number; enabled?: boolean }
) {
  return useQuery<EntityDetailResponse, Error>({
    queryKey: ['projects', code, 'entities', id, options?.snapshotId, options?.depth],
    queryFn: () =>
      getEntityDetail(code!, id!, {
        snapshotId: options?.snapshotId,
        depth: options?.depth,
      }),
    enabled: Boolean(code && id && (options?.enabled ?? true)),
    retry: 1,
  });
}

export function useEntityDependencies(
  code: string | undefined,
  id: string | null | undefined,
  options?: { snapshotId?: string; depth?: number; enabled?: boolean }
) {
  return useQuery<DependencyGraph, Error>({
    queryKey: ['projects', code, 'entities', id, 'dependencies', options?.snapshotId, options?.depth],
    queryFn: () =>
      getEntityDependencies(code!, id!, {
        snapshotId: options?.snapshotId,
        depth: options?.depth,
      }),
    enabled: Boolean(code && id && (options?.enabled ?? true)),
    retry: 1,
  });
}

export function useEvidence(
  code: string | undefined,
  path: string | null | undefined,
  options?: { snapshotId?: string; sourceId?: string; enabled?: boolean }
) {
  return useQuery<EvidenceResult, Error>({
    queryKey: ['projects', code, 'evidence', path, options?.snapshotId, options?.sourceId],
    queryFn: () =>
      getEvidence(code!, path!, {
        snapshotId: options?.snapshotId,
        sourceId: options?.sourceId,
      }),
    enabled: Boolean(code && path && (options?.enabled ?? true)),
    retry: 1,
  });
}
