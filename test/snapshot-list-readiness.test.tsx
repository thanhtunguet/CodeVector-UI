import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { Snapshots } from '../src/pages/Snapshots';
import { ProjectDetail } from '../src/pages/ProjectDetail';
import type { Snapshot } from '../src/services/api';

const mocks = vi.hoisted(() => ({
  snapshots: [] as Snapshot[],
  refetch: vi.fn(),
}));
vi.mock('../src/hooks/useSources', () => ({
  useProjectSelection: () => ({ projects: [{ code: 'demo', name: 'Demo' }], selectedCode: 'demo', selectedProject: { code: 'demo', name: 'Demo' }, setSelectedCode: vi.fn(), isLoading: false, refetch: mocks.refetch }),
}));
vi.mock('../src/hooks/useProjects', () => ({
  useProject: () => ({ data: { code: 'demo', name: 'Demo' }, isLoading: false, isError: false, refetch: mocks.refetch }),
  useProjectSources: () => ({ data: [], isLoading: false, refetch: mocks.refetch }),
  useProjectSnapshots: () => ({ data: mocks.snapshots, isLoading: false, isRefetching: false, refetch: mocks.refetch }),
  useProjectIngestion: () => ({ data: { projectCode: 'demo' }, isLoading: false, isRefetching: false, refetch: mocks.refetch }),
  useDeleteSnapshot: () => ({ mutateAsync: vi.fn() }),
  useSearchProject: () => ({ data: undefined, isLoading: false, isFetching: false }),
}));
vi.mock('../src/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../src/components/sources/IngestionActions', () => ({ IngestionActions: () => null }));
vi.mock('../src/components/sources/IngestionStatusPanel', () => ({ IngestionStatusPanel: () => null }));
vi.mock('../src/components/snapshots/SnapshotDetailSheet', () => ({ SnapshotDetailSheet: () => null }));
vi.mock('../src/components/worker/WorkerEventPanel', () => ({ WorkerEventPanel: () => null }));
vi.mock('../src/components/snapshots/CleanupSnapshotsDialog', () => ({ CleanupSnapshotsDialog: () => null }));
vi.mock('../src/components/projects/EditProjectSheet', () => ({ EditProjectSheet: () => null }));
vi.mock('../src/components/projects/DeleteProjectDialog', () => ({ DeleteProjectDialog: () => null }));
vi.mock('../src/components/projects/AddSourceDialog', () => ({ AddSourceDialog: () => null }));
vi.mock('../src/components/projects/CleanupSnapshotsDialog', () => ({ CleanupSnapshotsDialog: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  mocks.snapshots = [
    { id: 'docs-only', projectCode: 'demo', state: 'published', createdAt: '2026-10-14T00:00:00Z', pipeline: 'docs', indexCapability: 'full', indexCapabilityReason: 'legacy code reason', embeddingModelId: 'docs-model', embeddingDimensions: 384, documentParse: { state: 'ready' }, documentSemantic: { state: 'partial', reason: 'Document embeddings pending' } },
    { id: 'source-failed', projectCode: 'demo', state: 'failed', createdAt: '2026-10-13T00:00:00Z', pipeline: 'source', indexCapability: 'full', failureReason: 'Source ingest failed', codeGraph: { state: 'failed' } },
  ];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(page: 'snapshots' | 'project') {
  const path = page === 'snapshots' ? '/snapshots' : '/projects/demo';
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: [path] }, createElement(TooltipProvider, null,
    createElement(Routes, null, createElement(Route, { path, element: page === 'snapshots' ? createElement(Snapshots) : createElement(ProjectDetail) }))))));
  if (page === 'project') {
    const tab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent?.includes('Snapshots'));
    expect(tab).toBeDefined();
    await act(async () => tab!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
    expect(tab!.getAttribute('data-state')).toBe('active');
  }
}
function row(id: string) {
  const matching = [...container.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(id));
  expect(matching, `snapshot row ${id}`).toBeDefined();
  return matching!;
}

describe('snapshot list readiness', () => {
  it('shows Docs readiness and real readiness reasons on the Snapshots page', async () => {
    await render('snapshots');
    const docs = row('docs-only');
    expect(docs.textContent).toContain('Document parse: ready');
    expect(docs.textContent).toContain('Document semantics: partial');
    expect(docs.textContent).toContain('Document semantics: Document embeddings pending');
    expect(docs.textContent).toContain('docs-model');
    expect(docs.textContent).toContain('384d');
    expect(docs.textContent).not.toContain('Code graph:');
    expect(docs.textContent).not.toContain('legacy code reason');
    expect(row('source-failed').textContent).toContain('Source ingest failed');
  });

  it('shows Docs readiness and preserves failure notes on Project Detail', async () => {
    await render('project');
    const docs = row('docs-only');
    expect(docs.textContent).toContain('Document parse: ready');
    expect(docs.textContent).toContain('Document semantics: partial');
    expect(docs.textContent).not.toContain('Code graph:');
    expect(docs.textContent).not.toContain('full');
    expect(row('source-failed').textContent).toContain('Source ingest failed');
  });
});
