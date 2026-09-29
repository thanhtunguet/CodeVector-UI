import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUpdateProject } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  AlertCircle,
  Check,
  Copy,
  FolderGit2,
  Calendar,
  KeyRound,
  Loader2,
  Save,
} from "lucide-react";
import type { Project } from "@/services/api";

interface EditProjectSheetProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updated: Project) => void;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "PPpp");
  } catch {
    return dateStr;
  }
}

export function EditProjectSheet({
  project,
  open,
  onOpenChange,
  onSuccess,
}: EditProjectSheetProps) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const { toast } = useToast();
  const updateMutation = useUpdateProject();

  useEffect(() => {
    if (project) {
      setName(project.name);
      setTouched(false);
      setApiError(null);
    }
  }, [project, open]);

  const handleCopyCode = () => {
    if (!project?.code) return;
    navigator.clipboard.writeText(project.code);
    setCopiedCode(true);
    toast({
      description: `Project code "${project.code}" copied to clipboard.`,
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const nameError = (() => {
    if (!touched) return null;
    const trimmed = name.trim();
    if (!trimmed) return "Project name cannot be empty";
    if (trimmed.length > 200) return "Project name must not exceed 200 characters";
    return null;
  })();

  const isUnchanged = project ? name.trim() === project.name.trim() : true;
  const isSubmitDisabled = !name.trim() || isUnchanged || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 200 || !project) return;

    try {
      setApiError(null);
      const updated = await updateMutation.mutateAsync({
        code: project.code,
        name: trimmed,
      });

      toast({
        title: "Project updated",
        description: `Project "${updated.name}" has been updated successfully.`,
      });

      onSuccess?.(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update project";
      setApiError(msg);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col justify-between overflow-y-auto">
        <div>
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FolderGit2 className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">Project Information</SheetTitle>
                <SheetDescription className="text-xs">
                  View metadata and update project details
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {apiError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{apiError}</AlertDescription>
            </Alert>
          )}

          <form id="edit-project-form" onSubmit={handleSubmit} className="space-y-5 py-5">
            {/* Project Code (Read-Only) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Project Code (Unique Identifier)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={project?.code ?? ""}
                  readOnly
                  disabled
                  className="bg-muted/60 font-mono text-xs cursor-default select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleCopyCode}
                  title="Copy project code"
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The identifier is immutable and used for all API scopes and MCP queries.
              </p>
            </div>

            {/* Project Name (Editable) */}
            <div className="space-y-1.5">
              <Label htmlFor="project-name" className="text-xs font-medium">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!touched) setTouched(true);
                  if (apiError) setApiError(null);
                }}
                onBlur={() => setTouched(true)}
                placeholder="e.g., Core Engine Workspace"
                className={nameError ? "border-destructive focus-visible:ring-destructive" : ""}
                maxLength={200}
                disabled={updateMutation.isPending}
              />
              <div className="flex justify-between items-center text-[11px]">
                {nameError ? (
                  <span className="text-destructive">{nameError}</span>
                ) : (
                  <span className="text-muted-foreground">Between 1 and 200 characters</span>
                )}
                <span className="text-muted-foreground tabular-nums">
                  {name.length}/200
                </span>
              </div>
            </div>

            {/* Created At (Read-Only) */}
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Created At
              </Label>
              <div className="text-xs text-foreground bg-muted/30 px-3 py-2 rounded-md border border-border/50">
                {formatDate(project?.createdAt)}
              </div>
            </div>
          </form>
        </div>

        <SheetFooter className="pt-4 border-t gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-project-form"
            disabled={isSubmitDisabled}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
