import { useQuery } from '@tanstack/react-query';
import {
  getAnalyzers,
  getCapabilities,
  getSystemHealth,
  type AnalyzerCatalogEntry,
  type CapabilitiesReport,
  type SystemHealthReport,
} from '@/services/api';

const ANALYZER_CATALOG_STORAGE_KEY = 'codevector.analyzer-catalog.v1';

function isAnalyzerCatalogEntry(value: unknown): value is AnalyzerCatalogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    Array.isArray(entry.languages) && entry.languages.every((language) => typeof language === 'string') &&
    Array.isArray(entry.extensions) && entry.extensions.every((extension) => typeof extension === 'string') &&
    typeof entry.description === 'string' &&
    (entry.defaultLevel === 'syntax' || entry.defaultLevel === 'semantic' || entry.defaultLevel === 'text') &&
    typeof entry.icon === 'string'
  );
}

function readCachedAnalyzerCatalog(): AnalyzerCatalogEntry[] | undefined {
  try {
    const serialized = window.localStorage.getItem(ANALYZER_CATALOG_STORAGE_KEY);
    if (!serialized) return undefined;
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every(isAnalyzerCatalogEntry)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function cacheAnalyzerCatalog(catalog: AnalyzerCatalogEntry[]): void {
  try {
    window.localStorage.setItem(ANALYZER_CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // Settings still works when storage is disabled, full, or unavailable.
  }
}

export function useAnalyzerCatalog() {
  return useQuery<AnalyzerCatalogEntry[]>({
    queryKey: ['analyzer-catalog'],
    queryFn: async () => {
      const catalog = await getAnalyzers();
      if (!Array.isArray(catalog) || !catalog.every(isAnalyzerCatalogEntry)) {
        throw new Error('The analyzer catalog response was invalid');
      }
      cacheAnalyzerCatalog(catalog);
      return catalog;
    },
    initialData: readCachedAnalyzerCatalog,
    initialDataUpdatedAt: 0,
    refetchOnMount: 'always',
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useCapabilities() {
  return useQuery<CapabilitiesReport>({
    queryKey: ['capabilities'],
    queryFn: getCapabilities,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useSystemHealth(options?: {
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  return useQuery<SystemHealthReport>({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: options?.refetchInterval !== undefined ? options.refetchInterval : 10000,
    enabled: options?.enabled ?? true,
    retry: false,
  });
}
