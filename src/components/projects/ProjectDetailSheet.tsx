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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useProjectSources,
  useProjectSnapshots,
  useProjectIngestion,
} from "@/hooks/useProjects";
import type { Project, Source, Snapshot } from "@/services/api";
import { format } from "date-fns";
import {
  Check,
  Copy,
  FolderGit2,
  BookOpen,
  History,
  Activity,
  Calendar,
  AlertCircle,
  Clock,
  HardDrive,
} from "lucide-react";

interface ProjectDetailSheetProps {
  project: Project | null;
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

export function ProjectDetailSheet({
  project,
  open,
  onOpenChange,
}: ProjectDetailSheetProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  const projectCode = project?.code;
  const {
    data: sources,
    isLoading: isSourcesLoading,
    error: sourcesError,
  } = useProjectSources(projectCode);

  const {
    data: snapshots,
    isLoading: isSnapshotsLoading,
    error: snapshotsError,
  } = useProjectSnapshots(projectCode);

  const {
    data: ingestion,
    isLoading: isIngestionLoading,
    error: ingestionError,
  } = useProjectIngestion(projectCode);

  const handleCopyCode = () => {
    if (!projectCode) return;
    navigator.clipboard.writeText(projectCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getSnapshotBadgeVariant = (state: Snapshot["state"]) => {
    switch (state) {
      case "published":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "building":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "";
    }
  };

  const renderSourceLocator = (source: Source) => {
    if (source.locator.type === "local_directory" && "path" in source.locator) {
      return String(source.locator.path);
    }
    return JSON.stringify(source.locator);
  };

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
              <SheetTitle className="text-xl font-bold">
                {project?.name || "Project Details"}
              </SheetTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {project?.code}
              </Badge>
            </div>
            <SheetDescription className="text-xs text-muted-foreground flex items-center gap-4 pt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Created {formatDate(project?.createdAt)}
              </span>
            </SheetDescription>
          </SheetHeader>

          {/* Quick Info bar */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-2.5 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="text-muted-foreground">Code:</span>
              <code className="font-mono font-medium text-foreground">
                {project?.code}
              </code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCode}
              className="h-7 px-2 text-xs gap-1"
            >
              {copiedCode ? (
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
          {/* Ingestion & Overview Card */}
          <Card className="shadow-xs">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Ingestion & Index Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs space-y-3">
              {isIngestionLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : ingestionError ? (
                <div className="text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>Could not retrieve ingestion status</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[11px]">
                      Active Ingestion Run
                    </span>
                    <div>
                      {ingestion?.activeRun ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 text-[11px]">
                          Running
                        </Badge>
                      ) : (
                        <span className="font-medium text-foreground">Idle (None active)</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[11px]">
                      Latest Snapshot
                    </span>
                    <div>
                      {ingestion?.latestSnapshot ? (
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-mono ${getSnapshotBadgeVariant(
                              ingestion.latestSnapshot.state
                            )}`}
                          >
                            {ingestion.latestSnapshot.state}
                          </Badge>
                          <span className="font-mono text-[11px] text-muted-foreground truncate">
                            {ingestion.latestSnapshot.id.slice(0, 8)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>

                  {ingestion?.latestSuccessfulSnapshot && (
                    <div className="col-span-2 space-y-1 pt-2 border-t">
                      <span className="text-muted-foreground block text-[11px]">
                        Latest Successful Snapshot
                      </span>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-mono text-foreground font-medium">
                          {ingestion.latestSuccessfulSnapshot.id}
                        </span>
                        <span>
                          {formatDate(ingestion.latestSuccessfulSnapshot.publishedAt)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs for Sources and Snapshots */}
          <Tabs defaultValue="sources" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sources" className="text-xs gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5" />
                <span>Sources</span>
                {sources && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
                    {sources.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="snapshots" className="text-xs gap-1.5">
                <History className="h-3.5 w-3.5" />
                <span>Snapshots</span>
                {snapshots && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
                    {snapshots.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Sources Content */}
            <TabsContent value="sources" className="pt-3 space-y-3">
              {isSourcesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              ) : sourcesError ? (
                <div className="p-4 text-center text-xs text-destructive">
                  Failed to load sources for this project.
                </div>
              ) : !sources || sources.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <FolderGit2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="font-medium text-foreground">No sources configured</p>
                  <p className="mt-1">Add local folders or Git repositories to start indexing this project.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="rounded-md border p-3 hover:bg-muted/40 transition-colors space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {source.kind === "repository" ? (
                            <FolderGit2 className="h-4 w-4 text-primary" />
                          ) : (
                            <BookOpen className="h-4 w-4 text-purple-500" />
                          )}
                          <span className="font-semibold text-foreground">
                            {source.name}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="capitalize text-[10px] font-normal"
                        >
                          {source.kind}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px] truncate bg-muted/60 px-2 py-1 rounded">
                        <HardDrive className="h-3 w-3 shrink-0" />
                        <span className="truncate">{renderSourceLocator(source)}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <span>ID: {source.id.slice(0, 8)}</span>
                        <span>Added {formatDate(source.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Snapshots Content */}
            <TabsContent value="snapshots" className="pt-3 space-y-3">
              {isSnapshotsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              ) : snapshotsError ? (
                <div className="p-4 text-center text-xs text-destructive">
                  Failed to load snapshots for this project.
                </div>
              ) : !snapshots || snapshots.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <History className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="font-medium text-foreground">No snapshots generated</p>
                  <p className="mt-1">Trigger an ingestion run to create graph and semantic snapshots.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {snapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="rounded-md border p-3 hover:bg-muted/40 transition-colors space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono uppercase ${getSnapshotBadgeVariant(
                              snapshot.state
                            )}`}
                          >
                            {snapshot.state}
                          </Badge>
                          <span className="font-mono font-medium text-foreground text-[11px]">
                            {snapshot.id}
                          </span>
                        </div>
                        {snapshot.indexCapability && (
                          <Badge variant="secondary" className="text-[10px]">
                            {snapshot.indexCapability}
                          </Badge>
                        )}
                      </div>

                      {snapshot.failureReason && (
                        <div className="rounded bg-destructive/10 p-2 text-destructive text-[11px] flex items-start gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{snapshot.failureReason}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Created: {formatDate(snapshot.createdAt)}
                        </span>
                        {snapshot.publishedAt && (
                          <span>Published: {formatDate(snapshot.publishedAt)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
