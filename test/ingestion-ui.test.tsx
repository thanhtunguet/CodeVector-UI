import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IngestionActions } from '../src/components/sources/IngestionActions';
import { IngestionStatusPanel } from '../src/components/sources/IngestionStatusPanel';
import type { IngestionOperation, IngestionStatus, Source } from '../src/services/api';

const mocks = vi.hoisted(() => ({
  status: undefined as IngestionStatus | undefined,
  operation: undefined as IngestionOperation | undefined,
  operations: {} as Record<string, IngestionOperation>,
  sources: [] as Source[],
  trigger: vi.fn(), retry: vi.fn(), cancelGroup: vi.fn(), cancelRun: vi.fn(),
}));
vi.mock('../src/hooks/useProjects', () => ({
  useProjectSources: () => ({ data: mocks.sources, isPending: false, error: null }),
}));
vi.mock('../src/hooks/useIngestion', () => ({
  useProjectIngestion: () => ({ data: mocks.status, isPending: false, error: null, refetch: vi.fn() }),
  useIngestionOperation: (_code: string, id?: string) => ({ data: mocks.operations[id ?? ''] ?? mocks.operation, error: null }),
  useTriggerPipelineIngest: () => ({ mutateAsync: mocks.trigger, isPending: false }),
  useRetryPipelineIngest: () => ({ mutateAsync: mocks.retry, isPending: false }),
  useCancelIngestionOperation: () => ({ mutateAsync: mocks.cancelGroup, isPending: false }),
  useCancelIngestionRun: () => ({ mutateAsync: mocks.cancelRun, isPending: false }),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const op = (): IngestionOperation => ({
  operationId: 'op-both', projectCode: 'demo', kind: 'both', target: 'both', state: 'running',
  statusUrl: '/status', createdAt: '2026-10-14T00:00:00Z', options: { pipeline: 'both' },
  children: [
    { id: 'source-child', pipeline: 'source', state: 'succeeded', runId: 'run-source', snapshotId: 'new-source' },
    { id: 'docs-child', pipeline: 'docs', state: 'pending', runId: null, snapshotId: null },
  ],
});
const idle = (): IngestionStatus => ({ projectCode: 'demo', activeRun: null, activeOperation: null, pipelines: {
  source: { headId: 'source-head', published: { id: 'source-head', projectCode: 'demo', pipeline: 'source', state: 'published', createdAt: '2026-10-14', codeGraph: { state: 'ready' }, codeSemantic: { state: 'unavailable', reason: 'No embeddings' } }, runs: [] },
  docs: { headId: 'docs-head', published: { id: 'docs-head', projectCode: 'demo', pipeline: 'docs', state: 'published', createdAt: '2026-10-14', documentParse: { state: 'partial', counts: { eligible: 5, captured: 4, parsed: 3, embedded: 2 } }, documentSemantic: { state: 'partial' } }, runs: [] },
} });
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
async function render(element: ReturnType<typeof createElement>) {
  await act(async () => { root.render(createElement(QueryClientProvider, { client }, element)); });
  await flush();
}
function buttons(text: string) { return [...document.querySelectorAll('button')].filter(button => button.textContent?.trim() === text); }
async function click(text: string) {
  const button = buttons(text).at(-1);
  expect(button, `button ${text}`).toBeDefined();
  await act(async () => button!.click());
  await flush();
}
beforeEach(() => {
  mocks.status = idle(); mocks.operation = undefined; mocks.operations = {};
  mocks.sources = [{ id: 'input', projectCode: 'demo', name: 'Mixed directory', kind: 'repository', locator: { type: 'local_directory', path: '/example' }, createdAt: '2026-10-14' }];
  for (const mock of [mocks.trigger, mocks.retry, mocks.cancelGroup, mocks.cancelRun]) mock.mockReset().mockResolvedValue(op());
  localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });

describe('shared ingestion controls', () => {
  it.each(['source', 'docs', 'both'] as const)('submits %s with only its strictness flags', async pipeline => {
    const label = pipeline === 'source' ? 'Source' : pipeline === 'docs' ? 'Docs' : 'Both';
    await render(createElement(IngestionActions, { projectCode: 'demo' }));
    await click(`Ingest ${label}`);
    const switches = [...document.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
    expect(switches).toHaveLength(pipeline === 'both' ? 2 : 1);
    // Both flags remain independently controlled.
    await act(async () => switches[0].click());
    await click(`Ingest ${label}`);
    expect(mocks.trigger).toHaveBeenCalledTimes(1);
    expect(mocks.trigger.mock.calls[0][0]).toMatchObject({ code: 'demo', input: pipeline === 'source'
      ? { pipeline, requireSemantic: true } : pipeline === 'docs'
        ? { pipeline, requireDocumentSemantic: true } : { pipeline, requireSemantic: true, requireDocumentSemantic: false } });
    expect(mocks.trigger.mock.calls[0][0].requestKey).toEqual(expect.any(String));
    expect(localStorage.getItem('codevector:ingestion-operation:demo')).toBe('op-both');
  });

  it('disables all actions without registered inputs and explains why', async () => {
    mocks.sources = [];
    await render(createElement('div', null, createElement(IngestionActions, { projectCode: 'demo' }), createElement(IngestionStatusPanel, { projectCode: 'demo' })));
    expect(buttons('Ingest Source')[0].disabled).toBe(true);
    expect(buttons('Ingest Docs')[0].disabled).toBe(true);
    expect(buttons('Ingest Both')[0].disabled).toBe(true);
    expect(container.textContent).toContain('No registered inputs');
  });

  it('renders the panel when status is not pending but has no data', async () => {
    mocks.status = undefined;
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    expect(container.textContent).toContain('Pipeline status is unavailable from this server');
  });

  it('keeps Both pending gaps busy and displays both children without an active run', async () => {
    mocks.operation = op(); mocks.status!.activeOperation = mocks.operation;
    await render(createElement('div', null, createElement(IngestionActions, { projectCode: 'demo' }), createElement(IngestionStatusPanel, { projectCode: 'demo' })));
    expect(buttons('Ingest Docs')[0].disabled).toBe(true);
    expect(container.textContent).toContain('Both operation · running');
    expect(container.textContent).not.toContain('Legacy mixed operation');
    expect(container.textContent).toContain('Queued child');
    expect(container.textContent).toContain('Pending dispatch · no run yet');
    expect(container.textContent).toContain('succeeded');
    await click('Cancel Both');
    expect(mocks.cancelGroup).toHaveBeenCalledWith({ code: 'demo', operationId: 'op-both' });
  });

  it('preserves the Legacy mixed label for legacy operations and children', async () => {
    mocks.operation = { ...op(), kind: 'legacy_mixed', target: 'legacy_mixed', children: [
      { id: 'mixed-child', pipeline: 'mixed', state: 'running', runId: 'mixed-run', snapshotId: 'mixed-snapshot' },
    ] };
    mocks.status!.activeOperation = mocks.operation;
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    expect(container.textContent).toContain('Legacy mixed operation · running');
    expect(container.textContent).not.toContain('Both operation');
  });

  it('labels a Both operation separately from a legacy mixed run', async () => {
    mocks.operation = op(); mocks.status!.activeOperation = mocks.operation;
    mocks.status!.runs = [{ id: 'legacy-run', projectCode: 'demo', snapshotId: 'legacy-snapshot', state: 'failed', startedAt: '2026-10-14T00:00:00Z', executionKind: 'legacy_mixed' }];
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    expect(container.textContent).toContain('Both operation · running');
    expect(container.textContent).toContain('Legacy mixed · failed');
    expect(container.textContent).not.toContain('Legacy mixed operation');
  });

  it('keeps a newer active operation selected after it ends', async () => {
    const previous = { ...op(), operationId: 'op-previous', kind: 'single' as const, target: 'source' as const, state: 'succeeded' as const };
    const next = { ...op(), operationId: 'op-next' };
    mocks.operations = { [previous.operationId]: previous, [next.operationId]: next };
    mocks.status!.runs = [{ id: 'previous-run', projectCode: 'demo', snapshotId: 'previous-snapshot', state: 'succeeded', startedAt: '2026-10-14T00:00:00Z', operationId: previous.operationId }];
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    await click('View operation (selected)');
    expect(container.textContent).toContain('op-previous');

    mocks.status!.activeOperation = next;
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    expect(container.textContent).toContain('op-next');
    expect(localStorage.getItem('codevector:ingestion-operation:demo')).toBe('op-next');

    mocks.status!.activeOperation = null;
    mocks.operations[next.operationId] = { ...next, state: 'succeeded' };
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    expect(container.textContent).toContain('Both operation · succeeded');
    expect(container.textContent).toContain('op-next');
  });

  it('shows a newer failed admission receipt even when no run exists', async () => {
    const previous = { ...op(), operationId: 'op-previous', kind: 'single' as const, target: 'source' as const, state: 'succeeded' as const };
    const failed = { ...op(), operationId: 'op-failed-before-run', kind: 'single' as const, target: 'docs' as const, state: 'failed' as const, children: [] };
    mocks.operations = { [previous.operationId]: previous, [failed.operationId]: failed };
    mocks.status!.runs = [{ id: 'previous-run', projectCode: 'demo', snapshotId: 'previous-snapshot', state: 'succeeded', startedAt: '2026-10-14T00:00:00Z', operationId: previous.operationId }];
    mocks.trigger.mockResolvedValue(failed);
    await render(createElement('div', null, createElement(IngestionActions, { projectCode: 'demo' }), createElement(IngestionStatusPanel, { projectCode: 'demo' })));
    await click('View operation (selected)');
    await click('Ingest Docs');
    await click('Ingest Docs');
    expect(localStorage.getItem('codevector:ingestion-operation:demo')).toBe(failed.operationId);
    expect(container.textContent).toContain('Docs operation · failed');
    expect(container.textContent).toContain(failed.operationId);
  });

  it('shows actual independent heads and readiness instead of latest failed refresh', async () => {
    mocks.status!.pipelines!.docs.latest = { id: 'failed-docs', projectCode: 'demo', pipeline: 'docs', state: 'failed', createdAt: '2026-10-14', failureReason: 'Parser worker unavailable' };
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    const source = container.querySelector('[aria-label="Source pipeline status"]')!;
    const docs = container.querySelector('[aria-label="Docs pipeline status"]')!;
    expect(source.textContent).toContain('source-head');
    expect(source.textContent).toContain('Code graph: ready');
    expect(docs.textContent).toContain('docs-head');
    expect(docs.textContent).toContain('Document parse: partial');
    expect(docs.textContent).toContain('Eligible 5 · captured 4 · parsed 3 · embedded 2');
    expect(docs.textContent).toContain('previous publication head remains current');
    expect(docs.textContent).toContain('Parser worker unavailable');
  });

  it('shows partial success after reload and retries only the failed Docs child', async () => {
    mocks.operation = { ...op(), state: 'partial_success', children: [op().children[0], { ...op().children[1], state: 'failed', failureReason: 'No eligible documents' }] };
    localStorage.setItem('codevector:ingestion-operation:demo', 'op-both');
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    expect(container.textContent).toContain('Partial success');
    expect(buttons('Retry Source')).toHaveLength(0);
    await click('Retry Docs');
    expect(document.querySelectorAll('[role="switch"]')).toHaveLength(1);
    await click('Retry Docs');
    expect(mocks.retry).toHaveBeenCalledWith(expect.objectContaining({ code: 'demo', operationId: 'op-both', input: { pipeline: 'docs', requireDocumentSemantic: false } }));
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it('shows progress and counters and sends targeted run cancellation', async () => {
    mocks.status!.pipelines!.docs.activeRun = { id: 'docs-run', projectCode: 'demo', snapshotId: 'building-docs', state: 'running', startedAt: '2026-10-14', executionKind: 'docs', stage: 'document_parse', completedUnits: 3, totalUnits: 5, counters: { documentsParsed: 3 } };
    await render(createElement(IngestionStatusPanel, { projectCode: 'demo' }));
    expect(container.textContent).toContain('3 / 5 units');
    expect(container.textContent).toContain('documents parsed: 3');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('60');
    await click('Cancel Docs');
    expect(mocks.cancelRun).toHaveBeenCalledWith({ code: 'demo', runId: 'docs-run' });
  });

  it('renders server admission conflicts in the dialog', async () => {
    mocks.trigger.mockRejectedValue(new Error('INGESTION_CONFLICT: another operation is active'));
    await render(createElement(IngestionActions, { projectCode: 'demo' }));
    await click('Ingest Source'); await click('Ingest Source');
    expect(document.body.textContent).toContain('INGESTION_CONFLICT');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('closes the previous project dialog and clears strictness on project changes', async () => {
    await render(createElement(IngestionActions, { projectCode: 'demo' }));
    await click('Ingest Both');
    await act(async () => (document.querySelector('[role="switch"]') as HTMLButtonElement).click());
    await render(createElement(IngestionActions, { projectCode: 'other' }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await click('Ingest Docs');
    expect(document.body.textContent).toContain('other · other');
    expect(document.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
    await click('Ingest Docs');
    expect(mocks.trigger.mock.calls[0][0].code).toBe('other');
  });
});
