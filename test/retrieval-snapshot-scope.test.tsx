import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Retrieval } from '../src/pages/Retrieval';
import type { Snapshot } from '../src/services/api';

const mocks = vi.hoisted(() => ({
  snapshots: [] as Snapshot[],
  snapshotCalls: [] as Array<[string | undefined, string | undefined]>,
  searchCalls: [] as Array<{ snapshotId?: string; enabled?: boolean }>,
  refetchSearch: vi.fn(),
  refetchProjects: vi.fn(),
}));
vi.mock('../src/hooks/useSources', () => ({
  useProjectSelection: () => ({ projects: [{ code: 'demo', name: 'Demo' }], selectedCode: 'demo', selectedProject: { code: 'demo', name: 'Demo' }, setSelectedCode: vi.fn(), isLoading: false, refetch: mocks.refetchProjects }),
}));
vi.mock('../src/hooks/useProjects', () => ({
  useProjectSnapshots: (code?: string, pipeline?: string) => {
    mocks.snapshotCalls.push([code, pipeline]);
    return { data: mocks.snapshots.filter(snapshot => !pipeline || snapshot.pipeline === pipeline), isLoading: false };
  },
}));
vi.mock('../src/hooks/useRetrieval', () => ({
  useSearchProject: (_code: string, _query: string, _mode: string, options: { snapshotId?: string; enabled?: boolean }) => {
    mocks.searchCalls.push(options);
    return { data: { results: [] }, isLoading: false, isFetching: false, isError: false, error: null, refetch: mocks.refetchSearch };
  },
}));
vi.mock('../src/components/retrieval/EntityDetailSheet', () => ({ EntityDetailSheet: () => null }));
vi.mock('../src/components/retrieval/EvidenceViewerDialog', () => ({ EvidenceViewerDialog: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  mocks.snapshotCalls = []; mocks.searchCalls = [];
  mocks.refetchSearch.mockReset(); mocks.refetchProjects.mockReset();
  mocks.snapshots = [
    { id: 'source-head', projectCode: 'demo', state: 'published', pipeline: 'source', createdAt: '2026-10-14', codeGraph: { state: 'ready' } },
    { id: 'docs-head', projectCode: 'demo', state: 'published', pipeline: 'docs', createdAt: '2026-10-14', documentParse: { state: 'ready' } },
  ];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(query: string) {
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: [`/retrieval${query}`] },
    createElement(Routes, null, createElement(Route, { path: '/retrieval', element: createElement(Retrieval) })))));
}

describe('code retrieval snapshot scope', () => {
  it('requests only Source snapshots and accepts a published Source ID', async () => {
    await render('?q=router&snapshot=source-head');
    expect(mocks.snapshotCalls.at(-1)).toEqual(['demo', 'source']);
    expect(mocks.searchCalls.at(-1)).toMatchObject({ snapshotId: 'source-head', enabled: true });
    expect(container.textContent).not.toContain('Source snapshot unavailable');
  });

  it('holds search for a URL-pinned Docs ID and asks for a Source snapshot', async () => {
    await render('?q=router&snapshot=docs-head');
    expect(mocks.snapshotCalls.at(-1)).toEqual(['demo', 'source']);
    expect(mocks.searchCalls.at(-1)).toMatchObject({ enabled: false });
    expect(mocks.searchCalls.at(-1)?.snapshotId).toBeUndefined();
    expect(container.textContent).toContain('Source snapshot unavailable');
    expect(container.textContent).toContain('Select a published Source snapshot');
    expect(container.textContent).not.toContain('No matches found');
    const searchButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Search');
    expect(searchButton?.disabled).toBe(true);
    const refreshButton = container.querySelector<HTMLButtonElement>('button[title="Refresh"]');
    expect(refreshButton).toBeDefined();
    await act(async () => refreshButton!.click());
    expect(mocks.refetchProjects).toHaveBeenCalledOnce();
    expect(mocks.refetchSearch).not.toHaveBeenCalled();
  });
});
