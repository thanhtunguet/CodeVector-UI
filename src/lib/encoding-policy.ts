/**
 * Pure helpers for the per-source encoding policy editor and the revision encoding report.
 * Kept free of React so the form <-> policy mapping and the PATCH payload are unit-testable.
 */
import type {
  EncodingCatalogEntry,
  EncodingOverrideRule,
  RevisionEncodingReport,
  SourceEncodingPolicy,
} from '@/services/api';

/** Used only until GET /encodings reports the server's own default. */
export const FALLBACK_CONFIDENCE_THRESHOLD = 0.2;

/** Mirrors the server limits (`ENCODING_POLICY_LIMITS`). */
export const ENCODING_POLICY_CLIENT_LIMITS = {
  candidates: 64,
  overrides: 100,
  selectorLength: 4096,
} as const;

export type OverrideKind = 'extension' | 'glob' | 'path';
export const OVERRIDE_KINDS: readonly OverrideKind[] = ['extension', 'glob', 'path'];

export interface OverrideRowForm {
  /** Stable React key; never sent to the server. */
  id: string;
  kind: OverrideKind;
  value: string;
  encoding: string;
}

export interface EncodingPolicyForm {
  autoGuess: boolean;
  siblingConsensus: boolean;
  /** Empty means every supported encoding. */
  candidates: string[];
  overrides: OverrideRowForm[];
  /** Text of the number input; blank means the server default. */
  threshold: string;
}

let rowCounter = 0;
export function newOverrideRow(partial: Partial<Omit<OverrideRowForm, 'id'>> = {}): OverrideRowForm {
  rowCounter += 1;
  return { id: `new-${rowCounter}`, kind: 'extension', value: '', encoding: '', ...partial };
}

export function defaultPolicyForm(): EncodingPolicyForm {
  return { autoGuess: true, siblingConsensus: true, candidates: [], overrides: [], threshold: '' };
}

function ruleToRow(rule: EncodingOverrideRule, index: number): OverrideRowForm {
  const kind = OVERRIDE_KINDS.find((candidate) => rule[candidate] !== undefined) ?? 'extension';
  return { id: `rule-${index}`, kind, value: rule[kind] ?? '', encoding: rule.encoding };
}

export function policyToForm(policy: SourceEncodingPolicy | null | undefined): EncodingPolicyForm {
  const form = defaultPolicyForm();
  if (!policy) return form;
  return {
    autoGuess: policy.autoGuessEncoding ?? true,
    siblingConsensus: policy.siblingEncodingConsensus ?? true,
    candidates: [...(policy.candidateGuessEncodings ?? [])],
    overrides: (policy.encodingOverrides ?? []).map(ruleToRow),
    threshold:
      policy.encodingConfidenceThreshold === undefined ? '' : String(policy.encodingConfidenceThreshold),
  };
}

/** The numeric threshold of the form, or `undefined` when blank or not a number. */
export function parseThreshold(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export interface EncodingPolicyFormErrors {
  /** Row id -> message. */
  rows: Record<string, string>;
  threshold?: string;
  general?: string;
}

export function validatePolicyForm(form: EncodingPolicyForm): EncodingPolicyFormErrors {
  const errors: EncodingPolicyFormErrors = { rows: {} };
  if (form.candidates.length > ENCODING_POLICY_CLIENT_LIMITS.candidates) {
    errors.general = `At most ${ENCODING_POLICY_CLIENT_LIMITS.candidates} candidate encodings are allowed.`;
  }
  if (form.overrides.length > ENCODING_POLICY_CLIENT_LIMITS.overrides) {
    errors.general = `At most ${ENCODING_POLICY_CLIENT_LIMITS.overrides} override rules are allowed.`;
  }
  for (const row of form.overrides) {
    const value = row.value.trim();
    if (value === '') {
      errors.rows[row.id] = `Enter a ${row.kind} to match.`;
    } else if (value.length > ENCODING_POLICY_CLIENT_LIMITS.selectorLength || value.includes('\0')) {
      errors.rows[row.id] = `The ${row.kind} must be at most ${ENCODING_POLICY_CLIENT_LIMITS.selectorLength} characters without NUL.`;
    } else if (row.encoding.trim() === '') {
      errors.rows[row.id] = 'Choose an encoding.';
    }
  }
  const text = form.threshold.trim();
  if (text !== '') {
    const value = parseThreshold(text);
    if (value === undefined || value <= 0 || value > 1) {
      errors.threshold = 'The confidence threshold must be a number greater than 0 and at most 1 (or blank for the default).';
    }
  }
  return errors;
}

export function hasFormErrors(errors: EncodingPolicyFormErrors): boolean {
  return Boolean(errors.general) || Boolean(errors.threshold) || Object.keys(errors.rows).length > 0;
}

/**
 * Builds the policy sent to the server. Fields equal to the server defaults are omitted;
 * returns `null` (clear the policy) when nothing differs from the defaults. Assumes the
 * form validated. `defaultThreshold` is the server's default from GET /encodings.
 */
export function formToPolicy(
  form: EncodingPolicyForm,
  defaultThreshold: number = FALLBACK_CONFIDENCE_THRESHOLD
): SourceEncodingPolicy | null {
  const policy: SourceEncodingPolicy = { version: '1' };
  if (!form.autoGuess) policy.autoGuessEncoding = false;
  // Sibling consensus is ignored when auto-guess is off, so a stale `false` is not worth sending then.
  if (form.autoGuess && !form.siblingConsensus) policy.siblingEncodingConsensus = false;
  if (form.candidates.length > 0) policy.candidateGuessEncodings = [...form.candidates];
  if (form.overrides.length > 0) {
    policy.encodingOverrides = form.overrides.map((row) => ({
      [row.kind]: row.value.trim(),
      encoding: row.encoding.trim(),
    })) as unknown as EncodingOverrideRule[];
  }
  const threshold = parseThreshold(form.threshold);
  if (threshold !== undefined && threshold !== defaultThreshold) {
    policy.encodingConfidenceThreshold = threshold;
  }
  return Object.keys(policy).length === 1 ? null : policy;
}

/** True when saving the form would not change what the server has stored. */
export function isFormPristine(
  form: EncodingPolicyForm,
  stored: SourceEncodingPolicy | null | undefined,
  defaultThreshold: number = FALLBACK_CONFIDENCE_THRESHOLD
): boolean {
  return (
    JSON.stringify(formToPolicy(form, defaultThreshold)) ===
    JSON.stringify(formToPolicy(policyToForm(stored), defaultThreshold))
  );
}

/** Candidate guesses are restricted to the legacy family; overrides accept every encoding. */
export function legacyEncodingNames(encodings: readonly EncodingCatalogEntry[]): string[] {
  return encodings.filter((entry) => entry.family === 'legacy').map((entry) => entry.name);
}

export function allEncodingNames(encodings: readonly EncodingCatalogEntry[]): string[] {
  return encodings.map((entry) => entry.name);
}

// ---------------------------------------------------------------------------
// Revision encoding report
// ---------------------------------------------------------------------------

export const GAIJI_NOTE =
  'Files containing gaiji (CP932 private-use characters) or the EUC-JP FULLWIDTH TILDE cannot be captured even with an override - convert them to UTF-8.';

export const SIBLING_INFERRED_TOOLTIP =
  "Inferred from sibling files, not from this file's own bytes; add an override rule to pin it.";

/** Encoding counts, largest first, then by name. */
export function sortedEncodingCounts(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** True when the revision has anything to show (a UTF-8-only capture has no `encoding` key). */
export function hasEncodingReport(encoding: RevisionEncodingReport | undefined | null): encoding is RevisionEncodingReport {
  if (!encoding) return false;
  return (
    Object.keys(encoding.counts ?? {}).length > 0 ||
    (encoding.files?.length ?? 0) > 0 ||
    Boolean(encoding.undetectable && encoding.undetectable.count > 0)
  );
}

/** The client-side gaiji guidance, unless the server remedy already says it. */
export function needsGaijiNote(remedy: string | undefined): boolean {
  return !remedy || !/gaiji/i.test(remedy);
}
