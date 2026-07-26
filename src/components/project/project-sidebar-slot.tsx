"use client";

import Link from "next/link";
import { ProjectSidebarNavigation } from "@/components/project/project-sidebar-navigation";
import { useProjectNav } from "@/components/project/project-nav-context";

export function ProjectSidebarSlot() {
  const state = useProjectNav();

  if (state.status === "idle") {
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

  // A missing project is permanent. The old copy here ("Refresh the page to try
  // again.") sent students in a loop on a project that no longer exists.
  if (state.status === "missing") {
    return (
      <div className="space-y-2 px-2 text-sm text-ink-soft">
        <p className="font-medium text-ink">This project isn&apos;t here.</p>
        <p>It may have been deleted, or the link points somewhere else.</p>
        <Link href="/dashboard" className="inline-block font-semibold text-ink hover:underline">
          Back to all projects
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-2 px-2 text-sm text-ink-soft">
        <p className="font-medium text-ink">We couldn&apos;t load this project&apos;s steps.</p>
        <p>Your work is saved. Refresh to try again — the page itself still works.</p>
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
