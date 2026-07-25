import type { Metadata } from "next";
import { getAuthenticatedUser } from "@/lib/auth/guard";
import { WORKSPACE_LABELS } from "@/lib/copy/glossary";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";

/**
 * The project's own title, or null when it can't be read — signed out, deleted,
 * or owned by someone else. `generateMetadata` must never redirect or throw the
 * page away, so every failure here is just a missing title.
 *
 * `getProjectWorkspaceView` is request-cached, so calling it here and again in
 * the page body costs one round of queries, not two.
 */
async function getProjectTitle(projectId: string): Promise<string | null> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return null;
    }

    const workspace = await getProjectWorkspaceView(projectId, user.id);
    const title = workspace.project.title;

    return typeof title === "string" && title.trim().length > 0 ? title.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Titles for project routes: "Step 4 · Photonics benchmark" for a section,
 * the project name alone for the overview. The root layout appends " — Sevri".
 */
export async function buildProjectMetadata(projectId: string, section?: string): Promise<Metadata> {
  const projectTitle = await getProjectTitle(projectId);

  if (!section) {
    return { title: projectTitle ?? WORKSPACE_LABELS.projectWorkspace };
  }

  return { title: projectTitle ? `${section} · ${projectTitle}` : section };
}
