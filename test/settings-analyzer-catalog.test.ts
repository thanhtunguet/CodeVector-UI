import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isAnalyzerCatalogEntry,
  readCachedAnalyzerCatalog,
  cacheAnalyzerCatalog
} from '../src/hooks/useSettings.js';
import type { AnalyzerCatalogEntry } from '../src/services/api.js';

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

describe('Client Analyzer Catalog Cache & Sorting', () => {
  const sampleEntries: AnalyzerCatalogEntry[] = [
    {
      id: 'typescript',
      name: 'TypeScript/JavaScript',
      languages: ['typescript', 'javascript'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      description: 'TypeScript adapter',
      defaultLevel: 'syntax',
      icon: 'FileCode2'
    },
    {
      id: 'python',
      name: 'Python',
      languages: ['python'],
      extensions: ['.py'],
      description: 'Python adapter',
      defaultLevel: 'syntax',
      icon: 'FileCode'
    },
    {
      id: 'go',
      name: 'Go',
      languages: ['go'],
      extensions: ['.go'],
      description: 'Go adapter',
      defaultLevel: 'syntax',
      icon: 'Code2'
    },
    {
      id: 'bash',
      name: 'Bash',
      languages: ['bash'],
      extensions: ['.sh', '.bash'],
      description: 'Bash adapter',
      defaultLevel: 'semantic',
      icon: 'Terminal'
    }
  ];

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('validates a complete, correctly typed catalog entry', () => {
    expect(isAnalyzerCatalogEntry(sampleEntries[0])).toBe(true);
    expect(isAnalyzerCatalogEntry(null)).toBe(false);
    expect(isAnalyzerCatalogEntry({ id: 'bad' })).toBe(false);
  });

  it('reads cached catalog and sorts entries by name', () => {
    cacheAnalyzerCatalog(sampleEntries);
    const cached = readCachedAnalyzerCatalog();
    expect(cached).toBeDefined();
    expect(cached?.map((e) => e.name)).toEqual([
      'Bash',
      'Go',
      'Python',
      'TypeScript/JavaScript'
    ]);
  });
});
