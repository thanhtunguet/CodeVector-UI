import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isDocumentParserCatalogEntry,
  readCachedParserCatalog,
  cacheParserCatalog
} from '../src/hooks/useSettings.js';
import type { DocumentParserCatalogEntry } from '../src/services/api.js';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const memoryStorage = new MemoryStorage();
if (typeof window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: memoryStorage
  };
} else if (!window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    writable: true,
    configurable: true
  });
}

describe('P12b: Client Parser Catalog Cache & Backend Truth', () => {
  const PARSER_CATALOG_STORAGE_KEY = 'codevector.parser-catalog.v1';

  const validEntry: DocumentParserCatalogEntry = {
    id: 'docx',
    name: 'Word Document (DOCX)',
    identity: 'codevector-docx',
    format: 'docx',
    extensions: ['.docx'],
    canonicalExtension: '.docx',
    description: 'Word document parser (DOCX)',
    defaultLevel: 'text',
    icon: 'FileText',
    declaredSupport: {
      state: 'declared',
      format: 'docx',
      canonicalExtension: '.docx',
      extensions: ['.docx'],
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    serviceAvailability: {
      state: 'unavailable',
      enabled: false,
      reason: 'disabled_by_default'
    },
    indexedSnapshotReadiness: {
      state: 'unverified',
      reason: 'no_snapshot_selected'
    }
  };

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Cache Entry Validation (isDocumentParserCatalogEntry)', () => {
    it('validates a complete, correctly typed catalog entry', () => {
      expect(isDocumentParserCatalogEntry(validEntry)).toBe(true);
    });

    it('rejects null, non-objects, or entries missing required fields', () => {
      expect(isDocumentParserCatalogEntry(null)).toBe(false);
      expect(isDocumentParserCatalogEntry(undefined)).toBe(false);
      expect(isDocumentParserCatalogEntry('invalid')).toBe(false);
      expect(isDocumentParserCatalogEntry({})).toBe(false);
      expect(isDocumentParserCatalogEntry({ ...validEntry, id: 123 })).toBe(false);
      expect(isDocumentParserCatalogEntry({ ...validEntry, extensions: 'not-an-array' })).toBe(false);
      expect(isDocumentParserCatalogEntry({ ...validEntry, defaultLevel: 'unknown' })).toBe(false);
    });

    it('rejects entries with invalid declaredSupport, serviceAvailability, or snapshotReadiness', () => {
      expect(
        isDocumentParserCatalogEntry({
          ...validEntry,
          declaredSupport: { state: 'invalid-state' }
        })
      ).toBe(false);

      expect(
        isDocumentParserCatalogEntry({
          ...validEntry,
          serviceAvailability: { state: 'invalid-state', enabled: 'true' }
        })
      ).toBe(false);

      expect(
        isDocumentParserCatalogEntry({
          ...validEntry,
          indexedSnapshotReadiness: { state: 'bogus' }
        })
      ).toBe(false);
    });
  });

  describe('2. LocalStorage Caching & Corruption Handling', () => {
    it('reads valid catalog array from localStorage', () => {
      window.localStorage.setItem(PARSER_CATALOG_STORAGE_KEY, JSON.stringify([validEntry]));
      const cached = readCachedParserCatalog();
      expect(cached).toBeDefined();
      expect(cached).toHaveLength(1);
      expect(cached![0].id).toBe('docx');
      expect(cached![0].name).toBe('Word Document (DOCX)');
    });

    it('returns undefined on cache miss', () => {
      expect(readCachedParserCatalog()).toBeUndefined();
    });

    it('gracefully handles JSON parse corruption without throwing', () => {
      window.localStorage.setItem(PARSER_CATALOG_STORAGE_KEY, '{"corrupted JSON...<not valid>');
      expect(() => {
        const cached = readCachedParserCatalog();
        expect(cached).toBeUndefined();
      }).not.toThrow();
    });

    it('gracefully rejects non-array cached payloads', () => {
      window.localStorage.setItem(PARSER_CATALOG_STORAGE_KEY, JSON.stringify({ not: 'an array' }));
      expect(readCachedParserCatalog()).toBeUndefined();
    });

    it('gracefully rejects arrays containing invalid or legacy partial records', () => {
      const corruptList = [validEntry, { id: 'bad_entry', description: 'missing other fields' }];
      window.localStorage.setItem(PARSER_CATALOG_STORAGE_KEY, JSON.stringify(corruptList));
      expect(readCachedParserCatalog()).toBeUndefined();
    });

    it('silently ignores localStorage setItem errors (e.g. quota exceeded or storage disabled)', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => {
        cacheParserCatalog([validEntry]);
      }).not.toThrow();
    });
  });

  describe('3. Honest Display: Stale cache never manufactures readiness claims', () => {
    it('stale cache reflects unverified state until fresh backend truth is retrieved', () => {
      // Simulate stale cache containing disabled/unverified entry
      cacheParserCatalog([validEntry]);
      const initial = readCachedParserCatalog();
      expect(initial![0].serviceAvailability.enabled).toBe(false);
      expect(initial![0].serviceAvailability.state).toBe('unavailable');
      expect(initial![0].indexedSnapshotReadiness.state).toBe('unverified');

      // Ensure that stale cached declaration is not a readiness claim
      expect(initial![0].indexedSnapshotReadiness.state).not.toBe('ready');
    });

    it('supports live update from fresh backend catalog with active service and ready snapshot', () => {
      const liveBackendEntry: DocumentParserCatalogEntry = {
        ...validEntry,
        serviceAvailability: {
          state: 'ready',
          enabled: true
        },
        indexedSnapshotReadiness: {
          state: 'ready',
          counts: {
            totalEligible: 5,
            totalParsed: 5,
            totalEmbedded: 5
          }
        }
      };

      // When fresh backend truth arrives, cache is updated
      cacheParserCatalog([liveBackendEntry]);
      const refreshed = readCachedParserCatalog();

      expect(refreshed![0].serviceAvailability.state).toBe('ready');
      expect(refreshed![0].serviceAvailability.enabled).toBe(true);
      expect(refreshed![0].indexedSnapshotReadiness.state).toBe('ready');
      expect(refreshed![0].indexedSnapshotReadiness.counts?.totalEmbedded).toBe(5);
    });

    it('faithfully preserves partial snapshot state and omission reasons from backend', () => {
      const partialBackendEntry: DocumentParserCatalogEntry = {
        ...validEntry,
        serviceAvailability: {
          state: 'ready',
          enabled: true
        },
        indexedSnapshotReadiness: {
          state: 'partial',
          counts: {
            totalEligible: 10,
            totalParsed: 8,
            totalEmbedded: 8
          },
          partialReasons: ['oversize', 'corrupt']
        }
      };

      cacheParserCatalog([partialBackendEntry]);
      const refreshed = readCachedParserCatalog();

      expect(refreshed![0].indexedSnapshotReadiness.state).toBe('partial');
      expect(refreshed![0].indexedSnapshotReadiness.partialReasons).toEqual(['oversize', 'corrupt']);
    });
  });
});
