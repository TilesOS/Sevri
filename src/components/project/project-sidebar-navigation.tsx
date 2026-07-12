"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Presentation, Search, ShieldCheck, SquareChartGantt } from "lucide-react";
import { ProjectProgressTracker } from "@/components/project/project-progress-tracker";
import { roadmapStatusClassName } from "@/components/project/project-status";
import { cn } from "@/lib/utils";
import type { ProjectProgressSummary } from "@/lib/projects/progress";
import type { ProjectMilestoneView } from "@/lib/projects/workspace";

interface ProjectSidebarNavigationProps {
  projectId: string;
  projectTitle: string;
  hasRoadmap: boolean;
  progress: ProjectProgressSummary;
  milestones: ProjectMilestoneView[];
}

const baseSectionLinks = [
  { href: "", label: "Overview", icon: SquareChartGantt },
  { href: "/scope", label: "Scope & Guardrails", icon: ShieldCheck },
  { href: "/research-lens", label: "Research Lens", icon: Search },
  { href: "/pitch-kit", label: "Presentation", icon: Presentation },
] as const;

export function ProjectSidebarNavigation({
  projectId,
  projectTitle,
  hasRoadmap,
  progress,
  milestones,
}: ProjectSidebarNavigationProps) {
  const pathname = usePathname();
  const projectBasePath = `/project/${projectId}`;

  return (
    <div className="space-y-1">
      <div className="mb-3 px-2">
        <p className="truncate text-sm font-medium text-ink" title={projectTitle}>{projectTitle}</p>
        <Link
          href="/dashboard"
          className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>All projects</span>
        </Link>
      </div>

      <div className="mb-3 rounded-lg border border-line bg-paper p-3">
        <p className="mb-2 text-xs font-medium text-ink">{progress.stageLabel}</p>
        <ProjectProgressTracker progress={progress} compact />
      </div>

      {baseSectionLinks.map((link) => {
        const href = `${projectBasePath}${link.href}`;
        const isActive = pathname === href;
        const isDisabled = !hasRoadmap && link.href !== "";

        return (
          <ProjectNavLink
            key={href}
            href={href}
            label={link.label}
            isActive={isActive}
            isDisabled={isDisabled}
            icon={link.icon}
          />
        );
      })}

      <p className="px-2 pb-1 pt-4 text-[11px] font-medium text-ink-muted">Steps</p>

      {milestones.map((milestone) => {
        const href = `${projectBasePath}/steps/${milestone.stepNumber}`;
        const isActive = pathname === href;
        const isDisabled = !hasRoadmap;

        return (
          <ProjectNavLink
            key={milestone.id}
            href={href}
            label={`Step ${milestone.stepNumber}`}
            isActive={isActive}
            isDisabled={isDisabled}
            status={milestone.status}
            isFuture={milestone.isFuture}
          />
        );
      })}
    </div>
  );
}

function ProjectNavLink({
  href,
  label,
  description,
  isActive,
  isDisabled,
  status,
  isFuture = false,
  icon: Icon,
}: {
  href: string;
  label: string;
  description?: string;
  isActive: boolean;
  isDisabled: boolean;
  status?: "complete" | "in_progress" | "not_started";
  isFuture?: boolean;
  icon?: typeof SquareChartGantt;
}) {
  const className = cn(
    "tab flex items-center justify-between gap-3",
    isActive && "is-active",
    isDisabled && "cursor-not-allowed opacity-50",
    isFuture && !isActive && "opacity-70",
  );

  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        <div className="min-w-0">
        <p className="font-medium text-current">{label}</p>
        {description ? <p className="mt-1 truncate text-xs text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {status ? <StatusDot status={status} /> : null}
    </>
  );

  if (isDisabled) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={className} aria-current={isActive ? "page" : undefined}>
      {content}
    </Link>
  );
}

function StatusDot({ status }: { status: "complete" | "in_progress" | "not_started" }) {
  return (
    <span
      className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", roadmapStatusClassName[status])}
      aria-label={status.replace("_", " ")}
      title={status.replace("_", " ")}
    />
  );
}
