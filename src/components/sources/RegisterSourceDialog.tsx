import React, { useState, useEffect } from "react";
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
import { AlertCircle, FolderGit2, BookOpen, Loader2, Plus, Layers } from "lucide-react";
import type { Project } from "@/services/api";

interface RegisterSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProjectCode: string;
  projects?: Project[];
  onProjectChange?: (code: string) => void;
  onSuccess?: () => void;
}

export function RegisterSourceDialog({
  open,
  onOpenChange,
  selectedProjectCode,
  projects = [],
  onProjectChange,
  onSuccess,
}: RegisterSourceDialogProps) {
  const [projectCode, setProjectCode] = useState(selectedProjectCode);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"repository" | "documentation">("repository");
  const [path, setPath] = useState("");
  const [touched, setTouched] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { toast } = useToast();
  const createSourceMutation = useCreateSource();

  // Sync internal projectCode when prop changes
  useEffect(() => {
    if (selectedProjectCode) {
      setProjectCode(selectedProjectCode);
    }
  }, [selectedProjectCode]);

  const resetForm = () => {
    setName("");
    setKind("repository");
    setPath("");
    setTouched(false);
    setApiError(null);
  };

  const nameError = touched && !name.trim() ? "Source name is required" : null;
  const pathError = touched && !path.trim() ? "Local directory path is required" : null;
  const projectError = touched && !projectCode ? "Please select a target project" : null;

  const isSubmitDisabled =
    !projectCode ||
    !name.trim() ||
    !path.trim() ||
    createSourceMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!projectCode || !name.trim() || !path.trim()) return;

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
        title: "Source registered",
        description: `Source "${name.trim()}" registered successfully for project "${projectCode}".`,
      });

      // If user selected a different project in the dialog, propagate back
      if (projectCode !== selectedProjectCode && onProjectChange) {
        onProjectChange(projectCode);
      }

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Register Data Source</DialogTitle>
              <DialogDescription className="text-xs">
                Connect a local codebase or documentation folder for code intelligence analysis.
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

        <form id="register-source-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Target Project */}
          {projects.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="source-project" className="text-xs font-medium">
                Target Project <span className="text-destructive">*</span>
              </Label>
              <Select
                value={projectCode}
                onValueChange={(val) => {
                  setProjectCode(val);
                  if (apiError) setApiError(null);
                }}
                disabled={createSourceMutation.isPending}
              >
                <SelectTrigger id="source-project" className="text-xs">
                  <SelectValue placeholder="Select target project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.code} value={p.code} className="text-xs">
                      <span className="font-medium">{p.name}</span>{" "}
                      <span className="font-mono text-muted-foreground ml-1">({p.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projectError && <p className="text-[11px] text-destructive">{projectError}</p>}
            </div>
          )}

          {/* Source Name */}
          <div className="space-y-1.5">
            <Label htmlFor="source-name" className="text-xs font-medium">
              Source Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source-name"
              placeholder="e.g., backend-core, client-web, or api-docs"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (apiError) setApiError(null);
              }}
              maxLength={128}
              className="text-xs"
              disabled={createSourceMutation.isPending}
            />
            {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
          </div>

          {/* Kind */}
          <div className="space-y-1.5">
            <Label htmlFor="source-kind" className="text-xs font-medium">
              Source Kind <span className="text-destructive">*</span>
            </Label>
            <Select
              value={kind}
              onValueChange={(val: "repository" | "documentation") => setKind(val)}
              disabled={createSourceMutation.isPending}
            >
              <SelectTrigger id="source-kind" className="text-xs">
                <SelectValue placeholder="Select source kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="repository" className="text-xs">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-4 w-4 text-primary" />
                    <div>
                      <span className="font-medium">Repository</span>
                      <span className="text-muted-foreground ml-1.5">
                        (TypeScript, Python, Go source code)
                      </span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="documentation" className="text-xs">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-500" />
                    <div>
                      <span className="font-medium">Documentation</span>
                      <span className="text-muted-foreground ml-1.5">
                        (Markdown files, guides, API specs)
                      </span>
                    </div>
                  </div>
                </SelectItem>
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
              className="font-mono text-xs"
              disabled={createSourceMutation.isPending}
            />
            {pathError ? (
              <p className="text-[11px] text-destructive">{pathError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Filesystem directory on the host where the CodeVector engine service is running.
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
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="register-source-form"
            disabled={isSubmitDisabled}
            className="gap-2 text-xs"
          >
            {createSourceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Register Source
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
