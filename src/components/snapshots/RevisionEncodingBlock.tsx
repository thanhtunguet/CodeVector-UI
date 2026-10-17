import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Languages } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  GAIJI_NOTE,
  SIBLING_INFERRED_TOOLTIP,
  hasEncodingReport,
  needsGaijiNote,
  sortedEncodingCounts,
} from '@/lib/encoding-policy';
import type { RevisionEncodingFile, RevisionEncodingReport } from '@/services/api';

function MethodBadge({ file }: { file: RevisionEncodingFile }) {
  if (file.method === 'sibling') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="border-amber-500/60 bg-amber-500/10 text-[10px] font-normal text-amber-700 dark:text-amber-400"
            >
              inferred
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{SIBLING_INFERRED_TOOLTIP}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (!file.method) return null;
  return (
    <span className="text-[10px] text-muted-foreground">
      {file.method}
      {file.method === 'guess' && file.confidence !== undefined && ` ${Math.round(file.confidence * 100)}%`}
    </span>
  );
}

/**
 * Legacy-encoding report of one pinned source revision: encoding counts, a sample of the
 * captured files with how each encoding was determined, and the files skipped as
 * `undetectable_encoding`. Renders nothing for a UTF-8-only capture.
 */
export function RevisionEncodingBlock({ encoding }: { encoding?: RevisionEncodingReport | null }) {
  const [showFiles, setShowFiles] = useState(false);
  if (!hasEncodingReport(encoding)) return null;

  const counts = sortedEncodingCounts(encoding.counts ?? {});
  const files = encoding.files ?? [];
  const undetectable = encoding.undetectable && encoding.undetectable.count > 0 ? encoding.undetectable : undefined;

  return (
    <div className="mt-2 space-y-2 rounded-md border bg-muted/20 p-2" data-testid="revision-encoding">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Languages className="h-3 w-3" /> Non-UTF-8 files
        </span>
        {counts.map(([name, count]) => (
          <Badge key={name} variant="secondary" className="font-mono text-[10px] font-normal">
            {name}: {count}
          </Badge>
        ))}
      </div>

      {files.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowFiles((value) => !value)}
            aria-expanded={showFiles}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {showFiles ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showFiles ? 'Hide' : 'Show'} file sample ({files.length}
            {encoding.filesTruncated ? '+' : ''})
          </button>
          {showFiles && (
            <div className="mt-1 space-y-1">
              <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded border bg-background">
                {files.map((file) => (
                  <li key={file.path} className="flex items-center justify-between gap-2 px-2 py-1">
                    <span className="truncate font-mono text-[11px]" title={file.path}>{file.path}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge variant="secondary" className="font-mono text-[10px] font-normal">{file.encoding}</Badge>
                      <MethodBadge file={file} />
                    </span>
                  </li>
                ))}
              </ul>
              {encoding.filesTruncated && (
                <p className="text-[10px] text-muted-foreground">
                  Only a sample of the files is listed (sorted by path); the counts above cover every captured file.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {undetectable && (
        <Alert className="border-amber-500/50 bg-amber-500/5 p-3 text-xs [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">
            {undetectable.countExact ? '' : '>='}
            {undetectable.count} {undetectable.count === 1 ? 'file' : 'files'} skipped: undetectable encoding
          </AlertTitle>
          <AlertDescription className="space-y-1.5 text-[11px]">
            {undetectable.sample.length > 0 && (
              <ul className="space-y-0.5 font-mono">
                {undetectable.sample.map((entry) => (
                  <li key={entry.path} className="truncate" title={entry.message ?? entry.path}>{entry.path}</li>
                ))}
              </ul>
            )}
            <p>{undetectable.remedy}</p>
            {needsGaijiNote(undetectable.remedy) && <p>{GAIJI_NOTE}</p>}
            <p className="text-muted-foreground">
              Add an encoding override in Settings, Source Encoding, then re-ingest.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
