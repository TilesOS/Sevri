"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { roadmapStatusClassName } from "@/components/project/project-status";
import { cn } from "@/lib/utils";
import type { ProjectMilestoneView } from "@/lib/projects/workspace";

interface ProjectSidebarNavigationProps {
  projectId: string;
  projectTitle: string;
  hasRoadmap: boolean;
  milestones: ProjectMilestoneView[];
}

const baseSectionLinks = [
  { href: "", label: "Overview" },
  { href: "/scope", label: "Scope & Guardrails" },
  { href: "/research-lens", label: "Research Lens" },
  { href: "/pitch-kit", label: "Presentation" },
] as const;

export function ProjectSidebarNavigation({
  projectId,
  projectTitle,
  hasRoadmap,
  milestones,
}: ProjectSidebarNavigationProps) {
  const pathname = usePathname();
  const projectBasePath = `/project/${projectId}`;

  return (
    <div className="space-y-2">
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 2 }}>{projectTitle}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back to Dashboard</span>
        </Link>
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
          />
        );
      })}

      <div style={{ marginTop: 8, marginBottom: 4 }}>
        <div className="hand-label" style={{ margin: '12px 0 4px', fontSize: 13 }}>~ steps ~ <span className="dashes" /></div>
      </div>

      {milestones.map((milestone) => {
        const href = `${projectBasePath}/steps/${milestone.stepNumber}`;
        const isActive = pathname === href;
        const isDisabled = !hasRoadmap;

        return (
          <ProjectNavLink
            key={milestone.id}
            href={href}
            label={`Step ${milestone.stepNumber}`}
            description={milestone.title}
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
}: {
  href: string;
  label: string;
  description?: string;
  isActive: boolean;
  isDisabled: boolean;
  status?: "complete" | "in_progress" | "not_started";
  isFuture?: boolean;
}) {
  const className = cn(
    "tab flex items-start justify-between gap-3 text-sm",
    isActive && "is-active",
    isDisabled && "cursor-not-allowed opacity-50",
    isFuture && !isActive && "opacity-70",
  );

  const content = (
    <>
      <div className="min-w-0">
        <p className="font-medium text-current">{label}</p>
        {description ? <p className="mt-1 truncate text-xs text-ink-muted">{description}</p> : null}
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
