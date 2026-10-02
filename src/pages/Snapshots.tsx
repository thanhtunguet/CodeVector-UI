import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  History,
  Database,
  Plus,
  RefreshCw,
  Search,
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  Sparkles,
  GitBranch,
  FileCode,
  Layers,
  Activity,
  Trash2,
  MoreHorizontal,
  SlidersHorizontal,
  ExternalLink,
  Cpu,
  ArrowRight,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteSnapshot,
  useProjectIngestion,
  useProjectSnapshots,
} from "@/hooks/useProjects";
import { useProjectSelection } from "@/hooks/useSources";
import { useToast } from "@/hooks/use-toast";
import { SnapshotDetailSheet } from "@/components/snapshots/SnapshotDetailSheet";
import { WorkerEventPanel } from "@/components/worker/WorkerEventPanel";
import { CleanupSnapshotsDialog } from "@/components/snapshots/CleanupSnapshotsDialog";
import type { Snapshot } from "@/services/api";
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

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "MMM d, HH:mm");
  } catch {
    return dateStr;
  }
}

export function Snapshots() {
  const { toast } = useToast();
  const {
    projects,
    selectedCode,
    selectedProject,
    setSelectedCode,
    isLoading: isProjectsLoading,
    refetch: refetchProjects,
  } = useProjectSelection();

  // Filters & UI State
  const [searchFilter, setSearchFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "published" | "building" | "failed">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal / Sheet State
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [snapshotToDelete, setSnapshotToDelete] = useState<Snapshot | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);

  // Queries
  const {
    data: snapshots,
    isLoading: isSnapshotsLoading,
    isRefetching: isSnapshotsRefetching,
    refetch: refetchSnapshots,
  } = useProjectSnapshots(selectedCode || undefined);

  const {
    data: ingestion,
    isLoading: isIngestionLoading,
    isRefetching: isIngestionRefetching,
    refetch: refetchIngestion,
  } = useProjectIngestion(selectedCode || undefined);
  const deleteSnapshotMutation = useDeleteSnapshot();

  const isRefreshing = isSnapshotsRefetching || isIngestionRefetching;

  const handleRefreshAll = () => {
    refetchProjects();
    if (selectedCode) {
      refetchSnapshots();
      refetchIngestion();
    }
  };

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

  // Inspect snapshot click handler
  const handleInspectSnapshot = (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
    setIsDetailSheetOpen(true);
  };

  const handleDeleteSnapshot = async () => {
    if (!selectedCode || !snapshotToDelete) return;

    try {
      await deleteSnapshotMutation.mutateAsync({
        code: selectedCode,
        snapshotId: snapshotToDelete.id,
      });

      toast({
        title: "Snapshot Deleted",
        description: `Snapshot ${snapshotToDelete.id} was permanently removed.`,
      });
      setSnapshotToDelete(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete snapshot.";
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: message,
      });
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    if (!snapshots) return { total: 0, published: 0, building: 0, failed: 0 };
    return {
      total: snapshots.length,
      published: snapshots.filter((s) => s.state === "published").length,
      building: snapshots.filter((s) => s.state === "building").length,
      failed: snapshots.filter((s) => s.state === "failed").length,
    };
  }, [snapshots]);

  // Active / Latest Published Snapshot
  const latestPublished = useMemo(() => {
    if (ingestion?.published) {
      return ingestion.published;
    }
    if (ingestion?.latestSuccessfulSnapshot) {
      return ingestion.latestSuccessfulSnapshot;
    }
    if (!snapshots) return null;
    return snapshots.find((s) => s.state === "published") ?? null;
  }, [ingestion, snapshots]);

  // Filtered and sorted snapshots
  const filteredSnapshots = useMemo(() => {
    if (!snapshots) return [];
    return snapshots
      .filter((s) => {
        const matchesState = stateFilter === "all" || s.state === stateFilter;
        const query = searchFilter.toLowerCase().trim();
        const matchesSearch =
          !query ||
          s.id.toLowerCase().includes(query) ||
          (s.embeddingModelId && s.embeddingModelId.toLowerCase().includes(query)) ||
          (s.failureReason && s.failureReason.toLowerCase().includes(query));
        return matchesState && matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [snapshots, stateFilter, searchFilter]);

  // Badge helper
  const getSnapshotBadge = (state: Snapshot["state"]) => {
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
          icon: <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />,
          label: state,
          className: "bg-muted text-muted-foreground",
        };
    }
  };

  // Capability badge helper
  const getCapabilityBadge = (capability?: string) => {
    const normalized = capability?.toLowerCase();
    if (normalized === "full" || normalized === "semantic") {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-mono flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" />
          Semantic
        </Badge>
      );
    }
    if (normalized === "graph_only" || normalized === "syntax") {
      return (
        <Badge
          variant="outline"
          className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 text-[10px] font-mono flex items-center gap-1"
        >
          <GitBranch className="h-3 w-3" />
          Syntax
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-muted text-muted-foreground border-border text-[10px] font-mono flex items-center gap-1"
      >
        <FileCode className="h-3 w-3" />
        Text
      </Badge>
    );
  };

  // Zero projects empty state
  if (!isProjectsLoading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
          <Database className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">No Projects Found</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          To inspect snapshots and manage vector index runs, you must create a project first.
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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Snapshots & Runs
            </h1>
            {selectedProject && (
              <Badge variant="outline" className="font-mono text-xs">
                {selectedProject.code}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Inspect historical code intelligence snapshots, diff graphs, vector index status, and configure retention cleanup.
          </p>
        </div>

        {/* Project Selector & Header Actions */}
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

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="h-9 w-9 p-0"
            title="Refresh snapshots and status"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>

          {/* Cleanup Old Snapshots Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCleanupOpen(true)}
            disabled={!selectedCode || !snapshots || snapshots.length === 0}
            className="h-9 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
          >
            <Trash2 className="h-4 w-4" />
            Cleanup Old Snapshots
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Snapshots */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Snapshots
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <History className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isSnapshotsLoading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <div className="text-2xl font-bold font-mono">{stats.total}</div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {stats.published} published
              </span>
              {stats.building > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {stats.building} building
                </span>
              )}
              {stats.failed > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                  <XCircle className="h-3 w-3" />
                  {stats.failed} failed
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active / Latest Published Snapshot */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Published Snapshot
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isSnapshotsLoading || isIngestionLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>
            ) : latestPublished ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-semibold text-foreground">
                    {latestPublished.id.slice(0, 8)}...
                  </code>
                  {getCapabilityBadge(latestPublished.indexCapability)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Published {formatRelativeTime(latestPublished.publishedAt)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">No published snapshot</span>
                <p className="text-[11px] text-muted-foreground">
                  Trigger ingestion to build and publish a snapshot.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Active Ingestion Run Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ingestion Run Status
            </CardTitle>
            <div
              className={`p-2 rounded-lg ${
                ingestion?.activeRun
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isIngestionLoading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : ingestion?.activeRun ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs font-semibold gap-1.5 uppercase font-mono"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Active Run
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {ingestion.activeRun.id ? ingestion.activeRun.id.slice(0, 8) : "running"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                  Live indexing & vectorization in progress (polling 2s)
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-medium gap-1.5"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                    Engine Idle
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Ready to trigger new graph or semantic builds.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Snapshot ID, model, or failure..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={stateFilter}
            onValueChange={(val) => setStateFilter(val as "all" | "published" | "building" | "failed")}
          >
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All States</SelectItem>
              <SelectItem value="published" className="text-xs">Published</SelectItem>
              <SelectItem value="building" className="text-xs">Building</SelectItem>
              <SelectItem value="failed" className="text-xs">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Snapshots Table Card */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Snapshot Catalog</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                All indexed snapshots, semantic capabilities, and publication history for this project.
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Showing {filteredSnapshots.length} of {snapshots?.length || 0}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isSnapshotsLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !snapshots || snapshots.length === 0 ? (
            /* Selected project has no snapshots yet */
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-3 rounded-full bg-muted text-muted-foreground mb-3">
                <History className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No Snapshots Found</h3>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
                No code intelligence snapshots have been built for this project yet. Trigger ingestion on Sources or Project Detail to construct the first snapshot.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Button asChild variant="default" size="sm" className="gap-1.5 text-xs">
                  <Link to={`/sources?project=${encodeURIComponent(selectedCode)}`}>
                    Go to Sources & Ingest
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link to={`/projects/${encodeURIComponent(selectedCode)}`}>
                    View Project Detail
                  </Link>
                </Button>
              </div>
            </div>
          ) : filteredSnapshots.length === 0 ? (
            /* Filter produced 0 results */
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <Search className="h-6 w-6 text-muted-foreground mb-2" />
              <h3 className="text-sm font-semibold">No Matching Snapshots</h3>
              <p className="text-xs text-muted-foreground mt-1">
                No snapshots match the current search or state filter.
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearchFilter("");
                  setStateFilter("all");
                }}
                className="mt-2 text-xs"
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[120px] text-xs">State</TableHead>
                    <TableHead className="text-xs">Snapshot ID</TableHead>
                    <TableHead className="text-xs">Capability & Vector Model</TableHead>
                    <TableHead className="text-xs">Created At</TableHead>
                    <TableHead className="text-xs">Published At</TableHead>
                    <TableHead className="text-xs">Notes / Failure</TableHead>
                    <TableHead className="text-right text-xs pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSnapshots.map((snap) => {
                    const badge = getSnapshotBadge(snap.state);
                    const isCopied = copiedId === snap.id;

                    return (
                      <TableRow key={snap.id} className="hover:bg-muted/30">
                        {/* State Badge */}
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-mono flex items-center gap-1.5 w-fit ${badge.className}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </Badge>
                        </TableCell>

                        {/* Snapshot ID with copy */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-mono text-xs font-semibold text-foreground truncate max-w-[130px] sm:max-w-[180px]"
                              title={snap.id}
                            >
                              {snap.id}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyText(snap.id, "Snapshot ID", snap.id)}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                >
                                  {isCopied ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {isCopied ? "Copied!" : "Copy Snapshot ID"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>

                        {/* Capability & Model info */}
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {getCapabilityBadge(snap.indexCapability)}
                              {snap.embeddingDimensions && (
                                <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {snap.embeddingDimensions}d
                                </span>
                              )}
                            </div>
                            {snap.embeddingModelId && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono truncate max-w-[200px]" title={snap.embeddingModelId}>
                                <Cpu className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{snap.embeddingModelId}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Created At */}
                        <TableCell className="py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {formatDate(snap.createdAt)}
                        </TableCell>

                        {/* Published At */}
                        <TableCell className="py-3 text-xs font-mono whitespace-nowrap">
                          {snap.publishedAt ? (
                            <span className="text-foreground">{formatDate(snap.publishedAt)}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Not published</span>
                          )}
                        </TableCell>

                        {/* Notes / Failure Alert */}
                        <TableCell className="py-3 max-w-[220px]">
                          {snap.state === "failed" && snap.failureReason ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 text-xs text-destructive font-mono truncate cursor-pointer bg-destructive/10 px-2 py-1 rounded border border-destructive/20">
                                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="truncate">{snap.failureReason}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs font-mono break-words">
                                {snap.failureReason}
                              </TooltipContent>
                            </Tooltip>
                          ) : snap.indexCapabilityReason ? (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                              {snap.indexCapabilityReason}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-right pr-6" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open snapshot actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 text-xs">
                              <DropdownMenuItem
                                onClick={() => handleInspectSnapshot(snap)}
                                className="gap-2 cursor-pointer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span>Inspect</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSnapshotToDelete(snap)}
                                disabled={snap.state === "published" || snap.state === "building"}
                                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>
                                  {snap.state === "published" || snap.state === "building"
                                    ? "Delete unavailable"
                                    : "Delete Snapshot"}
                                </span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCode && ingestion?.activeRun && (
        <WorkerEventPanel
          projectCode={selectedCode}
          runId={ingestion.activeRun.id}
          activeRun={ingestion.activeRun}
          title="Active ingestion worker log"
        />
      )}

      {/* Slide-over Inspection Sheet */}
      <SnapshotDetailSheet
        projectCode={selectedCode}
        snapshotId={selectedSnapshot?.id ?? null}
        snapshot={selectedSnapshot}
        open={isDetailSheetOpen}
        onOpenChange={setIsDetailSheetOpen}
      />

      {/* Retention Cleanup Dialog */}
      <CleanupSnapshotsDialog
        projectCode={selectedCode}
        open={isCleanupOpen}
        onOpenChange={setIsCleanupOpen}
        onSuccess={() => {
          refetchSnapshots();
          refetchIngestion();
        }}
      />

      <AlertDialog
        open={Boolean(snapshotToDelete)}
        onOpenChange={(open) => {
          if (!open) setSnapshotToDelete(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-[460px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-semibold">
                  Delete Snapshot
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                  This removes the snapshot record and its stored index scopes.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="py-2 text-sm text-foreground/90">
            <p>
              Are you sure you want to delete snapshot{' '}
              <span className="font-mono font-semibold text-foreground">{snapshotToDelete?.id}</span>?
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              This action is irreversible for failed or stale snapshots and cannot be used on the active published or building snapshot.
            </p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteSnapshotMutation.isPending} className="h-9 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSnapshot}
              disabled={deleteSnapshotMutation.isPending}
              className="h-9 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSnapshotMutation.isPending ? "Deleting..." : "Delete Snapshot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Snapshots;
