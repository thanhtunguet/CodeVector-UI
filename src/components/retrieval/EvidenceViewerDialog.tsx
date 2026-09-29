import { useEffect, useRef, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEvidence } from "@/hooks/useRetrieval";
import {
  FileCode,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Layers,
  HardDrive,
  Hash,
} from "lucide-react";

export interface EvidenceViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCode: string;
  path: string | null;
  sourceId?: string;
  snapshotId?: string;
  startLine?: number | null;
  endLine?: number | null;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function EvidenceViewerDialog({
  open,
  onOpenChange,
  projectCode,
  path,
  sourceId,
  snapshotId,
  startLine,
  endLine,
}: EvidenceViewerDialogProps) {
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedRange, setCopiedRange] = useState(false);
  const targetLineRef = useRef<HTMLDivElement | null>(null);

  const {
    data: evidence,
    isLoading,
    isError,
    error,
  } = useEvidence(projectCode, path, {
    snapshotId: snapshotId || undefined,
    sourceId: sourceId || undefined,
    enabled: open && Boolean(path && projectCode),
  });

  const lines = useMemo(() => {
    if (!evidence?.text) return [];
    return evidence.text.split("\n");
  }, [evidence?.text]);

  const targetRangeText = useMemo(() => {
    if (!lines.length || !startLine) return null;
    const start = Math.max(1, startLine) - 1;
    const end = Math.min(lines.length, endLine ?? startLine);
    return lines.slice(start, end).join("\n");
  }, [lines, startLine, endLine]);

  // Scroll to target line when evidence is loaded
  useEffect(() => {
    if (open && !isLoading && targetLineRef.current) {
      setTimeout(() => {
        targetLineRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [open, isLoading, path, startLine]);

  const handleCopyFull = async () => {
    if (!evidence?.text) return;
    try {
      await navigator.clipboard.writeText(evidence.text);
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyRange = async () => {
    if (!targetRangeText) return;
    try {
      await navigator.clipboard.writeText(targetRangeText);
      setCopiedRange(true);
      setTimeout(() => setCopiedRange(false), 2000);
    } catch {
      // ignore
    }
  };

  const fileName = path ? path.split("/").pop() : "File Evidence";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileCode className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-semibold truncate flex items-center gap-2">
                  <span className="truncate">{fileName}</span>
                  {startLine && (
                    <Badge variant="outline" className="font-mono text-xs font-normal">
                      L{startLine}
                      {endLine && endLine !== startLine ? `-L${endLine}` : ""}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs truncate font-mono text-muted-foreground">
                  {path || "Unknown path"}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {targetRangeText && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyRange}
                  className="h-8 text-xs gap-1.5"
                >
                  {copiedRange ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Copied Highlight</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyFull}
                disabled={!evidence?.text}
                className="h-8 text-xs gap-1.5"
              >
                {copiedFull ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied All</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy All</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {evidence && (
              <>
                <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                  <HardDrive className="h-3 w-3 text-muted-foreground" />
                  {formatBytes(evidence.byteSize)}
                </Badge>
                <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  {lines.length} lines
                </Badge>
                {evidence.sourceId && (
                  <Badge variant="outline" className="gap-1 text-[11px]">
                    <Layers className="h-3 w-3 text-muted-foreground" />
                    Source: {evidence.sourceId}
                  </Badge>
                )}
                {evidence.revision && (
                  <Badge variant="outline" className="font-mono text-[11px]">
                    Rev: {evidence.revision.slice(0, 8)}
                  </Badge>
                )}
                {evidence.contentHash && (
                  <Badge
                    variant="outline"
                    className="font-mono text-[11px] text-muted-foreground hidden sm:inline-flex"
                    title={evidence.contentHash}
                  >
                    sha: {evidence.contentHash.slice(0, 8)}...
                  </Badge>
                )}
              </>
            )}
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 min-h-0 bg-muted/20 relative">
          {isLoading ? (
            <div className="p-6 space-y-2.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : isError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Failed to load file evidence</AlertTitle>
                <AlertDescription className="text-sm mt-1">
                  {error?.message || "The file could not be retrieved from snapshot storage."}
                </AlertDescription>
              </Alert>
            </div>
          ) : !evidence?.text ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <FileCode className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">Empty file or no content captured</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4 font-mono text-xs sm:text-sm select-text">
                {lines.map((line, index) => {
                  const lineNumber = index + 1;
                  const isHighlighted =
                    startLine !== null &&
                    startLine !== undefined &&
                    lineNumber >= startLine &&
                    lineNumber <= (endLine ?? startLine);

                  const isFirstHighlighted = isHighlighted && lineNumber === startLine;

                  return (
                    <div
                      key={lineNumber}
                      ref={isFirstHighlighted ? targetLineRef : undefined}
                      className={`flex group leading-relaxed rounded px-1 transition-colors ${
                        isHighlighted
                          ? "bg-primary/15 dark:bg-primary/25 border-l-2 border-primary font-medium"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className={`w-12 shrink-0 select-none text-right pr-4 font-mono text-xs ${
                          isHighlighted
                            ? "text-primary font-bold"
                            : "text-muted-foreground/60 group-hover:text-muted-foreground"
                        }`}
                      >
                        {lineNumber}
                      </span>
                      <span className="flex-1 whitespace-pre overflow-x-auto text-foreground/90">
                        {line || " "}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t bg-card flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {startLine ? (
              <span>
                Highlighting line {startLine}
                {endLine && endLine !== startLine ? ` to ${endLine}` : ""}
              </span>
            ) : (
              <span>Showing full file snapshot evidence</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
