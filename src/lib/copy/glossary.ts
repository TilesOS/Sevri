/**
 * One name per concept.
 *
 * The sidebar, the breadcrumb trail, page headings, and `<title>` used to each
 * pick their own wording for the same thing — "Presentation" vs "Pitch kit",
 * "Scope" vs "Scope & Guardrails", or different names for the project lens. Every
 * surface now reads its label from here, so a rename lands everywhere at once.
 */

/** Sections inside a single project's workspace. */
export const PROJECT_SECTION_LABELS = {
  overview: "Overview",
  scope: "Scope & Guardrails",
  lens: "Project Lens",
  pitchKit: "Pitch Kit",
  resources: "Learning Resources",
  focus: "Focus",
} as const;

export type ProjectSectionKey = keyof typeof PROJECT_SECTION_LABELS;

/** Top-level workspace destinations. */
export const WORKSPACE_LABELS = {
  dashboard: "Dashboard",
  ideas: "Project ideas",
  calendar: "Calendar",
  portfolio: "Portfolio",
  settings: "Settings",
  billing: "Billing",
  integrations: "Integrations",
  onboarding: "Onboarding",
  projectWorkspace: "Project workspace",
} as const;

/** The sidebar's primary action. It starts a new project, so it says that. */
export const NEW_PROJECT_CTA = "New project";

/** Roadmap items are "steps" everywhere a student can read them. */
export function stepLabel(stepNumber: number | string) {
  return `Step ${stepNumber}`;
}

/**
 * The collapse label for a disclosure whose expand label is an instruction:
 * "Show step detail" → "Hide step detail". A toggle that keeps saying "Show"
 * while the content is already showing describes the wrong state.
 *
 * Returns the label unchanged when it isn't phrased as an instruction.
 */
export function collapseLabel(expandLabel: string) {
  const match = expandLabel.match(/^(?:Show|View|Open|Expand)\s+(.+)$/);
  return match ? `Hide ${match[1]}` : expandLabel;
}

/**
 * The canonical project path. Focus mode used to live under `/projects/...`
 * while every other section lived under `/project/...`; `next.config.ts`
 * redirects the old prefix here.
 */
export function projectPath(projectId: string, section?: string) {
  return section ? `/project/${projectId}/${section}` : `/project/${projectId}`;
}
