import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCleanupSnapshots } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, History, Loader2, Trash2 } from "lucide-react";

export interface CleanupSnapshotsDialogProps {
  projectCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CleanupSnapshotsDialog({
  projectCode,
  open,
  onOpenChange,
  onSuccess,
}: CleanupSnapshotsDialogProps) {
  const [retainCount, setRetainCount] = useState<number>(5);
  const [apiError, setApiError] = useState<string | null>(null);

  const { toast } = useToast();
  const cleanupMutation = useCleanupSnapshots();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retainCount < 1 || retainCount > 100) return;

    try {
      setApiError(null);
      const res = await cleanupMutation.mutateAsync({
        code: projectCode,
        retainCount,
      });

      const deletedCount =
        res.deletedSnapshots?.length ?? res.deletedSnapshotIds?.length ?? 0;
      const retainedCount =
        res.retainedSnapshots?.length ?? res.retainedSnapshotIds?.length ?? 0;

      toast({
        title: "Snapshots cleaned up",
        description: `Deleted ${deletedCount} stale snapshot(s), retained ${retainedCount} recent snapshot(s).`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cleanup snapshots";
      setApiError(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Cleanup Snapshots</DialogTitle>
              <DialogDescription className="text-xs">
                Prune historical and superseded snapshots to free graph and vector storage.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {apiError && (
          <Alert variant="destructive" className="my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{apiError}</AlertDescription>
          </Alert>
        )}

        <form id="cleanup-snapshots-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="retain-count" className="text-xs font-medium">
              Number of Snapshots to Retain (1 - 100)
            </Label>
            <Input
              id="retain-count"
              type="number"
              min={1}
              max={100}
              value={retainCount}
              onChange={(e) => setRetainCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              disabled={cleanupMutation.isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              The currently active published snapshot is always preserved. Older building or superseded
              snapshots exceeding this retention count will be safely pruned from database, Neo4j, and Qdrant.
            </p>
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cleanupMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="cleanup-snapshots-form"
            variant="destructive"
            disabled={cleanupMutation.isPending}
            className="gap-2"
          >
            {cleanupMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cleaning up...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Run Cleanup
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
