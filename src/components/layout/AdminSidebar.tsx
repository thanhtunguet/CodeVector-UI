import { Link, useLocation } from "react-router-dom";
import {
  Code2,
  FolderGit2,
  Database,
  History,
  SearchCode,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navigation = [
  {
    name: "Projects",
    href: "/projects",
    icon: FolderGit2,
    aliases: ["/"],
  },
  {
    name: "Ingestion & Sources",
    href: "/sources",
    icon: Database,
  },
  {
    name: "Snapshots & Runs",
    href: "/snapshots",
    icon: History,
  },
  {
    name: "Retrieval & Search",
    href: "/retrieval",
    icon: SearchCode,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  const location = useLocation();

  const isItemActive = (item: (typeof navigation)[number]) => {
    if (location.pathname === item.href) return true;
    if (item.aliases?.includes(location.pathname)) return true;
    if (item.href !== "/" && location.pathname.startsWith(`${item.href}/`)) {
      return true;
    }
    return false;
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Code2 className="h-4 w-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold tracking-tight text-foreground">
              CodeVector
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Code Intelligence
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Main Navigation">
              <SidebarMenu>
                {navigation.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.name}
                      >
                        <Link to={item.href}>
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="truncate font-medium">Core Engine: Ready</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
