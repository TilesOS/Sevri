"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/pitch-kit", label: "Pitch Kit" },
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
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-muted">Project</p>
          <p className="mt-2 text-base font-semibold leading-6 text-ink">{projectTitle}</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="space-y-2">
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
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-muted">Milestones</span>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        <div className="space-y-2">
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
      </div>
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
    "flex items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-sm transition",
    isActive
      ? "border-line-strong bg-paper text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
      : "border-transparent bg-transparent text-ink-soft hover:border-line hover:bg-paper/76 hover:text-ink",
    isDisabled && "cursor-not-allowed opacity-50 hover:border-transparent hover:bg-transparent hover:text-ink-soft",
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
      className={cn(
        "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
        status === "complete" && "bg-emerald-500",
        status === "in_progress" && "bg-amber-500",
        status === "not_started" && "bg-line-strong",
      )}
      aria-label={status.replace("_", " ")}
      title={status.replace("_", " ")}
    />
  );
}
