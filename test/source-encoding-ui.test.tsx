import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SourceEncodingEditor, NEXT_INGESTION_NOTE } from '../src/components/settings/SourceEncodingSection';
import { RevisionEncodingBlock } from '../src/components/snapshots/RevisionEncodingBlock';
import { EvidenceViewerDialog } from '../src/components/retrieval/EvidenceViewerDialog';
import { useEncodingCatalog } from '../src/hooks/useSettings';
import type { EncodingCatalog, EvidenceResult, RevisionEncodingReport, SourceEncodingPolicy } from '../src/services/api';

const mocks = vi.hoisted(() => ({
  getEncodings: vi.fn(),
  evidence: undefined as unknown,
}));
vi.mock('../src/services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/api')>()),
  getEncodings: mocks.getEncodings,
}));
vi.mock('../src/hooks/useRetrieval', () => ({
  useEvidence: () => ({ data: mocks.evidence, isLoading: false, isError: false, error: null }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Radix ScrollArea observes its viewport; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

const catalog: EncodingCatalog = {
  encodings: [
    { name: 'utf-8', family: 'utf8', multiByte: true },
    { name: 'utf-16le', family: 'utf16', multiByte: true },
    { name: 'windows-31j', family: 'legacy', multiByte: true },
    { name: 'euc-jp', family: 'legacy', multiByte: true },
    { name: 'windows-1252', family: 'legacy', multiByte: false },
  ],
  detector: 'jschardet@4.0.0',
  defaultConfidenceThreshold: 0.2,
  undetectableRemedy: 'Add an encoding override rule for the files.',
};

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); }); }
async function render(element: ReturnType<typeof createElement>) {
  await act(async () => { root.render(createElement(QueryClientProvider, { client }, element)); });
  await flush();
}
function byText(selector: string, text: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.trim() === text);
}
async function click(el: Element | undefined | null) {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
  await flush();
}
async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const input = (label: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;

beforeEach(() => {
  mocks.getEncodings.mockReset();
  mocks.evidence = undefined;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); document.body.innerHTML = ''; });

describe('source encoding policy editor', () => {
  const stored: SourceEncodingPolicy = {
    version: '1',
    candidateGuessEncodings: ['windows-31j'],
    encodingOverrides: [{ extension: '.frm', encoding: 'windows-31j' }],
  };
  const mount = (policy: SourceEncodingPolicy | null | undefined, onSave = vi.fn()) =>
    render(createElement(SourceEncodingEditor, { source: { id: 's1', name: 'Legacy VB', encodingPolicy: policy }, catalog, onSave }));

  it('renders stored values, legacy-only candidates and the defaults', async () => {
    await mount(stored);
    expect(document.querySelector('#auto-guess-s1')!.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('#sibling-s1')!.getAttribute('aria-checked')).toBe('true');
    expect(input('Override extension').value).toBe('.frm');
    expect(document.querySelector<HTMLInputElement>('#threshold-s1')!.placeholder).toBe('0.2');
    const candidates = document.querySelector('[data-testid="candidate-encodings"]')!;
    expect(candidates.textContent).toContain('windows-31j');
    expect(candidates.textContent).toContain('euc-jp');
    expect(candidates.textContent).toContain('windows-1252');
    expect(candidates.querySelector('#candidate-utf-8')).toBeNull();
    expect(candidates.querySelector('#candidate-utf-16le')).toBeNull();
    expect(document.body.textContent).toContain('cannot make a file');
  });

  it('disables sibling consensus when auto-guess is off', async () => {
    await mount(null);
    expect(document.querySelector<HTMLButtonElement>('#sibling-s1')!.disabled).toBe(false);
    await click(document.querySelector('#auto-guess-s1'));
    expect(document.querySelector<HTMLButtonElement>('#sibling-s1')!.disabled).toBe(true);
  });

  it('keeps Save disabled until something changes, and never saves an invalid rule', async () => {
    const onSave = vi.fn();
    await mount(null, onSave);
    const save = () => byText('button', 'Save encoding policy') as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    await click(byText('button', 'Add rule'));
    expect(save().disabled).toBe(false);
    await click(save());
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter a extension to match.');
    await type(input('Override extension'), '.frm');
    await click(save());
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Choose an encoding.');
  });

  it('rejects a threshold outside (0, 1]', async () => {
    const onSave = vi.fn();
    await mount(null, onSave);
    const threshold = document.querySelector<HTMLInputElement>('#threshold-s1')!;
    await type(threshold, '1.5');
    await click(byText('button', 'Save encoding policy'));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('greater than 0 and at most 1');
    await type(threshold, '0.5');
    await click(byText('button', 'Save encoding policy'));
    expect(onSave).toHaveBeenCalledWith({ version: '1', encodingConfidenceThreshold: 0.5 });
  });

  it('builds the PATCH payload from the edited form', async () => {
    const onSave = vi.fn();
    await mount(stored, onSave);
    await click(document.querySelector('#sibling-s1'));
    await click(document.querySelector('#candidate-euc-jp'));
    await type(input('Override extension'), 'cls');
    await click(byText('button', 'Save encoding policy'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      version: '1',
      siblingEncodingConsensus: false,
      candidateGuessEncodings: ['windows-31j', 'euc-jp'],
      encodingOverrides: [{ extension: 'cls', encoding: 'windows-31j' }],
    });
  });

  it('saves null (clear) after Reset to defaults, and omits default values', async () => {
    const onSave = vi.fn();
    await mount(stored, onSave);
    await click(byText('button', 'Reset to defaults'));
    expect(document.querySelectorAll('[data-testid="override-row"]')).toHaveLength(0);
    await click(byText('button', 'Save encoding policy'));
    expect(onSave).toHaveBeenCalledWith(null);
  });
});

describe('GET /encodings hook', () => {
  function Probe() {
    const query = useEncodingCatalog();
    return createElement('div', { id: 'probe' }, query.isError ? `error:${(query.error as Error).message}` : query.data ? `ok:${query.data.encodings.length}` : 'pending');
  }

  it('loads a valid catalog', async () => {
    mocks.getEncodings.mockResolvedValue(catalog);
    await render(createElement(Probe));
    expect(document.querySelector('#probe')!.textContent).toBe('ok:5');
  });

  it('fails on an invalid response instead of passing it through', { timeout: 10000 }, async () => {
    mocks.getEncodings.mockResolvedValue({ encodings: [{ name: 'x' }], detector: 'd' });
    await render(createElement(Probe));
    // The hook retries once (1s default delay) before reporting the error.
    for (let i = 0; i < 200 && !document.querySelector('#probe')!.textContent!.startsWith('error'); i += 1) await flush();
    expect(document.querySelector('#probe')!.textContent).toBe('error:The encoding catalog response was invalid');
    expect(mocks.getEncodings).toHaveBeenCalledTimes(2);
  });
});

describe('revision encoding block', () => {
  const report = (extra: Partial<RevisionEncodingReport> = {}): RevisionEncodingReport => ({
    counts: { 'windows-31j': 312, 'euc-jp': 4 },
    files: [
      { path: 'a/Form1.frm', encoding: 'windows-31j', method: 'guess', confidence: 0.93 },
      { path: 'a/Sparse.bas', encoding: 'windows-31j', method: 'sibling' },
      { path: 'b/Pinned.cls', encoding: 'euc-jp', method: 'override' },
    ],
    filesTruncated: true,
    ...extra,
  });
  const mount = (encoding?: RevisionEncodingReport) => render(createElement(RevisionEncodingBlock, { encoding }));

  it('renders nothing for a UTF-8-only capture', async () => {
    await mount(undefined);
    expect(container.innerHTML).toBe('');
    await mount({ counts: {}, files: [], filesTruncated: false });
    expect(container.innerHTML).toBe('');
  });

  it('shows counts, and the file sample behind a toggle with method details', async () => {
    await mount(report());
    expect(container.textContent).toContain('windows-31j: 312');
    expect(container.textContent).toContain('euc-jp: 4');
    expect(container.textContent).not.toContain('Form1.frm');
    await click(container.querySelector('button[aria-expanded]'));
    expect(container.textContent).toContain('a/Form1.frm');
    expect(container.textContent).toContain('guess 93%');
    expect(container.textContent).toContain('override');
    expect(container.textContent).toContain('Only a sample of the files is listed');
    // Sibling-inferred files get an amber "inferred" badge instead of a method label.
    const inferred = byText('span', 'inferred') ?? byText('div', 'inferred');
    expect(inferred).toBeTruthy();
    expect(container.textContent).not.toContain('sibling');
  });

  it('warns about undetectable files with the remedy and the gaiji note', async () => {
    await mount(report({
      undetectable: {
        count: 12, countExact: false,
        sample: [{ path: 'legacy/Odd.frm', message: 'no encoding' }],
        remedy: 'Add an encoding override rule for the files.',
      },
    }));
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('>=12 files skipped');
    expect(alert.textContent).toContain('legacy/Odd.frm');
    expect(alert.textContent).toContain('Add an encoding override rule for the files.');
    expect(alert.textContent).toContain('gaiji (CP932 private-use characters)');
    expect(alert.textContent).toContain('EUC-JP FULLWIDTH TILDE');
  });

  it('prefixes nothing for an exact count and does not repeat the gaiji note', async () => {
    await mount(report({
      undetectable: { count: 1, countExact: true, sample: [], remedy: 'Files with gaiji cannot be captured; convert them.' },
    }));
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('1 file skipped');
    expect(alert.textContent).not.toContain('>=');
    expect(alert.textContent!.match(/gaiji/g)).toHaveLength(1);
  });

  it('shows the undetectable warning even without any captured legacy file', async () => {
    await mount({
      counts: {}, files: [], filesTruncated: false,
      undetectable: { count: 3, countExact: true, sample: [], remedy: 'r' },
    });
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
  });
});

describe('EvidenceViewerDialog source encoding badge', () => {
  const evidence = (extra: Partial<EvidenceResult> = {}): EvidenceResult => ({
    projectCode: 'demo', snapshotId: 'snap', sourceId: 'src', path: 'a/Form1.frm',
    contentHash: 'a'.repeat(64), byteSize: 42, text: 'Option Explicit\n', ...extra,
  });
  const mount = () =>
    render(createElement(EvidenceViewerDialog, { open: true, onOpenChange: vi.fn(), projectCode: 'demo', path: 'a/Form1.frm' }));

  it('shows the encoding of the stored bytes when present', async () => {
    mocks.evidence = evidence({
      sourceEncoding: 'windows-31j',
      range: { startByte: 0, endByte: 16, encoding: 'windows-31j', convention: 'half-open', exact: true },
    });
    await mount();
    expect(document.querySelector('[data-testid="evidence-source-encoding"]')!.textContent).toBe('windows-31j');
  });

  it('shows no badge for UTF-8 evidence', async () => {
    mocks.evidence = evidence();
    await mount();
    expect(document.body.textContent).toContain('42 B');
    expect(document.querySelector('[data-testid="evidence-source-encoding"]')).toBeNull();
  });
});

describe('next-ingestion note', () => {
  it('states that existing snapshots are not modified', () => {
    expect(NEXT_INGESTION_NOTE).toBe('Changes apply to the next ingestion; existing snapshots are not modified.');
  });
});
