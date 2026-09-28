import { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader, BreadcrumbItemData } from "./AdminHeader";
import { AdminFooter } from "./AdminFooter";

export interface AdminLayoutProps {
  children?: ReactNode;
  title?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItemData[];
}

export function AdminLayout({
  children,
  title,
  description,
  breadcrumbs,
}: AdminLayoutProps) {
  const location = useLocation();

  const resolvedTitle =
    title ??
    (location.pathname.startsWith("/sources")
      ? "Ingestion & Sources"
      : location.pathname.startsWith("/snapshots")
      ? "Snapshots & Runs"
      : location.pathname.startsWith("/retrieval")
      ? "Retrieval & Search"
      : location.pathname.startsWith("/settings")
      ? "Settings"
      : "Projects");

  const resolvedDescription =
    description ??
    (location.pathname.startsWith("/sources")
      ? "Configure and monitor repository data sources"
      : location.pathname.startsWith("/snapshots")
      ? "Historical code snapshots, runs, and graph diffs"
      : location.pathname.startsWith("/retrieval")
      ? "Semantic search, symbol queries, and context retrieval"
      : location.pathname.startsWith("/settings")
      ? "System preferences and engine configuration"
      : "Manage indexed code repositories and workspaces");

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader
          title={resolvedTitle}
          description={resolvedDescription}
          breadcrumbs={breadcrumbs}
        />
        <div className="flex-1 p-6 overflow-auto">
          {children ?? <Outlet />}
        </div>
        <AdminFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default AdminLayout;
