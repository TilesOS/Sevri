"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { extractProjectId } from "@/lib/copy/breadcrumbs";
import type { ProjectProgressSummary } from "@/lib/projects/progress";
import type { ProjectMilestoneView } from "@/lib/projects/workspace";

export interface ProjectNavPayload {
  projectId: string;
  projectTitle: string;
  hasRoadmap: boolean;
  progress: ProjectProgressSummary;
  milestones: ProjectMilestoneView[];
}

export type ProjectNavState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; payload: ProjectNavPayload }
  /** The id isn't a project this user has. Permanent, so it reads as not-found. */
  | { status: "missing" }
  /** Something transient went wrong. Retrying is the right advice here. */
  | { status: "error" };

const ProjectNavContext = createContext<ProjectNavState>({ status: "idle" });

export function useProjectNav() {
  return useContext(ProjectNavContext);
}

/**
 * Loads the current project's nav data once per project and shares it. The
 * sidebar and the header breadcrumb both need the project title; fetching it in
 * one place is what lets the mobile breadcrumb name the project instead of
 * collapsing to "Dashboard".
 */
export function ProjectNavProvider({ pathname, children }: { pathname: string; children: ReactNode }) {
  const projectId = extractProjectId(pathname);
  const [state, setState] = useState<ProjectNavState>({ status: "idle" });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const refreshNav = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId || detail.projectId === projectId) {
        setRefreshToken((current) => current + 1);
      }
    };

    window.addEventListener("sevri:project-sidebar-refresh", refreshNav);
    return () => window.removeEventListener("sevri:project-sidebar-refresh", refreshNav);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();

    setState((current) => {
      if (current.status === "ready" && current.payload.projectId === projectId) {
        return current;
      }

      return { status: "loading" };
    });

    void fetch(`/api/projects/${projectId}/sidebar`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        // A 404 is a fact about the project, not a glitch: telling someone to
        // refresh a project that does not exist sends them in a loop.
        if (response.status === 404) {
          setState({ status: "missing" });
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load project navigation (${response.status}).`);
        }

        const payload = (await response.json()) as ProjectNavPayload;
        setState({ status: "ready", payload });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, [projectId, refreshToken]);

  return <ProjectNavContext.Provider value={state}>{children}</ProjectNavContext.Provider>;
}
