export type ProjectScheduleVisibility = "calendar" | "workspace";

/**
 * Archived projects stay available only through retained workspace flows.
 * Calendar visibility remains the default for schedule-related data access.
 */
export function includesArchivedProjects(
  visibility: ProjectScheduleVisibility = "calendar",
) {
  return visibility === "workspace";
}
