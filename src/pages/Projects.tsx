import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderGit2,
  Plus,
  Search,
  GitBranch,
  Boxes,
  Database,
  ArrowUpRight,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function Projects() {
  const [searchQuery, setSearchQuery] = useState("");

  const projects = [
    {
      id: "codevector",
      name: "CodeVector",
      description: "Code intelligence, structural indexing, graph analysis, and context retrieval platform.",
      path: "/home/tungpt/Development/CodeVector",
      language: "TypeScript / Rust",
      symbols: "3,342",
      relationships: "7,846",
      flows: "157",
      status: "Synced",
      lastIndexed: "Just now",
    },
  ];

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Explore registered repositories, symbol indexes, and graph workspaces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Add Project</span>
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
            <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">1</div>
            <p className="text-xs text-muted-foreground mt-1">1 active workspace</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Indexed Symbols
            </CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">3,342</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Graph verified
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Relationships
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">7,846</div>
            <p className="text-xs text-muted-foreground mt-1">Calls, imports, inheritance</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Execution Flows
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">157</div>
            <p className="text-xs text-muted-foreground mt-1">Traced process paths</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Project Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="flex flex-col justify-between hover:border-primary/40 transition-colors shadow-xs">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">{project.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {project.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs line-clamp-2">
                    {project.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground truncate">
                {project.path}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t text-muted-foreground">
                <div>
                  <span className="block text-[10px] font-medium text-foreground">{project.symbols}</span>
                  <span>Symbols</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-foreground">{project.relationships}</span>
                  <span>Relations</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-foreground">{project.flows}</span>
                  <span>Flows</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 border-t flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5" />
                <span>main</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                  <Link to="/retrieval">
                    Query
                  </Link>
                </Button>
                <Button size="sm" asChild className="h-7 text-xs gap-1">
                  <Link to={`/projects/${project.id}`}>
                    Explore <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Projects;
