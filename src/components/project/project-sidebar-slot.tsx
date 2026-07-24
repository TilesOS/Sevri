"use client";

import { useEffect, useState } from "react";
import { ProjectSidebarNavigation } from "@/components/project/project-sidebar-navigation";
import type { ProjectProgressSummary } from "@/lib/projects/progress";
import type { ProjectMilestoneView } from "@/lib/projects/workspace";

interface ProjectSidebarPayload {
  projectId: string;
  projectTitle: string;
  hasRoadmap: boolean;
  progress: ProjectProgressSummary;
  milestones: ProjectMilestoneView[];
}

type ProjectSidebarState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; payload: ProjectSidebarPayload }
  | { status: "error" };

function extractProjectId(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if ((segments[0] !== "project" && segments[0] !== "projects") || !segments[1]) {
    return null;
  }

  return segments[1];
}

export function ProjectSidebarSlot({ pathname }: { pathname: string }) {
  const projectId = extractProjectId(pathname);
  const [state, setState] = useState<ProjectSidebarState>({ status: "idle" });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const refreshSidebar = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId || detail.projectId === projectId) {
        setRefreshToken((current) => current + 1);
      }
    };

    window.addEventListener("sevri:project-sidebar-refresh", refreshSidebar);
    return () => window.removeEventListener("sevri:project-sidebar-refresh", refreshSidebar);
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
        if (!response.ok) {
          throw new Error("Failed to load project navigation.");
        }

        const payload = (await response.json()) as ProjectSidebarPayload;
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

  if (!projectId) {
    return null;
  }

  if (state.status === "ready") {
    return (
      <ProjectSidebarNavigation
        projectId={state.payload.projectId}
        projectTitle={state.payload.projectTitle}
        hasRoadmap={state.payload.hasRoadmap}
        progress={state.payload.progress}
        milestones={state.payload.milestones}
      />
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-2 text-sm text-ink-soft">
        <p className="font-medium text-ink">Project navigation is unavailable right now.</p>
        <p>Refresh the page to try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-3 w-16 rounded-full bg-line/80" />
        <div className="h-5 w-32 rounded-full bg-line/70" />
      </div>
      <div className="space-y-2">
        <div className="h-10 rounded-2xl bg-line/55" />
        <div className="h-10 rounded-2xl bg-line/45" />
        <div className="h-10 rounded-2xl bg-line/45" />
      </div>
      <div className="space-y-2 border-t border-line pt-3">
        <div className="h-3 w-20 rounded-full bg-line/70" />
        <div className="h-10 rounded-2xl bg-line/45" />
        <div className="h-10 rounded-2xl bg-line/45" />
      </div>
    </div>
  );
}
