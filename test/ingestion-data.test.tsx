import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelIngestionOperation, cancelIngestionRun, getIngestionOperation, getProjectSnapshots,
  retryPipelineIngest, triggerPipelineIngest,
  type IngestionOperation, type IngestionStatus, type PipelineIngestRequest,
} from '../src/services/api';
import { useIngestionOperation, useProjectIngestion, useTriggerPipelineIngest } from '../src/hooks/useIngestion';
import {
  ingestionKeys, invalidateIngestionViews, isIngestionActive, isOperationActive,
} from '../src/hooks/ingestionQueries';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operation = (state: IngestionOperation['state'] = 'pending'): IngestionOperation => ({
  operationId: 'op/1', projectCode: 'demo', kind: 'both', target: 'both', state,
  statusUrl: '/projects/demo/ingestion/operations/op%2F1', createdAt: '2026-10-14T00:00:00Z',
  options: { pipeline: 'both', requireSemantic: true, requireDocumentSemantic: false },
  children: [
    { id: 'source-child', pipeline: 'source', state: 'pending', runId: null, snapshotId: null },
    { id: 'docs-child', pipeline: 'docs', state: 'pending', runId: null, snapshotId: null },
  ],
});

const status = (activeOperation: IngestionOperation | null = operation()): IngestionStatus => ({
  projectCode: 'demo', activeOperation, activeRun: null,
  pipelines: {
    source: { headId: 'old-source', runs: [] },
    docs: { headId: 'old-docs', runs: [] },
  },
});

let root: Root | undefined;
let queryClient: QueryClient | undefined;
let container: HTMLDivElement | undefined;

async function mount(render: () => unknown) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  function Probe() { render(); return null; }
  await act(async () => {
    root!.render(createElement(QueryClientProvider, { client: queryClient! }, createElement(Probe)));
  });
  await flush();
  return queryClient;
}

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
}

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  queryClient?.clear();
  container?.remove();
  root = undefined;
  queryClient = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockJson(value: unknown) {
  return vi.fn().mockImplementation(async () => new Response(JSON.stringify(value), { status: 200 }));
}

describe('pipeline ingestion API contracts', () => {
  it.each<PipelineIngestRequest>([
    { pipeline: 'source' as const, requireSemantic: true },
    { pipeline: 'docs' as const, requireDocumentSemantic: false },
    { pipeline: 'both' as const, requireSemantic: true, requireDocumentSemantic: false },
  ])('sends only the $pipeline strict flags with the request key', async input => {
    const fetch = mockJson(operation());
    vi.stubGlobal('fetch', fetch);
    const receipt = await triggerPipelineIngest('a/b', input, 'request-1');
    expect(receipt.children[0].runId).toBeNull();
    const { pipeline, ...flags } = input;
    expect(fetch).toHaveBeenCalledWith(`/api/projects/a%2Fb/ingest/${pipeline}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'request-1' },
      body: JSON.stringify(flags),
    });
  });

  it('keeps operation and child cancellation as distinct encoded routes', async () => {
    const fetch = mockJson(operation());
    vi.stubGlobal('fetch', fetch);
    await getIngestionOperation('a/b', 'op/1');
    await cancelIngestionOperation('a/b', 'op/1');
    await cancelIngestionRun('a/b', 'run/1');
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      '/api/projects/a%2Fb/ingestion/operations/op%2F1',
      '/api/projects/a%2Fb/ingestion/operations/op%2F1/cancel',
      '/api/projects/a%2Fb/ingestion/run%2F1/cancel',
    ]);
  });

  it('retries exactly one pipeline and preserves linkage through the dedicated route', async () => {
    const fetch = mockJson(operation());
    vi.stubGlobal('fetch', fetch);
    await retryPipelineIngest('demo', 'op/1', { pipeline: 'docs', requireDocumentSemantic: true }, 'retry-1');
    expect(fetch).toHaveBeenCalledWith('/api/projects/demo/ingestion/operations/op%2F1/retry/docs', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'retry-1' },
      body: '{"requireDocumentSemantic":true}',
    });
  });

  it('surfaces admission conflicts as failed requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"project is reserved by op_busy"}', { status: 409 })));
    await expect(triggerPipelineIngest('demo', { pipeline: 'source' })).rejects.toThrow('project is reserved by op_busy');
  });

  it('filters snapshots by pipeline and includes legacy mixed publications', async () => {
    const snapshots = [{ id: 'source', pipeline: 'source' }, { id: 'docs', pipeline: 'docs' }, { id: 'mixed', pipeline: 'mixed' }, { id: 'legacy' }];
    vi.stubGlobal('fetch', mockJson({ snapshots }));
    expect((await getProjectSnapshots('demo', 'docs')).map(item => item.id)).toEqual(['docs', 'mixed', 'legacy']);
    expect(await getProjectSnapshots('demo')).toEqual(snapshots);
  });
});

describe('scoped query and polling behavior', () => {
  it('distinguishes pending gaps, Docs work and terminal partial success', () => {
    expect(isIngestionActive(status())).toBe(true);
    expect(isIngestionActive({ ...status(null), pipelines: {
      ...status().pipelines!, docs: { headId: null, runs: [], activeRun: { id: 'docs-run', projectCode: 'demo', snapshotId: 's', state: 'running', startedAt: '' } },
    } })).toBe(true);
    expect(isOperationActive({ ...operation('partial_success'), children: [
      { ...operation().children[0], state: 'succeeded' }, { ...operation().children[1], state: 'failed' },
    ] })).toBe(false);
  });

  it('keys separate projects, pipelines, operations and snapshots', () => {
    const keys = [ingestionKeys.status('a'), ingestionKeys.status('b'), ingestionKeys.pipeline('a', 'source'),
      ingestionKeys.pipeline('a', 'docs'), ingestionKeys.operation('a', 'one'), ingestionKeys.operation('a', 'two'),
      ingestionKeys.snapshots('a'), ingestionKeys.snapshots('a', 'docs')];
    expect(new Set(keys.map(key => JSON.stringify(key))).size).toBe(keys.length);
  });

  it('invalidates lists/details/readiness for the selected project only', async () => {
    const client = new QueryClient();
    const scoped = [ingestionKeys.status('a'), ingestionKeys.pipeline('a', 'docs'), ingestionKeys.operation('a', 'op'),
      ingestionKeys.snapshots('a'), ['projects', 'a', 'snapshots', 'snap'], ['document-parser-catalog', 'a', 'snap'],
      ['projects', 'a', 'readiness', 'docs', 'snap']];
    const untouched = [ingestionKeys.status('b'), ['document-parser-catalog', 'b', 'snap'], ['document-parser-catalog']];
    [...scoped, ...untouched].forEach(key => client.setQueryData(key, {}));
    await invalidateIngestionViews(client, 'a');
    scoped.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(false));
    client.clear();
  });

  it('resumes polling on reload during a pending gap, even when an old override disables run polling', async () => {
    vi.stubGlobal('fetch', mockJson(status()));
    const client = await mount(() => useProjectIngestion('demo', { refetchInterval: false }));
    const query = client.getQueryCache().find({ queryKey: ingestionKeys.status('demo'), exact: true })!;
    const interval = (query.options as unknown as { refetchInterval: (query: unknown) => number | false }).refetchInterval;
    expect(interval(query)).toBe(2000);
  });

  it('invalidates snapshot details after the first child finishes while the next remains pending', async () => {
    let current = status();
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(current), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const client = await mount(() => useProjectIngestion('demo'));
    const detailKey = ['projects', 'demo', 'snapshots', 'new-source'];
    client.setQueryData(detailKey, { state: 'building' });
    current = status({ ...operation('running'), children: [
      { ...operation().children[0], state: 'succeeded', runId: 'source-run', snapshotId: 'new-source' }, operation().children[1],
    ] });
    await act(async () => { await client.refetchQueries({ queryKey: ingestionKeys.status('demo'), exact: true }); });
    await flush();
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(isIngestionActive(client.getQueryData(ingestionKeys.status('demo')))).toBe(true);
    // A stable terminal sibling does not create a refetch loop.
    expect(client.getQueryCache().findAll({ queryKey: ingestionKeys.status('demo') })).toHaveLength(1);
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('refreshes the exact operation when it disappears from active project status', async () => {
    let current = status();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(current), { status: 200 })));
    const client = await mount(() => useProjectIngestion('demo'));
    const operationKey = ingestionKeys.operation('demo', 'op/1');
    client.setQueryData(operationKey, operation('running'));
    current = status(null);
    await act(async () => { await client.refetchQueries({ queryKey: ingestionKeys.status('demo'), exact: true }); });
    await flush();
    expect(client.getQueryState(operationKey)?.isInvalidated).toBe(true);
    expect(isIngestionActive(client.getQueryData(ingestionKeys.status('demo')))).toBe(false);
  });

  it('switches selected project without displaying or polling the previous project operation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(
      url.includes('/projects/a/') ? { ...status(), projectCode: 'a' } : { ...status(null), projectCode: 'b' }
    ), { status: 200 })));
    let selectProject: (code: string) => void;
    let displayed: IngestionStatus | undefined;
    const client = await mount(() => {
      const [code, setCode] = useState('a');
      selectProject = setCode;
      displayed = useProjectIngestion(code).data;
    });
    expect(displayed?.projectCode).toBe('a');
    await act(async () => { selectProject!('b'); });
    await flush();
    expect(displayed?.projectCode).toBe('b');
    expect(displayed?.activeOperation).toBeNull();
    const previous = client.getQueryCache().find({ queryKey: ingestionKeys.status('a'), exact: true });
    expect(previous?.getObserversCount()).toBe(0);
  });

  it('stops exact-operation polling after partial success and refreshes scoped caches', async () => {
    const terminal = { ...operation('partial_success'), children: [
      { ...operation().children[0], state: 'succeeded' as const },
      { ...operation().children[1], state: 'failed' as const, failureReason: 'parser unavailable' },
    ] };
    vi.stubGlobal('fetch', mockJson(terminal));
    const client = await mount(() => useIngestionOperation('demo', 'op/1'));
    const query = client.getQueryCache().find({ queryKey: ingestionKeys.operation('demo', 'op/1'), exact: true })!;
    const interval = (query.options as unknown as { refetchInterval: (query: unknown) => number | false }).refetchInterval;
    expect(interval(query)).toBe(false);
  });

  it('never automatically retries admission after a network failure', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('network disconnected'));
    vi.stubGlobal('fetch', fetch);
    let mutation: ReturnType<typeof useTriggerPipelineIngest>;
    await mount(() => { mutation = useTriggerPipelineIngest(); });
    await act(async () => {
      await expect(mutation!.mutateAsync({ code: 'demo', input: { pipeline: 'source' }, requestKey: 'stable-request' })).rejects.toThrow('network disconnected');
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
