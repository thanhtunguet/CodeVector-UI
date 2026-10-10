import { useQuery } from '@tanstack/react-query';
import {
  getAnalyzers,
  getCapabilities,
  getDocumentParsers,
  getSystemHealth,
  type AnalyzerCatalogEntry,
  type CapabilitiesReport,
  type DocumentParserCatalogEntry,
  type SystemHealthReport,
} from '@/services/api';

const ANALYZER_CATALOG_STORAGE_KEY = 'codevector.analyzer-catalog.v1';
const PARSER_CATALOG_STORAGE_KEY = 'codevector.parser-catalog.v1';

export function isDocumentParserCatalogEntry(value: unknown): value is DocumentParserCatalogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== 'string' ||
    typeof entry.name !== 'string' ||
    typeof entry.identity !== 'string' ||
    typeof entry.format !== 'string' ||
    !Array.isArray(entry.extensions) ||
    !entry.extensions.every((ext) => typeof ext === 'string') ||
    typeof entry.canonicalExtension !== 'string' ||
    typeof entry.description !== 'string' ||
    (entry.defaultLevel !== 'syntax' && entry.defaultLevel !== 'semantic' && entry.defaultLevel !== 'text') ||
    typeof entry.icon !== 'string'
  ) {
    return false;
  }

  const decl = entry.declaredSupport as Record<string, unknown> | undefined;
  if (
    !decl ||
    typeof decl !== 'object' ||
    (decl.state !== 'declared' && decl.state !== 'unsupported') ||
    typeof decl.format !== 'string' ||
    typeof decl.canonicalExtension !== 'string' ||
    !Array.isArray(decl.extensions)
  ) {
    return false;
  }

  const avail = entry.serviceAvailability as Record<string, unknown> | undefined;
  if (
    !avail ||
    typeof avail !== 'object' ||
    (avail.state !== 'ready' && avail.state !== 'unavailable' && avail.state !== 'degraded') ||
    typeof avail.enabled !== 'boolean'
  ) {
    return false;
  }

  const ready = entry.indexedSnapshotReadiness as Record<string, unknown> | undefined;
  if (
    !ready ||
    typeof ready !== 'object' ||
    (ready.state !== 'ready' && ready.state !== 'partial' && ready.state !== 'unavailable' && ready.state !== 'unverified')
  ) {
    return false;
  }

  return true;
}

export function readCachedParserCatalog(): DocumentParserCatalogEntry[] | undefined {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    const serialized = window.localStorage.getItem(PARSER_CATALOG_STORAGE_KEY);
    if (!serialized) return undefined;
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every(isDocumentParserCatalogEntry)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function cacheParserCatalog(catalog: DocumentParserCatalogEntry[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(PARSER_CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // Settings still works when storage is disabled, full, or unavailable.
  }
}

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

export function useDocumentParserCatalog(projectCode?: string, snapshotId?: string) {
  return useQuery<DocumentParserCatalogEntry[]>({
    queryKey: ['document-parser-catalog', projectCode, snapshotId],
    queryFn: async () => {
      const catalog = await getDocumentParsers(projectCode, snapshotId);
      if (!Array.isArray(catalog) || !catalog.every(isDocumentParserCatalogEntry)) {
        throw new Error('The document parser catalog response was invalid');
      }
      if (!projectCode && !snapshotId) {
        cacheParserCatalog(catalog);
      }
      return catalog;
    },
    initialData: !projectCode && !snapshotId ? readCachedParserCatalog : undefined,
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
