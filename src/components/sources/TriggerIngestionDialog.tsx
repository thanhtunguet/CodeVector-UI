import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTriggerIngest } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Loader2,
  AlertCircle,
  Sparkles,
  GitBranch,
  Database,
  Layers,
  CheckCircle2,
} from "lucide-react";

interface TriggerIngestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCode: string;
  projectName?: string;
  onSuccess?: () => void;
}

export function TriggerIngestionDialog({
  open,
  onOpenChange,
  projectCode,
  projectName,
  onSuccess,
}: TriggerIngestionDialogProps) {
  const [requireSemantic, setRequireSemantic] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { toast } = useToast();
  const triggerIngestMutation = useTriggerIngest();

  const handleTrigger = async () => {
    if (!projectCode) return;

    try {
      setApiError(null);
      await triggerIngestMutation.mutateAsync({
        code: projectCode,
        requireSemantic,
      });

      toast({
        title: "Ingestion Queued",
        description: `Ingestion job started for project "${projectCode}". Knowledge graph and snapshot are being constructed.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to trigger ingestion";
      setApiError(msg);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setApiError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Trigger Ingestion Run</DialogTitle>
              <DialogDescription className="text-xs">
                Start code intelligence analysis for{" "}
                <span className="font-semibold text-foreground">
                  {projectName ? `${projectName} (${projectCode})` : projectCode}
                </span>
                .
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

        <div className="space-y-4 py-2">
          {/* Ingestion Steps Explanation */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              What happens during ingestion:
            </h4>
            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  1
                </div>
                <span>
                  <strong className="text-foreground">Source Inventory:</strong> Discovers files and checks Git metadata across all registered directories.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  2
                </div>
                <span>
                  <strong className="text-foreground">AST Analysis:</strong> Polyglot parser extracts functions, classes, interfaces, calls, and references.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  3
                </div>
                <span>
                  <strong className="text-foreground">Knowledge Graph:</strong> Cross-links dependencies and call hierarchies into Neo4j graph store.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  4
                </div>
                <span>
                  <strong className="text-foreground">Vector Embeddings:</strong> Chunks code & doc tokens and indexes them into Qdrant vector store.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  5
                </div>
                <span>
                  <strong className="text-foreground">Snapshot Release:</strong> Atomically transitions new immutable snapshot to published state.
                </span>
              </div>
            </div>
          </div>

          {/* Semantic Requirement Switch */}
          <div className="flex items-center justify-between space-x-3 rounded-lg border p-3 bg-card">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label htmlFor="require-semantic" className="text-xs font-medium cursor-pointer">
                  Require Semantic Indexing
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                If enabled, the run fails if embedding generation fails. If disabled, the run gracefully completes with structural indexing.
              </p>
            </div>
            <Switch
              id="require-semantic"
              checked={requireSemantic}
              onCheckedChange={setRequireSemantic}
              disabled={triggerIngestMutation.isPending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={triggerIngestMutation.isPending}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleTrigger}
            disabled={triggerIngestMutation.isPending || !projectCode}
            className="gap-2 text-xs"
          >
            {triggerIngestMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Triggering Ingestion...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Ingestion
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
