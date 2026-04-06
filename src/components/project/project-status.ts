import type { ProjectStepStatus } from "@/lib/projects/workspace";

export const roadmapStatusClassName: Record<ProjectStepStatus, string> = {
  complete: "bg-primary",
  in_progress: "bg-primary-active",
  not_started: "bg-line-strong",
};
