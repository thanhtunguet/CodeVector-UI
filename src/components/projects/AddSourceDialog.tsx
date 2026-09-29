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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreateSource } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, FolderGit2, Loader2, Plus } from "lucide-react";

interface AddSourceDialogProps {
  projectCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddSourceDialog({
  projectCode,
  open,
  onOpenChange,
  onSuccess,
}: AddSourceDialogProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"repository" | "documentation">("repository");
  const [path, setPath] = useState("");
  const [touched, setTouched] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { toast } = useToast();
  const createSourceMutation = useCreateSource();

  const resetForm = () => {
    setName("");
    setKind("repository");
    setPath("");
    setTouched(false);
    setApiError(null);
  };

  const nameError = touched && !name.trim() ? "Source name is required" : null;
  const pathError = touched && !path.trim() ? "Directory path is required" : null;
  const isSubmitDisabled = !name.trim() || !path.trim() || createSourceMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !path.trim()) return;

    try {
      setApiError(null);
      await createSourceMutation.mutateAsync({
        code: projectCode,
        input: {
          name: name.trim(),
          kind,
          locator: {
            type: "local_directory",
            path: path.trim(),
          },
        },
      });

      toast({
        title: "Source added",
        description: `Source "${name.trim()}" registered successfully for project "${projectCode}".`,
      });

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register source";
      setApiError(msg);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Add Data Source</DialogTitle>
              <DialogDescription className="text-xs">
                Register a code directory or documentation folder to be indexed.
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

        <form id="add-source-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Source Name */}
          <div className="space-y-1.5">
            <Label htmlFor="source-name" className="text-xs font-medium">
              Source Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source-name"
              placeholder="e.g., backend-core or api-docs"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (apiError) setApiError(null);
              }}
              maxLength={128}
              disabled={createSourceMutation.isPending}
            />
            {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
          </div>

          {/* Kind */}
          <div className="space-y-1.5">
            <Label htmlFor="source-kind" className="text-xs font-medium">
              Source Kind
            </Label>
            <Select
              value={kind}
              onValueChange={(val: "repository" | "documentation") => setKind(val)}
              disabled={createSourceMutation.isPending}
            >
              <SelectTrigger id="source-kind">
                <SelectValue placeholder="Select source kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="repository">Repository (Source Code)</SelectItem>
                <SelectItem value="documentation">Documentation (Markdown / Specs)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Local Directory Path */}
          <div className="space-y-1.5">
            <Label htmlFor="source-path" className="text-xs font-medium">
              Local Directory Path <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source-path"
              placeholder="/absolute/path/to/directory or relative/path"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                if (apiError) setApiError(null);
              }}
              maxLength={4096}
              disabled={createSourceMutation.isPending}
            />
            {pathError ? (
              <p className="text-[11px] text-destructive">{pathError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Path to files on the host machine where CodeVector engine runs.
              </p>
            )}
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createSourceMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-source-form"
            disabled={isSubmitDisabled}
            className="gap-2"
          >
            {createSourceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding Source...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Source
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
