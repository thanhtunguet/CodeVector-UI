import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProjectSnapshot } from "@/hooks/useProjects";
import { WorkerEventPanel } from "@/components/worker/WorkerEventPanel";
import type { Snapshot } from "@/services/api";
import { format } from "date-fns";
import {
  Check,
  Copy,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  GitBranch,
  FileCode,
  Layers,
  Cpu,
  Hash,
  ChevronDown,
  ChevronRight,
  Database,
  CheckCircle2,
  Loader2,
  XCircle,
  HelpCircle,
} from "lucide-react";

export interface SnapshotDetailSheetProps {
  projectCode: string;
  snapshotId: string | null;
  snapshot?: Snapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "MMM d, yyyy HH:mm:ss");
  } catch {
    return dateStr;
  }
}

export function SnapshotDetailSheet({
  projectCode,
  snapshotId,
  snapshot,
  open,
  onOpenChange,
}: SnapshotDetailSheetProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const { data: fetchedSnapshot, isLoading } = useProjectSnapshot(
    projectCode,
    snapshotId ?? undefined
  );

  const activeSnapshot = fetchedSnapshot ?? snapshot;

  const handleCopyId = () => {
    if (!activeSnapshot?.id) return;
    navigator.clipboard.writeText(activeSnapshot.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getSnapshotBadge = (state?: Snapshot["state"]) => {
    switch (state) {
      case "published":
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
          label: "Published",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        };
      case "building":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />,
          label: "Building",
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "failed":
        return {
          icon: <XCircle className="h-3.5 w-3.5 text-destructive" />,
          label: "Failed",
          className: "bg-destructive/10 text-destructive border-destructive/20",
        };
      default:
        return {
          icon: <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />,
          label: state || "Unknown",
          className: "bg-muted text-muted-foreground",
        };
    }
  };

  const getCapabilityInfo = (capability?: string) => {
    const normalized = capability?.toLowerCase();
    if (normalized === "full" || normalized === "semantic") {
      return {
        badge: "Semantic & Graph",
        badgeVariant: "default",
        badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        description: "Vector embeddings and code intelligence knowledge graph are fully indexed and queryable.",
        icon: <Sparkles className="h-4 w-4 text-emerald-500" />,
      };
    }
    if (normalized === "graph_only" || normalized === "syntax") {
      return {
        badge: "Graph & Syntax",
        badgeVariant: "secondary",
        badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
        description: "AST symbol graphs and call hierarchies are indexed; vector semantic search is unconfigured or bypassed.",
        icon: <GitBranch className="h-4 w-4 text-cyan-500" />,
      };
    }
    return {
      badge: "Text & Metadata",
      badgeVariant: "outline",
      badgeClass: "bg-muted text-muted-foreground border-border",
      description: "Basic textual lookup and source metadata only. Graph and semantic capabilities unavailable.",
      icon: <FileCode className="h-4 w-4 text-muted-foreground" />,
    };
  };

  const getReasonMessage = (reason?: string) => {
    if (!reason) return null;
    switch (reason) {
      case "embedding_not_configured":
        return "Embedding provider was not configured in environment settings when this snapshot was indexed.";
      case "embedding_unavailable":
        return "Embedding service was unreachable or returned errors during indexing, so vector embedding was skipped.";
      default:
        return reason;
    }
  };

  const stateBadge = getSnapshotBadge(activeSnapshot?.state);
  const capInfo = getCapabilityInfo(activeSnapshot?.indexCapability);
  const reasonMessage = getReasonMessage(activeSnapshot?.indexCapabilityReason);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 overflow-hidden"
      >
        {/* Top Header */}
        <div className="p-6 border-b bg-card">
          <SheetHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-xl font-bold">Snapshot Details</SheetTitle>
              {activeSnapshot?.state && (
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-mono flex items-center gap-1.5 ${stateBadge.className}`}
                >
                  {stateBadge.icon}
                  {stateBadge.label}
                </Badge>
              )}
            </div>
            <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
              <span>Project:</span>
              <code className="font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                {projectCode}
              </code>
            </SheetDescription>
          </SheetHeader>

          {/* Snapshot ID bar */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-2.5 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="text-muted-foreground font-medium">Snapshot ID:</span>
              <code className="font-mono text-foreground font-semibold truncate">
                {activeSnapshot?.id ?? snapshotId}
              </code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyId}
              className="h-7 px-2 text-xs gap-1 flex-shrink-0"
            >
              {copiedId ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && !activeSnapshot ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-36 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : !activeSnapshot ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
              <p className="text-sm font-medium">Snapshot not found</p>
              <p className="text-xs mt-1">
                The requested snapshot may have been cleaned up or does not exist.
              </p>
            </div>
          ) : (
            <>
              {/* Failure Callout if snapshot failed */}
              {activeSnapshot.state === "failed" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm font-semibold">Indexing Failed</AlertTitle>
                  <AlertDescription className="text-xs mt-1 whitespace-pre-wrap font-mono">
                    {activeSnapshot.failureReason || "No specific failure message was recorded by the ingestion runner."}
                  </AlertDescription>
                </Alert>
              )}

              {/* Lifecycle & Timing Card */}
              <Card>
                <CardHeader className="py-3 px-4 border-b bg-muted/20">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Lifecycle & Timestamps
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-1">Created At</span>
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(activeSnapshot.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-1">Published At</span>
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      {activeSnapshot.publishedAt ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          {formatDate(activeSnapshot.publishedAt)}
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">Not published</span>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Capability & Vector Parameters Card */}
              <Card>
                <CardHeader className="py-3 px-4 border-b bg-muted/20">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Index Capability & Vector Dimensions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4 text-xs">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-1">Capability Level</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`font-semibold text-xs py-0.5 px-2 flex items-center gap-1.5 ${capInfo.badgeClass}`}
                        >
                          {capInfo.icon}
                          {capInfo.badge}
                        </Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          ({activeSnapshot.indexCapability || "default"})
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                        {capInfo.description}
                      </p>
                    </div>
                  </div>

                  {reasonMessage && (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                      <span className="font-semibold block text-[11px] mb-0.5">Capability Note:</span>
                      {reasonMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <span className="text-muted-foreground block text-[11px] mb-1 flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        Embedding Model
                      </span>
                      <span className="font-mono font-medium text-foreground text-xs break-all">
                        {activeSnapshot.embeddingModelId || "Not Configured / None"}
                      </span>
                    </div>

                    <div className="rounded-lg bg-muted/40 p-3">
                      <span className="text-muted-foreground block text-[11px] mb-1 flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Vector Dimensions
                      </span>
                      <span className="font-mono font-medium text-foreground text-xs">
                        {activeSnapshot.embeddingDimensions ? `${activeSnapshot.embeddingDimensions} dims` : "N/A"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pinned Source Revisions */}
              {activeSnapshot.revisions && activeSnapshot.revisions.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4 border-b bg-muted/20">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      Pinned Source Revisions ({activeSnapshot.revisions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {activeSnapshot.revisions.map((rev) => (
                        <div key={rev.sourceId} className="p-3 text-xs space-y-1 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                              {rev.sourceName || "Source"}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {rev.fileCount} files
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono truncate">
                            <span>Rev:</span>
                            <span className="text-foreground truncate">{rev.revision}</span>
                          </div>
                          {rev.manifestHash && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono truncate">
                              <span>Manifest:</span>
                              <span className="truncate">{rev.manifestHash}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Raw JSON Inspector */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full flex items-center justify-between p-3 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5" />
                    Raw Snapshot Payload
                  </span>
                  {showRawJson ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {showRawJson && (
                  <div className="p-3 border-t bg-muted/50 overflow-x-auto">
                    <pre className="text-[11px] font-mono leading-relaxed text-muted-foreground whitespace-pre">
                      {JSON.stringify(activeSnapshot, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
          {activeSnapshot && (
            <WorkerEventPanel
              projectCode={projectCode}
              snapshotId={activeSnapshot.id}
              title="Worker history for this snapshot"
              compact
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-card flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
