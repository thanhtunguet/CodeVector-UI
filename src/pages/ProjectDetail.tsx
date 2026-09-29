import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Edit3,
  Play,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  FolderGit2,
  BookOpen,
  History,
  Search,
  Activity,
  Sparkles,
  Layers,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Plus,
  Loader2,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProject,
  useProjectIngestion,
  useProjectSources,
  useProjectSnapshots,
  useTriggerIngest,
  useSearchProject,
} from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { EditProjectSheet } from "@/components/projects/EditProjectSheet";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { AddSourceDialog } from "@/components/projects/AddSourceDialog";
import { CleanupSnapshotsDialog } from "@/components/projects/CleanupSnapshotsDialog";
import type { Snapshot, Source } from "@/services/api";
import { format } from "date-fns";

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

export function ProjectDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [copiedCode, setCopiedCode] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);

  // Search tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"symbol" | "path" | "semantic">("symbol");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
    refetch: refetchProject,
  } = useProject(code);

  const {
    data: ingestion,
    isLoading: isIngestionLoading,
    refetch: refetchIngestion,
  } = useProjectIngestion(code);

  const {
    data: sources,
    isLoading: isSourcesLoading,
    refetch: refetchSources,
  } = useProjectSources(code);

  const {
    data: snapshots,
    isLoading: isSnapshotsLoading,
    refetch: refetchSnapshots,
  } = useProjectSnapshots(code);

  const triggerIngestMutation = useTriggerIngest();

  const {
    data: searchResults,
    isLoading: isSearchLoading,
    isFetching: isSearchFetching,
  } = useSearchProject(code, activeSearchTerm, searchType, {
    enabled: Boolean(code && activeSearchTerm.trim().length > 0),
    limit: 30,
  });

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast({
      description: `Project code "${code}" copied to clipboard.`,
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleTriggerIngest = async () => {
    if (!code) return;
    try {
      await triggerIngestMutation.mutateAsync({ code });
      toast({
        title: "Ingestion started",
        description: `Ingestion run queued for project "${code}".`,
      });
      refetchIngestion();
      refetchSnapshots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to trigger ingestion";
      toast({
        variant: "destructive",
        title: "Ingestion Failed",
        description: msg,
      });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActiveSearchTerm(searchQuery.trim());
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

  if (isProjectLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isProjectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold">Project Not Found</h2>
        <p className="text-sm text-muted-foreground">
          Project with code &quot;{code}&quot; could not be loaded or does not exist.
        </p>
        <Button asChild variant="outline">
          <Link to="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation Breadcrumb / Back button */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
          <Link to="/projects">
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
      </div>

      {/* Main Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl border bg-card shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {project.name}
            </h1>
            <Badge
              variant="outline"
              className="font-mono text-xs px-2.5 py-0.5 gap-1.5 cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={handleCopyCode}
              title="Click to copy code"
            >
              <span>{project.code}</span>
              {copiedCode ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Created {formatDate(project.createdAt)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            className="gap-1.5"
          >
            <Edit3 className="h-4 w-4" />
            Edit Info
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerIngest}
            disabled={triggerIngestMutation.isPending}
            className="gap-1.5 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary hover:text-primary"
          >
            {triggerIngestMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Trigger Ingestion
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Ingestion & Index Capability Status Card */}
      <Card className="shadow-xs">
        <CardHeader className="py-4 px-6 flex flex-row items-center justify-between space-y-0 border-b">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Ingestion & Intelligence Status
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              refetchIngestion();
              refetchSnapshots();
            }}
            title="Refresh status"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {isIngestionLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Active Run */}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">
                  Active Run
                </span>
                <div>
                  {ingestion?.activeRun ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                      Running Ingestion
                    </Badge>
                  ) : (
                    <span className="text-sm font-medium text-foreground">Idle</span>
                  )}
                </div>
              </div>

              {/* Latest Snapshot */}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">
                  Latest Snapshot
                </span>
                <div>
                  {ingestion?.latestSnapshot ? (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-mono ${getSnapshotBadgeVariant(
                          ingestion.latestSnapshot.state
                        )}`}
                      >
                        {ingestion.latestSnapshot.state}
                      </Badge>
                      <code className="text-xs font-mono text-muted-foreground truncate">
                        {ingestion.latestSnapshot.id.slice(0, 8)}
                      </code>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </div>
              </div>

              {/* Capability */}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">
                  Index Capability
                </span>
                <div>
                  {ingestion?.latestSuccessfulSnapshot?.indexCapability ? (
                    <Badge variant="secondary" className="capitalize text-xs">
                      {ingestion.latestSuccessfulSnapshot.indexCapability}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not indexed</span>
                  )}
                </div>
              </div>

              {/* Published At */}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">
                  Last Published
                </span>
                <span className="text-xs text-foreground block truncate">
                  {formatDate(ingestion?.latestSuccessfulSnapshot?.publishedAt)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-3">
          <TabsTrigger value="sources" className="text-xs gap-2">
            <FolderGit2 className="h-4 w-4" />
            <span>Sources</span>
            {sources && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-1">
                {sources.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="text-xs gap-2">
            <History className="h-4 w-4" />
            <span>Snapshots</span>
            {snapshots && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-1">
                {snapshots.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs gap-2">
            <Search className="h-4 w-4" />
            <span>Quick Search</span>
          </TabsTrigger>
        </TabsList>

        {/* Sources Tab Content */}
        <TabsContent value="sources" className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Repository and documentation sources configured for this project.
            </p>
            <Button
              size="sm"
              onClick={() => setIsAddSourceOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Source
            </Button>
          </div>

          {isSourcesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : !sources || sources.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                <FolderGit2 className="h-10 w-10 text-muted-foreground/40" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">No data sources configured</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Add a local code repository or documentation folder to ingest and build knowledge graphs.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsAddSourceOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add First Source
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Source Name</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Registered At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell>
                        {source.kind === "repository" ? (
                          <FolderGit2 className="h-4 w-4 text-primary" />
                        ) : (
                          <BookOpen className="h-4 w-4 text-purple-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-xs">
                        {source.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-[11px]">
                          {source.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {renderSourceLocator(source)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(source.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Snapshots Tab Content */}
        <TabsContent value="snapshots" className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Historical intelligence snapshots, index capabilities, and build state logs.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCleanupOpen(true)}
              className="gap-1.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 border-amber-500/20"
            >
              <History className="h-3.5 w-3.5" />
              Cleanup Snapshots
            </Button>
          </div>

          {isSnapshotsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : !snapshots || snapshots.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                <History className="h-10 w-10 text-muted-foreground/40" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">No snapshots available</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Trigger an ingestion run to parse sources and generate the first code intelligence snapshot.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleTriggerIngest}
                  disabled={triggerIngestMutation.isPending}
                  className="gap-1.5 text-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run First Ingestion
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Snapshot ID</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Capability</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Published At</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((snap) => (
                    <TableRow key={snap.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {snap.id}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-mono ${getSnapshotBadgeVariant(
                            snap.state
                          )}`}
                        >
                          {snap.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {snap.indexCapability ? (
                          <Badge variant="secondary" className="capitalize text-[10px]">
                            {snap.indexCapability}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(snap.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(snap.publishedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {snap.failureReason ? (
                          <span className="text-destructive font-mono text-[11px]">
                            {snap.failureReason}
                          </span>
                        ) : snap.state === "published" ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> Live
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Quick Search Tab Content */}
        <TabsContent value="search" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="py-4 px-6 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                Query Symbols, Paths & Semantic Index
              </CardTitle>
              <CardDescription className="text-xs">
                Search symbols across parsed ASTs, source file paths, or vector embeddings for project &quot;{project.code}&quot;.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search symbols or files (e.g. ProjectService, auth, /src/)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="inline-flex rounded-md border p-1 bg-muted/40">
                    <Button
                      type="button"
                      variant={searchType === "symbol" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSearchType("symbol")}
                      className="h-7 text-xs px-2.5"
                    >
                      Symbol
                    </Button>
                    <Button
                      type="button"
                      variant={searchType === "path" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSearchType("path")}
                      className="h-7 text-xs px-2.5"
                    >
                      Path
                    </Button>
                    <Button
                      type="button"
                      variant={searchType === "semantic" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSearchType("semantic")}
                      className="h-7 text-xs px-2.5 gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Semantic
                    </Button>
                  </div>
                  <Button type="submit" size="sm" className="h-9 px-4 text-xs gap-1.5">
                    {isSearchLoading || isSearchFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    Search
                  </Button>
                </div>
              </form>

              {/* Results View */}
              <div className="pt-2">
                {isSearchLoading || isSearchFetching ? (
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : activeSearchTerm && searchResults ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
                      <span>
                        Found {searchResults.results.length} result(s) for &quot;{searchResults.query}&quot; ({searchResults.type})
                      </span>
                    </div>
                    {searchResults.results.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                        No matches found for your query. Ensure project sources are ingested.
                      </div>
                    ) : (
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Entity / Symbol</TableHead>
                              <TableHead>Kind</TableHead>
                              <TableHead>Path / Location</TableHead>
                              {searchResults.type === "semantic" && <TableHead className="text-right">Score</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchResults.results.map((res, idx) => (
                              <TableRow key={res.id ?? idx}>
                                <TableCell className="font-medium text-xs font-mono">
                                  <div className="flex items-center gap-1.5">
                                    <Code2 className="h-3.5 w-3.5 text-primary" />
                                    <span>{res.name || res.id || String(res)}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {res.kind ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {String(res.kind)}
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {res.path || "—"}
                                </TableCell>
                                {searchResults.type === "semantic" && (
                                  <TableCell className="text-right font-mono text-xs">
                                    {typeof res.score === "number" ? res.score.toFixed(3) : "—"}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
                    <Search className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">
                      Enter a symbol name, file path pattern, or semantic concept query above to search.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sider: Edit Project Info */}
      <EditProjectSheet
        project={project}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={() => {
          refetchProject();
        }}
      />

      {/* Dialog: Delete Project */}
      <DeleteProjectDialog
        project={project}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onSuccess={() => {
          navigate("/projects");
        }}
      />

      {/* Dialog: Add Source */}
      <AddSourceDialog
        projectCode={project.code}
        open={isAddSourceOpen}
        onOpenChange={setIsAddSourceOpen}
        onSuccess={() => {
          refetchSources();
        }}
      />

      {/* Dialog: Cleanup Snapshots */}
      <CleanupSnapshotsDialog
        projectCode={project.code}
        open={isCleanupOpen}
        onOpenChange={setIsCleanupOpen}
        onSuccess={() => {
          refetchSnapshots();
          refetchIngestion();
        }}
      />
    </div>
  );
}

export default ProjectDetail;
