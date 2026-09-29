import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FolderGit2,
  BookOpen,
  Plus,
  Play,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  Clock,
  Layers,
  Activity,
  History,
  Sparkles,
  ArrowUpRight,
  Search,
  Database,
  CheckCircle2,
  Loader2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useProjectIngestion,
  useProjectSources,
} from "@/hooks/useProjects";
import { useProjectSelection } from "@/hooks/useSources";
import { useToast } from "@/hooks/use-toast";
import { RegisterSourceDialog } from "@/components/sources/RegisterSourceDialog";
import { TriggerIngestionDialog } from "@/components/sources/TriggerIngestionDialog";
import type { Snapshot, Source } from "@/services/api";
import { format } from "date-fns";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "MMM d, yyyy HH:mm");
  } catch {
    return dateStr;
  }
}

export function Sources() {
  const { toast } = useToast();
  const {
    projects,
    selectedCode,
    selectedProject,
    setSelectedCode,
    isLoading: isProjectsLoading,
    refetch: refetchProjects,
  } = useProjectSelection();

  const [searchFilter, setSearchFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "repository" | "documentation">("all");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isTriggerOpen, setIsTriggerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sources query for selected project
  const {
    data: sources,
    isLoading: isSourcesLoading,
    isRefetching: isSourcesRefetching,
    refetch: refetchSources,
  } = useProjectSources(selectedCode || undefined);

  // Ingestion status query (auto-polls every 2s when activeRun is non-null)
  const {
    data: ingestion,
    isLoading: isIngestionLoading,
    isRefetching: isIngestionRefetching,
    refetch: refetchIngestion,
  } = useProjectIngestion(selectedCode || undefined);

  // Filter sources
  const filteredSources = useMemo(() => {
    if (!sources) return [];
    return sources.filter((s) => {
      const matchesKind = kindFilter === "all" || s.kind === kindFilter;
      const query = searchFilter.toLowerCase().trim();
      const pathStr =
        s.locator.type === "local_directory" && "path" in s.locator
          ? String(s.locator.path).toLowerCase()
          : "";
      const matchesSearch =
        !query ||
        s.name.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        pathStr.includes(query);
      return matchesKind && matchesSearch;
    });
  }, [sources, searchFilter, kindFilter]);

  const handleCopyText = (text: string, label: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      description: `${label} copied to clipboard.`,
    });
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const getSnapshotBadgeClass = (state?: Snapshot["state"]) => {
    switch (state) {
      case "published":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "building":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const renderSourceLocator = (source: Source) => {
    if (source.locator.type === "local_directory" && "path" in source.locator) {
      return String(source.locator.path);
    }
    return JSON.stringify(source.locator);
  };

  const handleRefreshAll = () => {
    refetchProjects();
    if (selectedCode) {
      refetchSources();
      refetchIngestion();
    }
  };

  const isRefreshing = isSourcesRefetching || isIngestionRefetching;

  // Handle zero projects existing in database
  if (!isProjectsLoading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
          <Database className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">No Projects Found</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          To manage repositories and trigger intelligence ingestion runs, you must create a project first.
        </p>
        <div className="mt-6">
          <Button asChild className="gap-2">
            <Link to="/projects">
              <Plus className="h-4 w-4" />
              Go to Projects
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ingestion & Sources
            </h1>
            {selectedProject && (
              <Badge variant="outline" className="font-mono text-xs">
                {selectedProject.code}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Manage local repositories and documentation sources, configure locators, and trigger code intelligence ingestion runs.
          </p>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Project Picker Dropdown */}
          <div className="w-56">
            {isProjectsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedCode} onValueChange={setSelectedCode}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.code} value={p.code} className="text-xs">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground font-mono ml-1.5">({p.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="h-9 w-9 p-0"
            title="Refresh sources and status"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>

          {/* Trigger Ingestion Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTriggerOpen(true)}
            disabled={!selectedCode || Boolean(ingestion?.activeRun)}
            className="h-9 gap-1.5 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary hover:text-primary"
          >
            {ingestion?.activeRun ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Ingesting...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Trigger Ingestion
              </>
            )}
          </Button>

          {/* Register Source Action */}
          <Button
            size="sm"
            onClick={() => setIsRegisterOpen(true)}
            disabled={!selectedCode}
            className="h-9 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Source
          </Button>
        </div>
      </div>

      {/* Live Ingestion Banner / Alerts */}
      {ingestion?.activeRun ? (
        <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-primary/5 p-4 sm:p-5 shadow-xs transition-all">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
                <RefreshCw className="h-5 w-5 animate-spin" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Ingestion in Progress...
                  </h3>
                  <Badge
                    variant="outline"
                    className="bg-primary/20 text-primary border-primary/30 text-[10px] animate-pulse"
                  >
                    Active Run
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Analyzing AST, resolving relationships, computing embeddings.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 border text-[11px] text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Polling every 2s
              </div>
            </div>
          </div>
        </div>
      ) : ingestion?.latestSnapshot?.state === "failed" ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-destructive">
                    Latest Ingestion Run Failed
                  </h3>
                  <Badge variant="destructive" className="text-[10px]">
                    Failed
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ingestion.latestSnapshot.failureReason ||
                    "An unexpected error occurred during indexing or graph resolution."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsTriggerOpen(true)}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 text-xs self-start sm:self-center"
            >
              <Play className="h-3.5 w-3.5" />
              Re-trigger Ingestion
            </Button>
          </div>
        </div>
      ) : null}

      {/* Summary Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Sources */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Sources
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isSourcesLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold">{sources?.length ?? 0}</div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {sources
                ? `${sources.filter((s) => s.kind === "repository").length} repositories, ${
                    sources.filter((s) => s.kind === "documentation").length
                  } docs`
                : "Configured inputs"}
            </p>
          </CardContent>
        </Card>

        {/* Active Runs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active Runs
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isIngestionLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {ingestion?.activeRun ? "1" : "0"}
                </span>
                <Badge
                  variant="outline"
                  className={
                    ingestion?.activeRun
                      ? "bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
                      : "bg-muted text-muted-foreground text-[10px]"
                  }
                >
                  {ingestion?.activeRun ? "Running" : "Idle"}
                </Badge>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {ingestion?.latestSuccessfulSnapshot?.publishedAt
                ? `Published ${formatDate(ingestion.latestSuccessfulSnapshot.publishedAt)}`
                : "No published snapshots"}
            </p>
          </CardContent>
        </Card>

        {/* Latest Snapshot State */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Latest Snapshot
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <History className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isIngestionLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                {ingestion?.latestSnapshot ? (
                  <>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-mono ${getSnapshotBadgeClass(
                        ingestion.latestSnapshot.state
                      )}`}
                    >
                      {ingestion.latestSnapshot.state}
                    </Badge>
                    <code className="text-xs font-mono text-muted-foreground truncate">
                      {ingestion.latestSnapshot.id.slice(0, 8)}
                    </code>
                  </>
                ) : (
                  <span className="text-base font-semibold text-muted-foreground">None</span>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {ingestion?.latestSuccessfulSnapshot?.indexCapability ? (
                <span className="capitalize">
                  Capability: {ingestion.latestSuccessfulSnapshot.indexCapability}
                </span>
              ) : (
                "Awaiting first index build"
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sources Management Section */}
      <div className="space-y-4">
        {/* Filters & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by name, ID, or path..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Kind Selector Filter */}
            <Select
              value={kindFilter}
              onValueChange={(val: "all" | "repository" | "documentation") => setKindFilter(val)}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All Kinds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Kinds
                </SelectItem>
                <SelectItem value="repository" className="text-xs">
                  Repositories
                </SelectItem>
                <SelectItem value="documentation" className="text-xs">
                  Documentation
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedProject && (
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Link to={`/projects/${selectedProject.code}`}>
                View Project Details
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>

        {/* Sources Content */}
        {isSourcesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : !sources || sources.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                <FolderGit2 className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-semibold">No data sources configured</h3>
                <p className="text-xs text-muted-foreground">
                  This project has no registered code repositories or documentation directories. Register a source to start building code intelligence graphs.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsRegisterOpen(true)}
                className="gap-2 text-xs"
              >
                <Plus className="h-4 w-4" />
                Register First Source
              </Button>
            </CardContent>
          </Card>
        ) : filteredSources.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
            <p className="text-xs font-medium text-foreground">No matching sources found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search query or filter options.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchFilter("");
                setKindFilter("all");
              }}
              className="text-xs h-7 mt-2"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="text-xs">Source Name & ID</TableHead>
                  <TableHead className="text-xs">Kind</TableHead>
                  <TableHead className="text-xs">Locator Path</TableHead>
                  <TableHead className="text-xs text-right">Created Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSources.map((source) => {
                  const locatorPath = renderSourceLocator(source);
                  const isCopiedPath = copiedId === `path-${source.id}`;
                  const isCopiedId = copiedId === `id-${source.id}`;

                  return (
                    <TableRow key={source.id} className="hover:bg-muted/30">
                      {/* Kind Icon */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {source.kind === "repository" ? (
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                              <FolderGit2 className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                              <BookOpen className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Name & ID */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-xs text-foreground block">
                            {source.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <code className="text-[10px] font-mono text-muted-foreground">
                              {source.id}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyText(source.id, "Source ID", `id-${source.id}`)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                              title="Copy source ID"
                            >
                              {isCopiedId ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </TableCell>

                      {/* Kind Badge */}
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="capitalize text-[11px] font-medium"
                        >
                          {source.kind}
                        </Badge>
                      </TableCell>

                      {/* Locator Path with One-Click Copy */}
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-md">
                          <code
                            className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded truncate select-all cursor-pointer hover:bg-muted transition-colors"
                            onClick={() =>
                              handleCopyText(locatorPath, "Locator path", `path-${source.id}`)
                            }
                            title="Click to copy path"
                          >
                            {locatorPath}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() =>
                              handleCopyText(locatorPath, "Locator path", `path-${source.id}`)
                            }
                            title="Copy path"
                          >
                            {isCopiedPath ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>

                      {/* Created Date */}
                      <TableCell className="text-right text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground/70" />
                          {formatDate(source.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <RegisterSourceDialog
        open={isRegisterOpen}
        onOpenChange={setIsRegisterOpen}
        selectedProjectCode={selectedCode}
        projects={projects}
        onProjectChange={setSelectedCode}
        onSuccess={() => {
          refetchSources();
          refetchIngestion();
        }}
      />

      <TriggerIngestionDialog
        open={isTriggerOpen}
        onOpenChange={setIsTriggerOpen}
        projectCode={selectedCode}
        projectName={selectedProject?.name}
        onSuccess={() => {
          refetchIngestion();
        }}
      />
    </div>
  );
}

export default Sources;
