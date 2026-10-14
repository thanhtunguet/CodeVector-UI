import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProjectSources } from '@/hooks/useProjects';
import { useProjectIngestion, useRetryPipelineIngest, useTriggerPipelineIngest } from '@/hooks/useIngestion';
import { isIngestionActive } from '@/hooks/ingestionQueries';
import { useToast } from '@/hooks/use-toast';
import type { IngestionOperationReceipt, PipelineIngestRequest } from '@/services/api';
import { useRememberedOperation } from './useRememberedOperation';
import { AlertCircle, Loader2, Play } from 'lucide-react';

export type IngestionTarget = PipelineIngestRequest['pipeline'];

function createRequestKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

interface TriggerIngestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCode: string;
  projectName?: string;
  pipeline?: IngestionTarget;
  retryOfOperationId?: string;
  onSuccess?: (receipt: IngestionOperationReceipt) => void;
}

export function TriggerIngestionDialog({ open, onOpenChange, projectCode, projectName, pipeline = 'source', retryOfOperationId, onSuccess }: TriggerIngestionDialogProps) {
  const [requireSemantic, setRequireSemantic] = useState(false);
  const [requireDocumentSemantic, setRequireDocumentSemantic] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { remember } = useRememberedOperation(projectCode);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const requestKey = useRef<string | undefined>(undefined);
  const context = useRef({ projectCode, pipeline, retryOfOperationId });
  context.current = { projectCode, pipeline, retryOfOperationId };
  const trigger = useTriggerPipelineIngest();
  const retry = useRetryPipelineIngest();
  const { data: sources, isPending: sourcesLoading, error: sourcesError } = useProjectSources(projectCode || undefined);
  const { data: ingestion, isPending: statusLoading, error: statusError } = useProjectIngestion(projectCode || undefined);
  const { toast } = useToast();
  const pending = trigger.isPending || retry.isPending;
  const busy = isIngestionActive(ingestion);
  const label = pipeline === 'source' ? 'Source' : pipeline === 'docs' ? 'Docs' : 'Both';
  useEffect(() => {
    setRequireSemantic(false);
    setRequireDocumentSemantic(false);
    setApiError(null);
    requestKey.current = undefined;
  }, [projectCode, pipeline, retryOfOperationId, open]);

  const handleTrigger = async () => {
    if (!projectCode || pending || busy || !sources?.length) return;
    const submitted = { projectCode, pipeline, retryOfOperationId };
    const isCurrent = () => mounted.current && context.current.projectCode === submitted.projectCode
      && context.current.pipeline === submitted.pipeline && context.current.retryOfOperationId === submitted.retryOfOperationId;
    const input: PipelineIngestRequest = pipeline === 'source' ? { pipeline, requireSemantic }
      : pipeline === 'docs' ? { pipeline, requireDocumentSemantic }
      : { pipeline, requireSemantic, requireDocumentSemantic };
    try {
      setApiError(null);
      requestKey.current ??= createRequestKey();
      const receipt = retryOfOperationId && input.pipeline !== 'both'
        ? await retry.mutateAsync({ code: projectCode, operationId: retryOfOperationId, input, requestKey: requestKey.current })
        : await trigger.mutateAsync({ code: projectCode, input, requestKey: requestKey.current });
      remember(receipt.operationId);
      if (!isCurrent()) return;
      toast({ title: `${label} ingestion queued`, description: `Operation ${receipt.operationId} for ${projectCode}.` });
      onSuccess?.(receipt);
      onOpenChange(false);
    } catch (error) {
      if (isCurrent()) setApiError(error instanceof Error ? error.message : 'Could not start ingestion.');
    }
  };

  const updateStrictness = (set: (value: boolean) => void, value: boolean) => {
    set(value);
    requestKey.current = undefined;
    setApiError(null);
  };
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-lg">{retryOfOperationId ? 'Retry' : 'Ingest'} {label}</DialogTitle>
        <DialogDescription className="text-xs">{projectName || projectCode} · {projectCode}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2 text-xs">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          {pipeline !== 'docs' && <p><strong>Source:</strong> Analyze code, relationships and code embeddings.</p>}
          {pipeline !== 'source' && <p><strong>Docs:</strong> Capture and parse documents, then index document embeddings.</p>}
          <p className="text-muted-foreground">All registered local directories are inspected. File ownership determines the pipeline, independently of registration kind. A pipeline with no eligible files fails without moving its published head.</p>
          {pipeline === 'both' && <p className="text-muted-foreground">Source runs first, followed by Docs. Each child publishes independently; one child may succeed while the other fails.</p>}
        </div>
        {pipeline !== 'docs' && <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div><Label htmlFor="require-source-semantic" className="text-xs">Require Source semantics</Label><p className="text-[11px] text-muted-foreground mt-1">Fail Source if code embeddings cannot be completed.</p></div>
          <Switch id="require-source-semantic" checked={requireSemantic} onCheckedChange={value => updateStrictness(setRequireSemantic, value)} disabled={pending} />
        </div>}
        {pipeline !== 'source' && <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div><Label htmlFor="require-docs-semantic" className="text-xs">Require Docs semantics</Label><p className="text-[11px] text-muted-foreground mt-1">Fail Docs if document semantic coverage cannot be completed.</p></div>
          <Switch id="require-docs-semantic" checked={requireDocumentSemantic} onCheckedChange={value => updateStrictness(setRequireDocumentSemantic, value)} disabled={pending} />
        </div>}
        {busy && <p role="status" className="text-amber-600 dark:text-amber-400">This project already has active or pending ingestion. Wait for it to finish or cancel it.</p>}
        {!sourcesLoading && !sourcesError && !sources?.length && <p role="status" className="text-muted-foreground">No registered inputs. Register a local directory before ingesting.</p>}
        {(apiError || sourcesError || statusError) && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-xs">{apiError || sourcesError?.message || statusError?.message}</AlertDescription></Alert>}
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>Close</Button>
        <Button size="sm" className="gap-1.5 text-xs" onClick={handleTrigger} disabled={pending || busy || sourcesLoading || statusLoading || !!sourcesError || !!statusError || !sources?.length || !projectCode}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {pending ? 'Submitting…' : `${retryOfOperationId ? 'Retry' : 'Ingest'} ${label}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
