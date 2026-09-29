import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Sparkles,
  FolderTree,
  Code2,
  FileCode,
  Layers,
  History,
  RefreshCw,
  X,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Hash,
  Loader2,
  ArrowRight,
  Database,
  SlidersHorizontal,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectSnapshots } from "@/hooks/useProjects";
import { useProjectSelection } from "@/hooks/useSources";
import { useSearchProject } from "@/hooks/useRetrieval";
import { EntityDetailSheet } from "@/components/retrieval/EntityDetailSheet";
import { EvidenceViewerDialog } from "@/components/retrieval/EvidenceViewerDialog";
import type { SearchResultItem } from "@/services/api";

type SearchMode = "symbol" | "path" | "semantic";

function getKindColor(kind?: string): string {
  if (!kind) return "bg-muted text-muted-foreground border-border";
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

function formatScore(score?: number): string {
  if (score === undefined || score === null || isNaN(score)) return "1.00";
  if (score <= 1.0) {
    return `${(score * 100).toFixed(1)}%`;
  }
  return score.toFixed(2);
}

export function Retrieval() {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    projects,
    selectedCode,
    selectedProject,
    setSelectedCode,
    isLoading: isProjectsLoading,
    refetch: refetchProjects,
  } = useProjectSelection();

  // URL state synchronization
  const initialMode = (searchParams.get("type") as SearchMode) || "symbol";
  const initialQuery = searchParams.get("q") || "";
  const initialSnapshot = searchParams.get("snapshot") || "latest";

  const [searchMode, setSearchMode] = useState<SearchMode>(
    ["symbol", "path", "semantic"].includes(initialMode) ? initialMode : "symbol"
  );
  const [searchQueryInput, setSearchQueryInput] = useState<string>(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState<string>(initialQuery);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>(initialSnapshot);
  const [limit, setLimit] = useState<number>(20);

  // Search timing metrics
  const searchStartTimeRef = useRef<number>(0);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);

  // Sheet & Dialog state
  const [inspectEntityId, setInspectEntityId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [evidencePath, setEvidencePath] = useState<string | null>(null);
  const [evidenceLineRange, setEvidenceLineRange] = useState<{
    startLine?: number | null;
    endLine?: number | null;
  }>({});
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  // Fetch snapshots for project
  const { data: snapshots = [], isLoading: isSnapshotsLoading } =
    useProjectSnapshots(selectedCode || undefined);

  const publishedSnapshots = useMemo(
    () => snapshots.filter((s) => s.state === "published"),
    [snapshots]
  );

  const activeSnapshotParam =
    selectedSnapshotId === "latest" ? undefined : selectedSnapshotId;

  // Search Query Hook
  const {
    data: searchResponse,
    isLoading: isSearchLoading,
    isFetching: isSearchFetching,
    isError: isSearchError,
    error: searchError,
    refetch: refetchSearch,
  } = useSearchProject(
    selectedCode || undefined,
    submittedQuery,
    searchMode,
    {
      limit,
      snapshotId: activeSnapshotParam,
      enabled: Boolean(selectedCode && submittedQuery.trim().length > 0),
    }
  );

  // Measure response duration
  useEffect(() => {
    if (isSearchFetching) {
      searchStartTimeRef.current = performance.now();
    } else if (searchStartTimeRef.current > 0) {
      const elapsed = Math.round(performance.now() - searchStartTimeRef.current);
      setSearchDurationMs(elapsed);
      searchStartTimeRef.current = 0;
    }
  }, [isSearchFetching]);

  // Sync state to URL search params
  const updateUrlParams = (newParams: {
    q?: string;
    type?: SearchMode;
    snapshot?: string;
  }) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (newParams.q !== undefined) {
          if (newParams.q) next.set("q", newParams.q);
          else next.delete("q");
        }
        if (newParams.type !== undefined) {
          next.set("type", newParams.type);
        }
        if (newParams.snapshot !== undefined) {
          if (newParams.snapshot && newParams.snapshot !== "latest") {
            next.set("snapshot", newParams.snapshot);
          } else {
            next.delete("snapshot");
          }
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchQueryInput.trim();
    setSubmittedQuery(trimmed);
    updateUrlParams({ q: trimmed, type: searchMode, snapshot: selectedSnapshotId });
  };

  const handleClear = () => {
    setSearchQueryInput("");
    setSubmittedQuery("");
    setSearchDurationMs(null);
    updateUrlParams({ q: "" });
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    updateUrlParams({ type: mode });
  };

  const handleSnapshotChange = (val: string) => {
    setSelectedSnapshotId(val);
    updateUrlParams({ snapshot: val });
  };

  const handleOpenEntityDetail = (entityId: string) => {
    setInspectEntityId(entityId);
    setIsDetailOpen(true);
  };

  const handleOpenEvidence = (
    path: string,
    startLine?: number | null,
    endLine?: number | null
  ) => {
    setEvidencePath(path);
    setEvidenceLineRange({ startLine, endLine });
    setIsEvidenceOpen(true);
  };

  // Inspect error type for Capability Unavailable (503 / embeddings)
  const isCapabilityUnavailable = useMemo(() => {
    if (!isSearchError || !searchError) return false;
    const msg = searchError.message.toLowerCase();
    return (
      msg.includes("unavailable") ||
      msg.includes("capability") ||
      msg.includes("embedding") ||
      msg.includes("graph-only") ||
      msg.includes("vector capability")
    );
  }, [isSearchError, searchError]);

  const searchResults: SearchResultItem[] = searchResponse?.results ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Search className="h-6 w-6 text-primary" />
            Retrieval & Search
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Query symbol graphs, perform hybrid semantic vector lookups, inspect relations, and preview source file evidence.
          </p>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Select
            value={selectedCode}
            onValueChange={setSelectedCode}
            disabled={isProjectsLoading}
          >
            <SelectTrigger className="w-[200px] h-9 bg-card">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => {
              refetchProjects();
              if (submittedQuery) refetchSearch();
            }}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Search Controls Card */}
      <Card className="shadow-sm">
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Top row: Mode Tabs and Snapshot Selector */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            {/* Search Mode Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border text-xs font-medium">
              <button
                type="button"
                onClick={() => handleModeChange("symbol")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  searchMode === "symbol"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="h-3.5 w-3.5 text-blue-500" />
                Symbol Search
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("path")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  searchMode === "path"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FolderTree className="h-3.5 w-3.5 text-emerald-500" />
                Path Search
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("semantic")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  searchMode === "semantic"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                Semantic Search
              </button>
            </div>

            {/* Scope and Limits */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Snapshot:</span>
              </div>
              <Select
                value={selectedSnapshotId}
                onValueChange={handleSnapshotChange}
                disabled={isSnapshotsLoading}
              >
                <SelectTrigger className="w-[190px] h-8 text-xs bg-background">
                  <SelectValue placeholder="Select snapshot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest Published Snapshot</SelectItem>
                  {publishedSnapshots.map((snap) => (
                    <SelectItem key={snap.id} value={snap.id}>
                      {snap.id.slice(0, 16)}... ({snap.indexCapability || "graph"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1">
                <span className="hidden sm:inline">Limit:</span>
              </div>
              <Select
                value={String(limit)}
                onValueChange={(val) => setLimit(Number(val))}
              >
                <SelectTrigger className="w-[75px] h-8 text-xs bg-background">
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search Input Bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {searchMode === "semantic" ? (
                  <Sparkles className="h-4 w-4 text-purple-500" />
                ) : searchMode === "path" ? (
                  <FolderTree className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Code2 className="h-4 w-4 text-blue-500" />
                )}
              </div>
              <Input
                type="text"
                value={searchQueryInput}
                onChange={(e) => setSearchQueryInput(e.target.value)}
                placeholder={
                  searchMode === "symbol"
                    ? "Enter symbol, function, or class name (e.g. calculateDistance, UserRepository)..."
                    : searchMode === "path"
                    ? "Enter path substring or pattern (e.g. src/auth, components/ui, .ts)..."
                    : "Ask a question or describe logic (e.g. how is user authentication validated?)..."
                }
                className="pl-9 pr-9 h-11 text-sm bg-background font-mono"
              />
              {searchQueryInput && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSearchFetching || !searchQueryInput.trim()}
              className="h-11 px-5 gap-2"
            >
              {isSearchFetching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </>
              )}
            </Button>
          </form>

          {/* Search Mode Hint */}
          <div className="text-xs text-muted-foreground flex items-center justify-between px-1">
            <span>
              {searchMode === "symbol" &&
                "Exact and prefix matching across indexed AST symbols, types, and exported identifiers."}
              {searchMode === "path" &&
                "Fast path substring pattern match across all captured repository files."}
              {searchMode === "semantic" &&
                "Natural language embedding vector search enriched with graph topological relations."}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground/70 hidden sm:inline">
              Press Enter ↵ to search
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Capability Unavailable Warning (e.g. 503 Semantic Search without embeddings) */}
      {isCapabilityUnavailable && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-semibold text-sm">
            Semantic Vector Retrieval Unavailable
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-2">
            <p>
              {searchError?.message ||
                "Snapshot was indexed in graph-only mode or embedding client is not configured on this instance."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/20"
                onClick={() => handleModeChange("symbol")}
              >
                <Code2 className="h-3 w-3 mr-1" />
                Switch to Symbol Search
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/20"
                onClick={() => handleModeChange("path")}
              >
                <FolderTree className="h-3 w-3 mr-1" />
                Switch to Path Search
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Standard Search Error (non-capability) */}
      {isSearchError && !isCapabilityUnavailable && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-semibold text-sm">Search Request Failed</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {searchError?.message || "An unexpected error occurred while executing the search query."}
          </AlertDescription>
        </Alert>
      )}

      {/* Results Header Info Bar */}
      {submittedQuery && !isSearchError && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">
              {isSearchFetching
                ? "Searching entities..."
                : `Found ${searchResults.length} ${
                    searchResults.length === 1 ? "result" : "results"
                  }`}
            </span>
            <span>for</span>
            <span className="font-mono font-medium text-foreground">"{submittedQuery}"</span>
            <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0">
              {searchMode}
            </Badge>
          </div>

          {searchDurationMs !== null && !isSearchFetching && (
            <span className="font-mono text-[11px] text-muted-foreground/80">
              Took {searchDurationMs}ms
            </span>
          )}
        </div>
      )}

      {/* Results Section */}
      <Card className="shadow-sm overflow-hidden">
        {isSearchLoading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="space-y-1.5 w-2/3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-3 w-64" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : !submittedQuery ? (
          /* Empty Initial State */
          <div className="py-16 px-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Code2 className="h-7 w-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">
                Ready for Retrieval & Code Intelligence
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose a mode above and enter a search query. You can lookup symbol graphs, find files by path, or perform hybrid semantic queries with topological context.
              </p>
            </div>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-lg mx-auto">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1 font-mono"
                onClick={() => {
                  setSearchMode("symbol");
                  setSearchQueryInput("main");
                  setSubmittedQuery("main");
                  updateUrlParams({ q: "main", type: "symbol" });
                }}
              >
                Symbol: "main"
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1 font-mono"
                onClick={() => {
                  setSearchMode("path");
                  setSearchQueryInput(".ts");
                  setSubmittedQuery(".ts");
                  updateUrlParams({ q: ".ts", type: "path" });
                }}
              >
                Path: ".ts"
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1 font-mono"
                onClick={() => {
                  setSearchMode("semantic");
                  setSearchQueryInput("authentication flow");
                  setSubmittedQuery("authentication flow");
                  updateUrlParams({ q: "authentication flow", type: "semantic" });
                }}
              >
                Semantic: "authentication flow"
              </Button>
            </div>
          </div>
        ) : searchResults.length === 0 ? (
          /* No Results State */
          <div className="py-16 px-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Search className="h-6 w-6 opacity-40" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No matches found</h3>
              <p className="text-xs text-muted-foreground">
                No entities matched "{submittedQuery}" in the selected snapshot.
              </p>
            </div>
            <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto">
              Try adjusting your query, switching search modes (Symbol, Path, or Semantic), or expanding snapshot selection.
            </p>
          </div>
        ) : (
          /* Results Table */
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[35%]">Entity / Symbol</TableHead>
                <TableHead className="w-[35%]">File Location</TableHead>
                <TableHead className="w-[12%] text-center">Score</TableHead>
                <TableHead className="w-[18%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((item, index) => {
                const entityId = item.entityId ?? item.id ?? `entity-${index}`;
                const name = item.name ?? item.path ?? "Unnamed Entity";
                const kind = item.kind ?? "symbol";
                const filePath = item.location?.path ?? item.path ?? "";
                const startLine = item.location?.startLine ?? null;
                const endLine = item.location?.endLine ?? null;
                const score = item.score;

                return (
                  <TableRow
                    key={`${entityId}-${index}`}
                    className="hover:bg-muted/40 transition-colors group"
                  >
                    {/* Entity Name & Kind */}
                    <TableCell className="align-middle">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-semibold text-sm text-foreground hover:text-primary cursor-pointer transition-colors"
                            onClick={() => handleOpenEntityDetail(entityId)}
                          >
                            {name}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize px-1.5 py-0 ${getKindColor(kind)}`}
                          >
                            {kind}
                          </Badge>
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground truncate max-w-xs sm:max-w-sm">
                          ID: {entityId}
                        </div>
                      </div>
                    </TableCell>

                    {/* File Location */}
                    <TableCell className="align-middle">
                      <div className="space-y-0.5">
                        <span
                          className="font-mono text-xs text-foreground/90 hover:text-primary hover:underline cursor-pointer flex items-center gap-1.5"
                          title="Click to view file evidence"
                          onClick={() =>
                            filePath && handleOpenEvidence(filePath, startLine, endLine)
                          }
                        >
                          <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{filePath || "N/A"}</span>
                          {startLine && (
                            <span className="text-primary font-bold shrink-0">
                              :{startLine}
                            </span>
                          )}
                        </span>
                        {startLine && (
                          <div className="text-[11px] text-muted-foreground font-mono pl-5">
                            Line {startLine}
                            {endLine && endLine !== startLine ? ` to ${endLine}` : ""}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Score */}
                    <TableCell className="text-center align-middle">
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs font-medium"
                      >
                        {formatScore(score)}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5"
                          onClick={() => handleOpenEntityDetail(entityId)}
                          title="Inspect relations and dependency graph"
                        >
                          Inspect
                        </Button>

                        {filePath && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              handleOpenEvidence(filePath, startLine, endLine)
                            }
                            title="View source file evidence"
                          >
                            <FileCode className="h-3.5 w-3.5 mr-1" />
                            Evidence
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Entity Detail Sheet */}
      <EntityDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        projectCode={selectedCode}
        entityId={inspectEntityId}
        snapshotId={activeSnapshotParam}
        onSelectEntity={(nextId) => setInspectEntityId(nextId)}
        onViewEvidence={(path, start, end) => handleOpenEvidence(path, start, end)}
      />

      {/* Evidence Viewer Dialog */}
      <EvidenceViewerDialog
        open={isEvidenceOpen}
        onOpenChange={setIsEvidenceOpen}
        projectCode={selectedCode}
        path={evidencePath}
        snapshotId={activeSnapshotParam}
        startLine={evidenceLineRange.startLine}
        endLine={evidenceLineRange.endLine}
      />
    </div>
  );
}

export default Retrieval;
