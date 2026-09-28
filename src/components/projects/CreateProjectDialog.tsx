import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCreateProject } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import type { Project } from "@/services/api";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (project: Project) => void;
}

const CODE_REGEX = /^[A-Za-z0-9._-]+$/;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);
  const [touched, setTouched] = useState<{ name?: boolean; code?: boolean }>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const { toast } = useToast();
  const createProjectMutation = useCreateProject();

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setName("");
      setCode("");
      setIsCodeManuallyEdited(false);
      setTouched({});
      setApiError(null);
    }
  }, [open]);

  // Validation logic
  const getNameError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Project name is required";
    if (trimmed.length > 200) return "Project name must not exceed 200 characters";
    return null;
  };

  const getCodeError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Project code is required";
    if (trimmed.length > 64) return "Project code must not exceed 64 characters";
    if (!CODE_REGEX.test(trimmed)) {
      return "Code can only contain letters, numbers, hyphens (-), underscores (_), and periods (.)";
    }
    return null;
  };

  const nameError = touched.name ? getNameError(name) : null;
  const codeError = touched.code ? getCodeError(code) : null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    setApiError(null);
    setTouched((prev) => ({ ...prev, name: true }));

    if (!isCodeManuallyEdited) {
      const generatedCode = slugify(newName);
      setCode(generatedCode);
      if (generatedCode) {
        setTouched((prev) => ({ ...prev, code: true }));
      }
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCodeManuallyEdited(true);
    setCode(e.target.value);
    setApiError(null);
    setTouched((prev) => ({ ...prev, code: true }));
  };

  const handleResetToAutoSlug = () => {
    setIsCodeManuallyEdited(false);
    const generated = slugify(name);
    setCode(generated);
    setTouched((prev) => ({ ...prev, code: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, code: true });

    const nErr = getNameError(name);
    const cErr = getCodeError(code);

    if (nErr || cErr) {
      return;
    }

    setApiError(null);

    try {
      const createdProject = await createProjectMutation.mutateAsync({
        name: name.trim(),
        code: code.trim(),
      });

      toast({
        title: "Project Created",
        description: `Project "${createdProject.name}" (${createdProject.code}) has been created successfully.`,
      });

      onSuccess?.(createdProject);
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create project";

      if (
        errorMessage.includes("409") ||
        errorMessage.toLowerCase().includes("conflict") ||
        errorMessage.toLowerCase().includes("already exists")
      ) {
        setApiError(
          `Project code "${code.trim()}" already exists. Please choose a different code.`
        );
      } else {
        setApiError(errorMessage);
      }
    }
  };

  const isSubmitting = createProjectMutation.isPending;
  const isValid = !getNameError(name) && !getCodeError(code);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Register a project workspace to index source files, trace execution flows, and run semantic queries.
            </DialogDescription>
          </DialogHeader>

          {apiError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">Error</AlertTitle>
              <AlertDescription className="text-xs">{apiError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Project Name */}
            <div className="space-y-1.5">
              <Label htmlFor="project-name" className="text-xs font-medium">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-name"
                placeholder="e.g. My Awesome Service"
                value={name}
                onChange={handleNameChange}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                disabled={isSubmitting}
                aria-invalid={Boolean(nameError)}
                className={`h-9 text-sm ${nameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                autoFocus
              />
              {nameError ? (
                <p className="text-[11px] text-destructive leading-tight">{nameError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Human-readable display name for this project (up to 200 chars).
                </p>
              )}
            </div>

            {/* Project Code */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="project-code" className="text-xs font-medium">
                  Project Code <span className="text-destructive">*</span>
                </Label>
                {isCodeManuallyEdited && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetToAutoSlug}
                    className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                    title="Re-sync code from name"
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto-slug
                  </Button>
                )}
              </div>
              <Input
                id="project-code"
                placeholder="e.g. my-awesome-service"
                value={code}
                onChange={handleCodeChange}
                onBlur={() => setTouched((prev) => ({ ...prev, code: true }))}
                disabled={isSubmitting}
                aria-invalid={Boolean(codeError)}
                className={`h-9 font-mono text-xs ${codeError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {codeError ? (
                <p className="text-[11px] text-destructive leading-tight">{codeError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Unique identifier used in URLs, APIs, and paths (alphanumeric, hyphens, dots, underscores).
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              className="h-9 text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
