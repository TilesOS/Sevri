import type { ProjectStepStatus } from "@/lib/projects/workspace";

export const roadmapStatusClassName: Record<ProjectStepStatus, string> = {
  complete: "bg-accent-green",
  in_progress: "bg-accent-green-soft",
  not_started: "bg-line-strong",
};
