import React from "react";
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
import { buttonVariants } from "@/components/ui/button";
import { useDeleteProject } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { Project } from "@/services/api";
import { cn } from "@/lib/utils";

interface DeleteProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: DeleteProjectDialogProps) {
  const { toast } = useToast();
  const deleteProjectMutation = useDeleteProject();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!project) return;

    try {
      await deleteProjectMutation.mutateAsync(project.code);
      toast({
        title: "Project Deleted",
        description: `Project "${project.name}" (${project.code}) has been permanently deleted.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete project";
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: errorMessage,
      });
    }
  };

  const isDeleting = deleteProjectMutation.isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[460px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-base font-semibold">
                Delete Project
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                This action is destructive and irreversible.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="py-2 text-sm text-foreground/90">
          <p>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">
              {project?.name || project?.code}
            </span>{" "}
            (<code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{project?.code}</code>)?
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            All registered sources, code intelligence snapshots, symbol indices, and graph relationships associated with this project will be removed.
          </p>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel
            disabled={isDeleting}
            className="h-9 text-xs"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className={cn(
              buttonVariants({ variant: "destructive" }),
              "h-9 text-xs gap-1.5"
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Project</span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
