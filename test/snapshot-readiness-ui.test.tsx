import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SnapshotDetailSheet } from '../src/components/snapshots/SnapshotDetailSheet';
import { SnapshotReadinessDisplay } from '../src/components/snapshots/SnapshotReadinessDisplay';
import type { Snapshot } from '../src/services/api';

const mocks = vi.hoisted(() => ({ fetched: undefined as Snapshot | undefined }));
vi.mock('../src/hooks/useProjects', () => ({
  useProjectSnapshot: () => ({ data: mocks.fetched, isLoading: false }),
}));
vi.mock('../src/components/worker/WorkerEventPanel', () => ({ WorkerEventPanel: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
const snapshot = (fields: Partial<Snapshot>): Snapshot => ({
  id: 'historical-snapshot', projectCode: 'demo', state: 'published', createdAt: '2026-10-14T00:00:00Z', ...fields,
});
async function render(element: ReturnType<typeof createElement>) {
  await act(async () => { root.render(element); });
}
beforeEach(() => {
  mocks.fetched = undefined;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('historical snapshot readiness', () => {
  it('uses source readiness instead of a legacy full capability label', async () => {
    mocks.fetched = snapshot({ pipeline: 'source', indexCapability: 'full', codeGraph: { state: 'ready' }, codeSemantic: { state: 'unavailable', reason: 'Embedding service offline' } });
    await render(createElement(SnapshotDetailSheet, { projectCode: 'demo', snapshotId: mocks.fetched.id, open: true, onOpenChange: vi.fn() }));
    expect(document.body.textContent).toContain('Pipeline: Source');
    expect(document.body.textContent).toContain('Code graph: ready');
    expect(document.body.textContent).toContain('Code semantics: unavailable');
    expect(document.body.textContent).toContain('Embedding service offline');
    expect(document.body.textContent).not.toContain('Semantic & Graph');
    expect(document.body.textContent).not.toContain('Document parse:');
  });

  it('uses docs readiness even when the old index capability says none', async () => {
    mocks.fetched = snapshot({ pipeline: 'docs', indexCapability: 'none', documentParse: { state: 'partial', reason: 'One unsupported file' }, documentSemantic: { state: 'ready' } });
    await render(createElement(SnapshotDetailSheet, { projectCode: 'demo', snapshotId: mocks.fetched.id, open: true, onOpenChange: vi.fn() }));
    expect(document.body.textContent).toContain('Pipeline: Docs');
    expect(document.body.textContent).toContain('Document parse: partial');
    expect(document.body.textContent).toContain('Document semantics: ready');
    expect(document.body.textContent).toContain('One unsupported file');
    expect(document.body.textContent).not.toContain('Code graph:');
  });

  it('keeps missing legacy provenance unknown in the compact project summary', async () => {
    await render(createElement(SnapshotReadinessDisplay, { snapshot: snapshot({ indexCapability: 'full' }), compact: true }));
    expect(container.textContent).toContain('Pipeline: Unknown (legacy snapshot)');
    expect(container.textContent).toContain('Code graph: unknown');
    expect(container.textContent).toContain('Code semantics: unknown');
    expect(container.textContent).toContain('Document parse: unknown');
    expect(container.textContent).toContain('Document semantics: unknown');
    expect(container.textContent).not.toContain('full');
  });
});
