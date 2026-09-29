import { useSearchParams } from "react-router-dom";
import { useProjects } from "./useProjects";
import type { Project } from "@/services/api";

export interface ProjectSelectionResult {
  projects: Project[];
  selectedCode: string;
  selectedProject: Project | null;
  setSelectedCode: (code: string) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useProjectSelection(): ProjectSelectionResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projects = [], isLoading, isError, error, refetch } = useProjects();

  const queryCode = searchParams.get("project");

  // If query parameter matches an existing project, pick it.
  // Otherwise fallback to the first project in the list if available.
  const hasMatchedProject = Boolean(
    queryCode && projects.some((p) => p.code === queryCode)
  );

  const selectedCode = hasMatchedProject
    ? queryCode!
    : projects.length > 0
    ? projects[0].code
    : "";

  const selectedProject =
    projects.find((p) => p.code === selectedCode) ?? null;

  const setSelectedCode = (code: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (code) {
          next.set("project", code);
        } else {
          next.delete("project");
        }
        return next;
      },
      { replace: true }
    );
  };

  return {
    projects,
    selectedCode,
    selectedProject,
    setSelectedCode,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
