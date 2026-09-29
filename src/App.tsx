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
import Snapshots from "@/pages/Snapshots";
import Retrieval from "@/pages/Retrieval";
import NotFound from "@/pages/NotFound";
import Settings from "@/pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

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
      { path: "snapshots", element: <Snapshots /> },
      { path: "retrieval", element: <Retrieval /> },
      { path: "settings", element: <Settings /> },
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
