import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEntityDetail, useEntityDependencies } from "@/hooks/useRetrieval";
import type { GraphEntityNode, GraphRelationEdge } from "@/services/api";
import {
  ArrowDownLeft,
  ArrowUpRight,
  GitFork,
  Code2,
  FileCode,
  Copy,
  Check,
  ExternalLink,
  Layers,
  AlertCircle,
  HelpCircle,
  Network,
  Tag,
  Hash,
} from "lucide-react";

export interface EntityDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCode: string;
  entityId: string | null;
  snapshotId?: string;
  onSelectEntity?: (entityId: string) => void;
  onViewEvidence?: (path: string, startLine?: number | null, endLine?: number | null) => void;
}

function getKindColor(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes("function") || k.includes("method")) {
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  }
  if (k.includes("class") || k.includes("struct") || k.includes("interface")) {
    return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  }
  if (k.includes("variable") || k.includes("const") || k.includes("field")) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  }
  if (k.includes("file") || k.includes("module")) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
  return "bg-muted text-muted-foreground border-border";
}

function getRelationColor(type: string): string {
  const t = type.toUpperCase();
  if (t === "CALLS") return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  if (t === "IMPORTS") return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
  if (t === "EXTENDS" || t === "IMPLEMENTS") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  if (t === "CONTAINS") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
}

export function EntityDetailSheet({
  open,
  onOpenChange,
  projectCode,
  entityId,
  snapshotId,
  onSelectEntity,
  onViewEvidence,
}: EntityDetailSheetProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [selectedDepth, setSelectedDepth] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>("incoming");

  const {
    data: detail,
    isLoading: isDetailLoading,
    isError: isDetailError,
    error: detailError,
    refetch: refetchDetail,
  } = useEntityDetail(projectCode, entityId, {
    snapshotId: snapshotId || undefined,
    enabled: open && Boolean(entityId && projectCode),
  });

  const {
    data: depGraph,
    isLoading: isDepsLoading,
    isError: isDepsError,
  } = useEntityDependencies(projectCode, entityId, {
    snapshotId: snapshotId || undefined,
    depth: selectedDepth,
    enabled: open && activeTab === "dependencies" && Boolean(entityId && projectCode),
  });

  const handleCopyId = () => {
    if (!entityId) return;
    navigator.clipboard.writeText(entityId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const entity = detail?.entity;
  const incoming = detail?.incomingRelations ?? [];
  const outgoing = detail?.outgoingRelations ?? [];
  const hasTraversedDependencies = Boolean(
    depGraph?.entities.some((node) => node.id !== entityId),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-xl font-bold truncate">
                  {entity ? entity.name : "Entity Details"}
                </SheetTitle>
                {entity?.kind && (
                  <Badge variant="outline" className={`capitalize text-xs ${getKindColor(entity.kind)}`}>
                    {entity.kind}
                  </Badge>
                )}
                {entity?.language && (
                  <Badge variant="secondary" className="text-xs uppercase font-mono">
                    {entity.language}
                  </Badge>
                )}
              </div>
              <SheetDescription className="font-mono text-xs text-muted-foreground truncate">
                {entity?.qualifiedName || entity?.id || entityId}
              </SheetDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyId}
                className="h-8 text-xs gap-1.5"
                title="Copy Entity ID"
              >
                {copiedId ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </Button>

              {entity?.path && onViewEvidence && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() =>
                    onViewEvidence(entity.path, entity.startLine, entity.endLine)
                  }
                  className="h-8 text-xs gap-1.5"
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>View Evidence</span>
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Content Body */}
        <div className="flex-1 min-h-0 flex flex-col">
          {isDetailLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : isDetailError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Failed to load entity details</AlertTitle>
                <AlertDescription className="text-sm mt-1">
                  {detailError?.message || "Entity not found in the selected snapshot."}
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchDetail()}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          ) : !entity ? (
            <div className="p-6 text-center text-muted-foreground">
              No entity data available
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Metadata panel */}
              <div className="p-4 sm:p-6 pb-4 bg-muted/20 border-b space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1 font-medium">
                      <FileCode className="h-3 w-3" /> Location
                    </span>
                    <p
                      className="font-mono text-foreground truncate cursor-pointer hover:underline"
                      title={entity.path}
                      onClick={() =>
                        onViewEvidence?.(entity.path, entity.startLine, entity.endLine)
                      }
                    >
                      {entity.path}
                      {entity.startLine ? `:${entity.startLine}` : ""}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1 font-medium">
                      <Hash className="h-3 w-3" /> Line / Byte Range
                    </span>
                    <p className="font-mono text-foreground">
                      {entity.startLine !== null && entity.startLine !== undefined
                        ? `L${entity.startLine} - L${entity.endLine ?? entity.startLine}`
                        : "Lines N/A"}
                      <span className="text-muted-foreground ml-1.5">
                        ({entity.startByte}b - {entity.endByte}b)
                      </span>
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1 font-medium">
                      <Layers className="h-3 w-3" /> Scope
                    </span>
                    <p className="font-mono text-foreground truncate">
                      Source: {entity.sourceId}
                      {entity.revision ? ` (${entity.revision.slice(0, 7)})` : ""}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1 font-medium">
                      <GitFork className="h-3 w-3" /> Relations Count
                    </span>
                    <p className="font-mono text-foreground">
                      <span className="text-sky-500 font-semibold">{incoming.length}</span> in /{" "}
                      <span className="text-indigo-500 font-semibold">{outgoing.length}</span> out
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs for Incoming, Outgoing, Dependencies */}
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="px-6 pt-3 border-b bg-card">
                  <TabsList className="grid grid-cols-3 w-full max-w-md">
                    <TabsTrigger value="incoming" className="gap-1.5 text-xs">
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                      Incoming ({incoming.length})
                    </TabsTrigger>
                    <TabsTrigger value="outgoing" className="gap-1.5 text-xs">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Outgoing ({outgoing.length})
                    </TabsTrigger>
                    <TabsTrigger value="dependencies" className="gap-1.5 text-xs">
                      <Network className="h-3.5 w-3.5" />
                      Dependencies
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab: Incoming */}
                <TabsContent value="incoming" className="flex-1 min-h-0 m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-3">
                      <div className="text-xs text-muted-foreground">
                        Entities that call, reference, extend, or import this entity.
                      </div>
                      {incoming.length === 0 ? (
                        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground space-y-1">
                          <HelpCircle className="h-8 w-8 mx-auto opacity-40 mb-2" />
                          <p className="text-sm font-medium">No incoming relations</p>
                          <p className="text-xs">No recorded entities reference this symbol.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {incoming.map((edge, idx) => (
                            <div
                              key={`${edge.source}-${edge.type}-${idx}`}
                              className="p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-semibold ${getRelationColor(edge.type)}`}
                                >
                                  {edge.type}
                                </Badge>
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <span className="capitalize">{edge.resolution}</span>
                                  {edge.analyzer && (
                                    <span className="border-l pl-1.5">{edge.analyzer}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono text-xs text-foreground truncate select-all">
                                  {edge.source}
                                </span>
                                {onSelectEntity && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-primary"
                                    onClick={() => onSelectEntity(edge.source)}
                                  >
                                    Inspect
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Tab: Outgoing */}
                <TabsContent value="outgoing" className="flex-1 min-h-0 m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-3">
                      <div className="text-xs text-muted-foreground">
                        Entities that this entity calls, imports, contains, or extends.
                      </div>
                      {outgoing.length === 0 ? (
                        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground space-y-1">
                          <HelpCircle className="h-8 w-8 mx-auto opacity-40 mb-2" />
                          <p className="text-sm font-medium">No outgoing relations</p>
                          <p className="text-xs">This entity does not call or import any recorded entities.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {outgoing.map((edge, idx) => (
                            <div
                              key={`${edge.target}-${edge.type}-${idx}`}
                              className="p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-semibold ${getRelationColor(edge.type)}`}
                                >
                                  {edge.type}
                                </Badge>
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <span className="capitalize">{edge.resolution}</span>
                                  {edge.analyzer && (
                                    <span className="border-l pl-1.5">{edge.analyzer}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono text-xs text-foreground truncate select-all">
                                  {edge.target}
                                </span>
                                {onSelectEntity && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-primary"
                                    onClick={() => onSelectEntity(edge.target)}
                                  >
                                    Inspect
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Tab: Dependencies */}
                <TabsContent value="dependencies" className="flex-1 min-h-0 m-0 p-0">
                  <div className="h-full flex flex-col">
                    {/* Depth control toolbar */}
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between gap-4">
                      <div className="text-xs font-medium text-foreground flex items-center gap-2">
                        <span>Traversal Depth:</span>
                        <Select
                          value={String(selectedDepth)}
                          onValueChange={(val) => setSelectedDepth(Number(val))}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue placeholder="Depth" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 hop</SelectItem>
                            <SelectItem value="2">2 hops</SelectItem>
                            <SelectItem value="3">3 hops</SelectItem>
                            <SelectItem value="4">4 hops</SelectItem>
                            <SelectItem value="5">5 hops</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {depGraph && (
                        <div className="text-xs text-muted-foreground">
                          {hasTraversedDependencies
                            ? `${depGraph.entities.length} entities • ${depGraph.relations.length} relations`
                            : `${outgoing.length} direct recorded relations`}
                        </div>
                      )}
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="p-6 space-y-4">
                        {isDepsLoading ? (
                          <div className="space-y-3">
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-14 w-full" />
                          </div>
                        ) : isDepsError ? (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Failed to load dependency graph</AlertTitle>
                            <AlertDescription className="text-xs mt-1">
                              Unable to traverse dependency tree for this entity.
                            </AlertDescription>
                          </Alert>
                        ) : !hasTraversedDependencies && outgoing.length > 0 ? (
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Direct Recorded Relations ({outgoing.length})
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                No traversable dependency paths were found. These are recorded outgoing relations for this symbol; they are direct relations regardless of the selected depth.
                              </p>
                            </div>
                            <div className="space-y-2">
                              {outgoing.map((edge, idx) => (
                                <div
                                  key={`${edge.target}-${edge.type}-${idx}`}
                                  className="p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors flex flex-col gap-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <Badge
                                      variant="outline"
                                      className={`text-xs font-semibold ${getRelationColor(edge.type)}`}
                                    >
                                      {edge.type}
                                    </Badge>
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      <span className="capitalize">{edge.resolution}</span>
                                      {edge.analyzer && (
                                        <span className="border-l pl-1.5">{edge.analyzer}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-1">
                                    <span className="font-mono text-xs text-foreground truncate select-all">
                                      {edge.target || "Target unavailable"}
                                    </span>
                                    {onSelectEntity && edge.target && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-primary"
                                        onClick={() => onSelectEntity(edge.target)}
                                      >
                                        Inspect
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : !depGraph || !hasTraversedDependencies ? (
                          <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground space-y-1">
                            <Network className="h-8 w-8 mx-auto opacity-40 mb-2" />
                            <p className="text-sm font-medium">No dependent entities at depth {selectedDepth}</p>
                            <p className="text-xs">
                              No outgoing relations or traversable dependency paths were found for this symbol.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Reachable Entities ({depGraph.entities.length})
                            </div>
                            <div className="space-y-2">
                              {depGraph.entities
                                .filter((e) => e.id !== entityId)
                                .map((node) => (
                                  <div
                                    key={node.id}
                                    className="p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-xs text-foreground truncate">
                                          {node.name}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] capitalize ${getKindColor(node.kind)}`}
                                        >
                                          {node.kind}
                                        </Badge>
                                        {node.language && (
                                          <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                            {node.language}
                                          </span>
                                        )}
                                      </div>
                                      <p className="font-mono text-[11px] text-muted-foreground truncate">
                                        {node.path}
                                        {node.startLine ? `:${node.startLine}` : ""}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {node.path && onViewEvidence && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                          title="View source evidence"
                                          onClick={() =>
                                            onViewEvidence(node.path, node.startLine, node.endLine)
                                          }
                                        >
                                          <FileCode className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                      {onSelectEntity && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2.5 text-xs"
                                          onClick={() => onSelectEntity(node.id)}
                                        >
                                          Inspect
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {depGraph.relations.length > 0 && (
                              <div className="pt-2 space-y-2">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  Graph Relations ({depGraph.relations.length})
                                </div>
                                <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5 font-mono text-xs">
                                  {depGraph.relations.map((r, i) => (
                                    <div
                                      key={`${r.source}-${r.target}-${i}`}
                                      className="flex items-center gap-2 text-muted-foreground truncate"
                                    >
                                      <span className="truncate text-foreground font-medium">
                                        {r.source.split("::").pop()}
                                      </span>
                                      <span className="text-primary font-bold">--[{r.type}]--&gt;</span>
                                      <span className="truncate text-foreground font-medium">
                                        {r.target.split("::").pop()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
