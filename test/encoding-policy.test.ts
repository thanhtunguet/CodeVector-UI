import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultPolicyForm,
  formToPolicy,
  hasEncodingReport,
  hasFormErrors,
  isFormPristine,
  legacyEncodingNames,
  needsGaijiNote,
  newOverrideRow,
  policyToForm,
  sortedEncodingCounts,
  validatePolicyForm,
} from '../src/lib/encoding-policy';
import { isEncodingCatalog } from '../src/hooks/useSettings';
import { updateSourceEncodingPolicy, type SourceEncodingPolicy } from '../src/services/api';

describe('encoding policy form mapping', () => {
  it('maps an untouched form to a null policy (clear)', () => {
    expect(formToPolicy(defaultPolicyForm())).toBeNull();
    expect(formToPolicy(policyToForm(null))).toBeNull();
    expect(formToPolicy(policyToForm(undefined))).toBeNull();
    expect(formToPolicy(policyToForm({ version: '1' }))).toBeNull();
  });

  it('omits fields equal to the server defaults', () => {
    const form = { ...defaultPolicyForm(), threshold: '0.2' };
    expect(formToPolicy(form, 0.2)).toBeNull();
    expect(formToPolicy({ ...form, threshold: '0.35' }, 0.2)).toEqual({ version: '1', encodingConfidenceThreshold: 0.35 });
    // The default comes from GET /encodings, not from a constant.
    expect(formToPolicy({ ...form, threshold: '0.2' }, 0.5)).toEqual({ version: '1', encodingConfidenceThreshold: 0.2 });
  });

  it('builds a full policy', () => {
    const form = policyToForm(null);
    form.autoGuess = true;
    form.siblingConsensus = false;
    form.candidates = ['windows-31j', 'euc-jp'];
    form.overrides = [
      newOverrideRow({ kind: 'extension', value: ' .frm ', encoding: 'windows-31j' }),
      newOverrideRow({ kind: 'path', value: 'a/b.bas', encoding: 'euc-jp' }),
      newOverrideRow({ kind: 'glob', value: 'legacy/**', encoding: 'gbk' }),
    ];
    form.threshold = '0.5';
    expect(formToPolicy(form)).toEqual({
      version: '1',
      siblingEncodingConsensus: false,
      candidateGuessEncodings: ['windows-31j', 'euc-jp'],
      encodingOverrides: [
        { extension: '.frm', encoding: 'windows-31j' },
        { path: 'a/b.bas', encoding: 'euc-jp' },
        { glob: 'legacy/**', encoding: 'gbk' },
      ],
      encodingConfidenceThreshold: 0.5,
    });
  });

  it('sends exactly one selector per rule and drops sibling consensus when auto-guess is off', () => {
    const form = {
      ...defaultPolicyForm(),
      autoGuess: false,
      siblingConsensus: false,
      overrides: [newOverrideRow({ kind: 'glob', value: '*.cls', encoding: 'windows-31j' })],
    };
    const policy = formToPolicy(form)!;
    expect(policy.autoGuessEncoding).toBe(false);
    expect(policy).not.toHaveProperty('siblingEncodingConsensus');
    expect(Object.keys(policy.encodingOverrides![0]!).sort()).toEqual(['encoding', 'glob']);
  });

  it('round-trips a stored policy', () => {
    const stored: SourceEncodingPolicy = {
      version: '1',
      autoGuessEncoding: false,
      candidateGuessEncodings: ['big5'],
      encodingOverrides: [{ path: 'x.txt', encoding: 'gbk' }, { extension: '.bas', encoding: 'windows-31j' }],
      encodingConfidenceThreshold: 0.7,
    };
    const form = policyToForm(stored);
    expect(form.overrides.map(({ kind, value, encoding }) => ({ kind, value, encoding }))).toEqual([
      { kind: 'path', value: 'x.txt', encoding: 'gbk' },
      { kind: 'extension', value: '.bas', encoding: 'windows-31j' },
    ]);
    expect(formToPolicy(form)).toEqual(stored);
    expect(isFormPristine(form, stored)).toBe(true);
    expect(isFormPristine({ ...form, candidates: [] }, stored)).toBe(false);
    expect(isFormPristine(defaultPolicyForm(), null)).toBe(true);
  });
});

describe('encoding policy form validation', () => {
  it('requires a selector value and an encoding on every rule', () => {
    const blank = newOverrideRow();
    const noEncoding = newOverrideRow({ value: '.frm' });
    const ok = newOverrideRow({ value: '.frm', encoding: 'windows-31j' });
    const errors = validatePolicyForm({ ...defaultPolicyForm(), overrides: [blank, noEncoding, ok] });
    expect(errors.rows[blank.id]).toMatch(/extension/);
    expect(errors.rows[noEncoding.id]).toMatch(/encoding/i);
    expect(errors.rows[ok.id]).toBeUndefined();
    expect(hasFormErrors(errors)).toBe(true);
    const whitespace = newOverrideRow({ value: '   ', encoding: 'gbk' });
    expect(validatePolicyForm({ ...defaultPolicyForm(), overrides: [whitespace] }).rows[whitespace.id]).toBeDefined();
  });

  it('accepts thresholds in (0, 1] or blank and rejects the rest', () => {
    const check = (threshold: string) => validatePolicyForm({ ...defaultPolicyForm(), threshold }).threshold;
    for (const valid of ['', '  ', '0.01', '0.2', '1', '1.0']) expect(check(valid), valid).toBeUndefined();
    for (const invalid of ['0', '-0.1', '1.01', '2', 'abc', 'NaN', 'Infinity']) expect(check(invalid), invalid).toBeDefined();
    expect(hasFormErrors(validatePolicyForm(defaultPolicyForm()))).toBe(false);
  });

  it('enforces the server list limits', () => {
    const rows = Array.from({ length: 101 }, () => newOverrideRow({ value: '.a', encoding: 'gbk' }));
    expect(validatePolicyForm({ ...defaultPolicyForm(), overrides: rows }).general).toMatch(/100/);
    const candidates = Array.from({ length: 65 }, (_, i) => `enc-${i}`);
    expect(validatePolicyForm({ ...defaultPolicyForm(), candidates }).general).toMatch(/64/);
  });
});

describe('revision encoding helpers', () => {
  it('sorts counts by size then name and detects an empty report', () => {
    expect(sortedEncodingCounts({ b: 2, a: 2, c: 9 })).toEqual([['c', 9], ['a', 2], ['b', 2]]);
    expect(hasEncodingReport(undefined)).toBe(false);
    expect(hasEncodingReport({ counts: {}, files: [], filesTruncated: false })).toBe(false);
    expect(hasEncodingReport({ counts: { gbk: 1 }, files: [], filesTruncated: false })).toBe(true);
    expect(
      hasEncodingReport({ counts: {}, files: [], filesTruncated: false, undetectable: { count: 1, countExact: true, sample: [], remedy: 'r' } })
    ).toBe(true);
  });

  it('adds the gaiji note only when the server remedy lacks it', () => {
    expect(needsGaijiNote('Add an override.')).toBe(true);
    expect(needsGaijiNote('Files with gaiji cannot be captured.')).toBe(false);
  });

  it('offers only legacy encodings for candidate guesses', () => {
    expect(
      legacyEncodingNames([
        { name: 'utf-8', family: 'utf8', multiByte: true },
        { name: 'utf-16le', family: 'utf16', multiByte: true },
        { name: 'windows-31j', family: 'legacy', multiByte: true },
        { name: 'windows-1252', family: 'legacy', multiByte: false },
      ])
    ).toEqual(['windows-31j', 'windows-1252']);
  });
});

describe('GET /encodings runtime shape guard', () => {
  const valid = {
    encodings: [{ name: 'windows-31j', family: 'legacy', multiByte: true }],
    detector: 'jschardet@4.0.0',
    defaultConfidenceThreshold: 0.2,
    undetectableRemedy: 'Add an override.',
  };

  it('accepts the documented contract', () => {
    expect(isEncodingCatalog(valid)).toBe(true);
    expect(isEncodingCatalog({ ...valid, encodings: [] })).toBe(true);
  });

  it('rejects malformed responses', () => {
    expect(isEncodingCatalog(null)).toBe(false);
    expect(isEncodingCatalog([])).toBe(false);
    expect(isEncodingCatalog({ ...valid, encodings: undefined })).toBe(false);
    expect(isEncodingCatalog({ ...valid, encodings: [{ name: 'x', family: 'other', multiByte: false }] })).toBe(false);
    expect(isEncodingCatalog({ ...valid, encodings: [{ name: 'x', family: 'legacy' }] })).toBe(false);
    expect(isEncodingCatalog({ ...valid, encodings: ['windows-31j'] })).toBe(false);
    expect(isEncodingCatalog({ ...valid, defaultConfidenceThreshold: '0.2' })).toBe(false);
    expect(isEncodingCatalog({ ...valid, defaultConfidenceThreshold: Number.NaN })).toBe(false);
    expect(isEncodingCatalog({ ...valid, detector: 1 })).toBe(false);
    expect(isEncodingCatalog({ ...valid, undetectableRemedy: undefined })).toBe(false);
  });
});

describe('updateSourceEncodingPolicy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('PATCHes { encodingPolicy } and returns the updated source', async () => {
    const source = { id: 's/1', projectCode: 'demo', name: 'n', kind: 'repository', locator: { type: 'local_directory', path: '/x' }, createdAt: 't' };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(source), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(updateSourceEncodingPolicy('demo', 's/1', null)).resolves.toMatchObject({ id: 's/1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/projects\/demo\/sources\/s%2F1$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ encodingPolicy: null });
  });

  it("surfaces the server's invalid_input message", async () => {
    const body = { error: 'Invalid source encoding policy: unsupported encoding "klingon"', code: 'invalid_input' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 400, headers: { 'Content-Type': 'application/json' } })));
    await expect(updateSourceEncodingPolicy('demo', 's1', { version: '1', candidateGuessEncodings: ['klingon'] })).rejects.toThrow(
      'unsupported encoding "klingon"'
    );
  });
});
