import { useState, useMemo } from "react";
import {
  FolderGit2,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { ProjectDetailSheet } from "@/components/projects/ProjectDetailSheet";
import type { Project } from "@/services/api";
import { format } from "date-fns";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "PPpp");
  } catch {
    return dateStr;
  }
}

export function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDetailProject, setSelectedDetailProject] = useState<Project | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDeleteProject, setSelectedDeleteProject] = useState<Project | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { toast } = useToast();
  const { data: projects, isLoading, isError, error, refetch } = useProjects();

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      description: `Project code "${code}" copied to clipboard.`,
    });
    setTimeout(() => {
      setCopiedCode((current) => (current === code ? null : current));
    }, 2000);
  };

  const handleOpenDetail = (project: Project) => {
    setSelectedDetailProject(project);
    setIsDetailOpen(true);
  };

  const handleOpenDelete = (project: Project) => {
    setSelectedDeleteProject(project);
    setIsDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Projects</h2>
            {!isLoading && (
              <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
                {projects?.length ?? 0}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Manage registered codebases, view indexing snapshots, and inspect symbol graphs.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs"
            />
          </div>

          {/* Create Button */}
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-9 gap-1.5 shadow-sm text-xs shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Project</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        /* Loading Skeletons */
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%] text-xs">Project</TableHead>
                <TableHead className="text-xs">Created At</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-right text-xs w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : isError ? (
        /* Error State */
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8">
          <CardHeader className="space-y-2 pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-base text-destructive">
              Failed to Load Projects
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground max-w-md mx-auto">
              {error instanceof Error
                ? error.message
                : "Unable to retrieve the list of projects from the CodeVector server."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          </CardContent>
        </Card>
      ) : projects?.length === 0 ? (
        /* Empty State: No projects registered */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <FolderGit2 className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No projects yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Get started by registering a new project to index codebase symbols, architecture flows, and dependencies.
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="mt-5 gap-1.5 shadow-sm text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Project</span>
          </Button>
        </div>
      ) : filteredProjects.length === 0 ? (
        /* Empty State: Search filter yielded 0 results */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-10 text-center">
          <Search className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <h3 className="text-sm font-medium text-foreground">No matching projects found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            No projects matched "{searchQuery}". Try searching for another name or code.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="mt-3 text-xs"
          >
            Clear search filter
          </Button>
        </div>
      ) : (
        /* Data Table */
        <div className="rounded-lg border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[45%] text-xs font-semibold">Project</TableHead>
                <TableHead className="text-xs font-semibold">Created At</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-right text-xs font-semibold w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow
                  key={project.code}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleOpenDetail(project)}
                >
                  {/* Project Name & Code */}
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="font-semibold text-sm text-foreground hover:text-primary transition-colors">
                        {project.name}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {project.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                          title="Copy project code"
                          onClick={(e) => handleCopyCode(project.code, e)}
                        >
                          {copiedCode === project.code ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </TableCell>

                  {/* Created At */}
                  <TableCell className="py-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 opacity-70" />
                      <span>{formatDate(project.createdAt)}</span>
                    </div>
                  </TableCell>

                  {/* Status / Capabilities */}
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-medium"
                    >
                      Active
                    </Badge>
                  </TableCell>

                  {/* Actions Dropdown */}
                  <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 text-xs">
                        <DropdownMenuItem
                          onClick={() => handleOpenDetail(project)}
                          className="gap-2 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleOpenDelete(project)}
                          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete Project</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs and Sheets */}
      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <ProjectDetailSheet
        project={selectedDetailProject}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />

      <DeleteProjectDialog
        project={selectedDeleteProject}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onSuccess={() => {
          if (selectedDetailProject?.code === selectedDeleteProject?.code) {
            setIsDetailOpen(false);
            setSelectedDetailProject(null);
          }
        }}
      />
    </div>
  );
}

export default Projects;
