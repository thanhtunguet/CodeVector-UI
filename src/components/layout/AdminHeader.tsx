import * as React from "react";
import { Link } from "react-router-dom";
import { Search, Settings, Github } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface BreadcrumbItemData {
  label: string;
  href?: string;
}

export interface AdminHeaderProps {
  title?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItemData[];
}

export function AdminHeader({
  title,
  description,
  breadcrumbs,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-4" />

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.label + idx}>
                    <BreadcrumbItem>
                      {isLast || !crumb.href ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : title ? (
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {description && (
              <p className="text-xs text-muted-foreground truncate hidden md:block">
                {description}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Quick Search */}
        <div className="relative hidden md:block w-48 lg:w-72">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Quick search... (Ctrl+K)"
            aria-label="Quick search"
            className="h-8 pl-8 text-xs bg-muted/40 focus-visible:bg-background"
          />
        </div>

        {/* Server Status Badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="hidden sm:inline">Connected</span>
          <span className="sm:hidden">Ready</span>
        </div>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              aria-label="User profile menu"
              className="relative h-8 w-8 rounded-full p-0 hover:bg-muted"
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src="" alt="Admin" />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  CV
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">CodeVector Admin</p>
                <p className="text-xs leading-none text-muted-foreground">
                  admin@codevector.local
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href="https://github.com/codevector/codevector"
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer"
              >
                <Github className="mr-2 h-4 w-4" />
                <span>GitHub Repository</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
              Version 0.1.0 • Connected
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
