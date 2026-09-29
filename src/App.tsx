import { useState } from "react";
import { BrowserRouter, Outlet, RouteObject, useRoutes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Sources from "@/pages/Sources";
import NotFound from "@/pages/NotFound";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, History, SearchCode, Settings as SettingsIcon } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  phase,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
      <Card className="max-w-lg w-full text-center border-dashed">
        <CardHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground bg-muted/40">
            {phase} • Architecture Ready
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


function SnapshotsPage() {
  return (
    <ModulePlaceholder
      title="Snapshots & Runs"
      description="Historical code intelligence snapshots, diff graphs, and semantic index versioning."
      icon={History}
      phase="Phase 3"
    />
  );
}

function RetrievalPage() {
  return (
    <ModulePlaceholder
      title="Retrieval & Search"
      description="Hybrid semantic search, symbol graph traversals, and caller/dependency blast radius analysis."
      icon={SearchCode}
      phase="Phase 4"
    />
  );
}

function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Settings"
      description="Core engine connection parameters, embedding models, indexing rules, and client preferences."
      icon={SettingsIcon}
      phase="Phase 5"
    />
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export const routes: RouteObject[] = [
  {
    path: "/",
    element: (
      <AppProviders>
        <AdminLayout />
      </AppProviders>
    ),
    children: [
      { index: true, element: <Projects /> },
      { path: "projects", element: <Projects /> },
      { path: "projects/:code", element: <ProjectDetail /> },
      { path: "sources", element: <Sources /> },
      { path: "snapshots", element: <SnapshotsPage /> },
      { path: "retrieval", element: <RetrievalPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

function AppRoutes() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
