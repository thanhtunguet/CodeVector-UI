import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Info, Languages, Plus, Trash2, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useEncodingCatalog } from '@/hooks/useSettings';
import { useProjectSources, useUpdateSourceEncodingPolicy } from '@/hooks/useProjects';
import { useToast } from '@/hooks/use-toast';
import {
  FALLBACK_CONFIDENCE_THRESHOLD,
  OVERRIDE_KINDS,
  allEncodingNames,
  defaultPolicyForm,
  formToPolicy,
  hasFormErrors,
  isFormPristine,
  legacyEncodingNames,
  newOverrideRow,
  policyToForm,
  validatePolicyForm,
  type EncodingPolicyForm,
  type OverrideKind,
  type OverrideRowForm,
} from '@/lib/encoding-policy';
import type {
  EncodingCatalog,
  Project,
  Source,
  SourceEncodingPolicy,
} from '@/services/api';

const KIND_PLACEHOLDERS: Record<OverrideKind, string> = {
  extension: '.frm',
  glob: 'legacy/**/*.cls',
  path: 'src/Module1.bas',
};

export const NEXT_INGESTION_NOTE = 'Changes apply to the next ingestion; existing snapshots are not modified.';

// ---------------------------------------------------------------------------
// Candidate encodings: searchable checkbox list (empty selection = all encodings)
// ---------------------------------------------------------------------------

function CandidateEncodingPicker({
  available,
  selected,
  onChange,
  disabled,
}: {
  available: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [filter, setFilter] = useState('');
  const visible = available.filter((name) => name.toLowerCase().includes(filter.trim().toLowerCase()));
  const toggle = (name: string, checked: boolean) =>
    onChange(checked ? [...selected, name] : selected.filter((entry) => entry !== name));

  return (
    <div className="space-y-2" data-testid="candidate-encodings">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 ? (
          <Badge variant="secondary" className="text-[10px] font-normal">All supported encodings</Badge>
        ) : (
          selected.map((name) => (
            <Badge key={name} variant="secondary" className="gap-1 font-mono text-[11px]">
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="rounded-sm hover:text-destructive"
                disabled={disabled}
                onClick={() => toggle(name, false)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
        {selected.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onChange([])} disabled={disabled}>
            Clear (use all)
          </Button>
        )}
      </div>
      {available.length === 0 ? (
        <p className="text-xs text-muted-foreground">The supported encoding list is not available.</p>
      ) : (
        <div className="rounded-md border">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search encodings"
            aria-label="Search candidate encodings"
            className="h-8 border-0 border-b rounded-b-none text-xs focus-visible:ring-0"
          />
          <ScrollArea className="h-40">
            <ul className="p-1">
              {visible.length === 0 && (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">No encoding matches the search.</li>
              )}
              {visible.map((name) => {
                const id = `candidate-${name}`;
                return (
                  <li key={name} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                    <Checkbox
                      id={id}
                      checked={selected.includes(name)}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggle(name, checked === true)}
                    />
                    <Label htmlFor={id} className="flex-1 cursor-pointer font-mono text-xs font-normal">
                      {name}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Override rule row
// ---------------------------------------------------------------------------

function OverrideRow({
  row,
  encodings,
  error,
  disabled,
  onChange,
  onRemove,
}: {
  row: OverrideRowForm;
  encodings: string[];
  error?: string;
  disabled?: boolean;
  onChange: (next: OverrideRowForm) => void;
  onRemove: () => void;
}) {
  // Keep a stored encoding visible even if the catalog (still loading or failed) does not list it.
  const options = row.encoding && !encodings.includes(row.encoding) ? [row.encoding, ...encodings] : encodings;
  return (
    <div className="space-y-1" data-testid="override-row">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={row.kind}
          disabled={disabled}
          onValueChange={(kind) => onChange({ ...row, kind: kind as OverrideKind })}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Selector kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OVERRIDE_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>{kind}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={row.value}
          disabled={disabled}
          onChange={(event) => onChange({ ...row, value: event.target.value })}
          placeholder={KIND_PLACEHOLDERS[row.kind]}
          aria-label={`Override ${row.kind}`}
          aria-invalid={error ? true : undefined}
          className="h-8 min-w-[180px] flex-1 font-mono text-xs"
        />
        <Select
          value={row.encoding}
          disabled={disabled}
          onValueChange={(encoding) => onChange({ ...row, encoding })}
        >
          <SelectTrigger className="h-8 w-[170px] font-mono text-xs" aria-label="Override encoding">
            <SelectValue placeholder="Encoding" />
          </SelectTrigger>
          <SelectContent>
            {options.map((name) => (
              <SelectItem key={name} value={name} className="font-mono text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Remove override rule"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor for one source (props-driven: the container owns the mutation)
// ---------------------------------------------------------------------------

export interface SourceEncodingEditorProps {
  source: Pick<Source, 'id' | 'name' | 'encodingPolicy'>;
  catalog?: EncodingCatalog;
  catalogLoading?: boolean;
  catalogError?: string;
  isSaving?: boolean;
  /** Receives the policy to PATCH (`null` clears it); rejects with the server's message on failure. */
  onSave: (policy: SourceEncodingPolicy | null) => void | Promise<void>;
}

export function SourceEncodingEditor({
  source,
  catalog,
  catalogLoading = false,
  catalogError,
  isSaving = false,
  onSave,
}: SourceEncodingEditorProps) {
  const [form, setForm] = useState<EncodingPolicyForm>(() => policyToForm(source.encodingPolicy));
  const [showErrors, setShowErrors] = useState(false);

  const defaultThreshold = catalog?.defaultConfidenceThreshold ?? FALLBACK_CONFIDENCE_THRESHOLD;
  const legacy = useMemo(() => legacyEncodingNames(catalog?.encodings ?? []), [catalog]);
  const every = useMemo(() => allEncodingNames(catalog?.encodings ?? []), [catalog]);
  // Stored candidates that the catalog does not list (e.g. while it is unavailable) stay editable.
  const candidateOptions = useMemo(
    () => [...form.candidates.filter((name) => !legacy.includes(name)), ...legacy],
    [form.candidates, legacy]
  );
  const errors = useMemo(() => validatePolicyForm(form), [form]);
  const pristine = isFormPristine(form, source.encodingPolicy, defaultThreshold);

  const patch = (next: Partial<EncodingPolicyForm>) => setForm((current) => ({ ...current, ...next }));
  const updateRow = (next: OverrideRowForm) =>
    patch({ overrides: form.overrides.map((row) => (row.id === next.id ? next : row)) });

  const save = async () => {
    if (hasFormErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    await onSave(formToPolicy(form, defaultThreshold));
  };

  return (
    <div className="space-y-5" data-testid={`encoding-editor-${source.id}`}>
      {/* Auto-guess + sibling consensus */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor={`auto-guess-${source.id}`} className="text-sm">Auto-guess encoding</Label>
            <p className="text-xs text-muted-foreground">
              Detect the encoding of non-UTF-8 text files from their bytes. When off, only a BOM, UTF-16 detection and
              override rules identify non-UTF-8 files; other legacy files are skipped as undetectable.
            </p>
          </div>
          <Switch
            id={`auto-guess-${source.id}`}
            checked={form.autoGuess}
            disabled={isSaving}
            onCheckedChange={(autoGuess) => patch({ autoGuess })}
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label
              htmlFor={`sibling-${source.id}`}
              className={form.autoGuess ? 'text-sm' : 'text-sm text-muted-foreground'}
            >
              Sibling encoding consensus
            </Label>
            <p className="text-xs text-muted-foreground">
              Infers the encoding of sparse, mostly-ASCII files from sibling files in the same directory. Inferred
              files are marked &quot;sibling&quot; in the snapshot. Requires auto-guess.
            </p>
          </div>
          <Switch
            id={`sibling-${source.id}`}
            checked={form.siblingConsensus}
            disabled={isSaving || !form.autoGuess}
            onCheckedChange={(siblingConsensus) => patch({ siblingConsensus })}
          />
        </div>
      </div>

      {/* Candidate encodings */}
      <div className="space-y-2">
        <Label className="text-sm">Candidate encodings</Label>
        <p className="text-xs text-muted-foreground">
          Restrict the guess to these legacy encodings. Leave empty to consider every supported encoding.
        </p>
        {catalogLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {catalogError && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Could not load the supported encodings: {catalogError}
              </p>
            )}
            <CandidateEncodingPicker
              available={candidateOptions}
              selected={form.candidates}
              onChange={(candidates) => patch({ candidates })}
              disabled={isSaving}
            />
          </>
        )}
      </div>

      {/* Override rules */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Encoding overrides</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={isSaving || form.overrides.length >= 100}
            onClick={() => patch({ overrides: [...form.overrides, newOverrideRow()] })}
          >
            <Plus className="h-3 w-3" /> Add rule
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Pin an encoding for matching files. Precedence: path, then glob, then extension; within one kind the first
          rule in the list wins. An override is strictly validated against the file&apos;s bytes. It cannot make a file
          containing gaiji (CP932 private-use) or EUC-JP FULLWIDTH TILDE characters capturable - convert those files to
          UTF-8.
        </p>
        {form.overrides.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">No override rules.</p>
        ) : (
          <div className="space-y-2">
            {form.overrides.map((row) => (
              <OverrideRow
                key={row.id}
                row={row}
                encodings={every}
                error={showErrors ? errors.rows[row.id] : undefined}
                disabled={isSaving}
                onChange={updateRow}
                onRemove={() => patch({ overrides: form.overrides.filter((entry) => entry.id !== row.id) })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confidence threshold */}
      <div className="space-y-1.5">
        <Label htmlFor={`threshold-${source.id}`} className="text-sm">Confidence threshold</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`threshold-${source.id}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={1}
            step={0.05}
            value={form.threshold}
            disabled={isSaving}
            onChange={(event) => patch({ threshold: event.target.value })}
            placeholder={String(defaultThreshold)}
            aria-invalid={showErrors && errors.threshold ? true : undefined}
            className="h-8 w-28 text-xs"
          />
          <span className="text-xs text-muted-foreground">Blank uses the server default ({defaultThreshold}).</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum detector confidence, greater than 0 and at most 1, for a guessed encoding to be accepted.
        </p>
        {showErrors && errors.threshold && <p className="text-xs text-destructive" role="alert">{errors.threshold}</p>}
      </div>

      {showErrors && errors.general && <p className="text-xs text-destructive" role="alert">{errors.general}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button type="button" size="sm" onClick={save} disabled={isSaving || pristine}>
          {isSaving ? 'Saving...' : 'Save encoding policy'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={() => {
            setForm(defaultPolicyForm());
            setShowErrors(false);
          }}
        >
          Reset to defaults
        </Button>
        <span className="text-xs text-muted-foreground">
          {pristine ? 'No unsaved changes.' : 'Unsaved changes. Saving all defaults clears the stored policy.'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One source card (collapsible) wired to the mutation and toasts
// ---------------------------------------------------------------------------

function policySummary(policy: SourceEncodingPolicy | null | undefined): string[] {
  if (!policy) return [];
  const parts: string[] = [];
  if (policy.autoGuessEncoding === false) parts.push('auto-guess off');
  if (policy.siblingEncodingConsensus === false) parts.push('sibling off');
  if (policy.candidateGuessEncodings?.length) parts.push(`${policy.candidateGuessEncodings.length} candidates`);
  if (policy.encodingOverrides?.length) parts.push(`${policy.encodingOverrides.length} overrides`);
  if (policy.encodingConfidenceThreshold !== undefined) parts.push(`threshold ${policy.encodingConfidenceThreshold}`);
  return parts;
}

function SourceEncodingCard({
  projectCode,
  source,
  catalog,
  catalogLoading,
  catalogError,
  defaultOpen,
}: {
  projectCode: string;
  source: Source;
  catalog?: EncodingCatalog;
  catalogLoading: boolean;
  catalogError?: string;
  defaultOpen: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const mutation = useUpdateSourceEncodingPolicy();
  const summary = policySummary(source.encodingPolicy);
  const locatorPath =
    typeof source.locator === 'object' && 'path' in source.locator && typeof source.locator.path === 'string'
      ? source.locator.path
      : undefined;

  const save = async (encodingPolicy: SourceEncodingPolicy | null) => {
    try {
      await mutation.mutateAsync({ code: projectCode, sourceId: source.id, encodingPolicy });
      toast({
        title: encodingPolicy ? 'Encoding policy saved' : 'Encoding policy cleared',
        description: `${source.name}: ${NEXT_INGESTION_NOTE}`,
      });
    } catch (err) {
      toast({
        title: 'Could not save encoding policy',
        description: err instanceof Error ? err.message : 'The server rejected the encoding policy.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 hover:bg-muted/20">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span>{source.name}</span>
              <Badge variant="outline" className="text-[10px] font-normal">{source.kind}</Badge>
              {locatorPath && (
                <span className="truncate font-mono text-[11px] font-normal text-muted-foreground">{locatorPath}</span>
              )}
              <span className="ml-auto flex flex-wrap gap-1">
                {summary.length === 0 ? (
                  <Badge variant="secondary" className="text-[10px] font-normal">defaults</Badge>
                ) : (
                  summary.map((part) => (
                    <Badge key={part} variant="secondary" className="text-[10px] font-normal">{part}</Badge>
                  ))
                )}
              </span>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            <SourceEncodingEditor
              key={JSON.stringify(source.encodingPolicy ?? null)}
              source={source}
              catalog={catalog}
              catalogLoading={catalogLoading}
              catalogError={catalogError}
              isSaving={mutation.isPending}
              onSave={save}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Settings tab section
// ---------------------------------------------------------------------------

export function SourceEncodingSection({
  projects,
  selectedProjectCode,
  onSelectProjectCode,
  isProjectsLoading = false,
}: {
  projects: Project[];
  selectedProjectCode: string;
  onSelectProjectCode: (code: string) => void;
  isProjectsLoading?: boolean;
}) {
  const sourcesQuery = useProjectSources(selectedProjectCode || undefined);
  const catalogQuery = useEncodingCatalog();
  const sources = sourcesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <Languages className="h-4 w-4 text-primary" />
            Source Encoding
          </h2>
          <p className="text-xs text-muted-foreground">
            Per-source detection of legacy text encodings (Shift-JIS/CP932, EUC-JP, GBK, Big5, Windows code pages...)
            at capture time. Captured files are decoded with their detected encoding; evidence byte offsets stay in
            that encoding.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-xs text-muted-foreground">Project:</span>
          <Select
            value={selectedProjectCode}
            onValueChange={onSelectProjectCode}
            disabled={isProjectsLoading || projects.length === 0}
          >
            <SelectTrigger className="h-8 w-[240px] bg-background text-xs" aria-label="Project">
              <SelectValue placeholder={isProjectsLoading ? 'Loading projects...' : 'Select a project'} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name || p.code} ({p.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{NEXT_INGESTION_NOTE}</AlertTitle>
        <AlertDescription className="text-xs">
          A running ingestion keeps the policy it started with. Re-run ingestion to apply a changed policy.
        </AlertDescription>
      </Alert>

      {catalogQuery.data && (
        <p className="text-[11px] text-muted-foreground">
          Detector: <span className="font-mono">{catalogQuery.data.detector}</span>
          {' - '}
          {catalogQuery.data.encodings.length} supported encodings
        </p>
      )}

      {!selectedProjectCode ? (
        <Card className="shadow-sm">
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            {isProjectsLoading
              ? 'Loading projects...'
              : projects.length === 0
                ? 'No projects exist yet. Create a project and register a source to configure its encoding policy.'
                : 'Select a project to configure the encoding policy of its sources.'}
          </CardContent>
        </Card>
      ) : sourcesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : sourcesQuery.isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load sources</AlertTitle>
          <AlertDescription className="text-xs">{(sourcesQuery.error as Error | null)?.message}</AlertDescription>
        </Alert>
      ) : sources.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            This project has no registered sources.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <SourceEncodingCard
              key={source.id}
              projectCode={selectedProjectCode}
              source={source}
              catalog={catalogQuery.data}
              catalogLoading={catalogQuery.isLoading}
              catalogError={catalogQuery.isError ? (catalogQuery.error as Error | null)?.message : undefined}
              defaultOpen={sources.length === 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
