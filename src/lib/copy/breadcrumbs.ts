// Relative with an explicit extension so the unit tests can load this module
// directly under `node --experimental-strip-types`, which does not read tsconfig
// path aliases.
import { PROJECT_SECTION_LABELS, WORKSPACE_LABELS, stepLabel } from "./glossary.ts";

export interface Breadcrumb {
  href: string;
  label: string;
  /** Whether the crumb survives at narrow widths. */
  showOnMobile: boolean;
}

/** The project id in a workspace path, or null when the path isn't one. */
export function extractProjectId(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "project" || !segments[1]) {
    return null;
  }

  return segments[1];
}

function getPageLabel(pathname: string) {
  if (pathname.startsWith("/project/")) return WORKSPACE_LABELS.projectWorkspace;
  if (pathname.startsWith("/recommendations")) return WORKSPACE_LABELS.ideas;
  if (pathname.startsWith("/calendar")) return WORKSPACE_LABELS.calendar;
  if (pathname.startsWith("/portfolio")) return WORKSPACE_LABELS.portfolio;
  if (pathname.startsWith("/settings/billing")) return WORKSPACE_LABELS.billing;
  if (pathname.startsWith("/settings/integrations")) return WORKSPACE_LABELS.integrations;
  if (pathname.startsWith("/settings")) return WORKSPACE_LABELS.settings;
  if (pathname.startsWith("/onboarding")) return WORKSPACE_LABELS.onboarding;
  return WORKSPACE_LABELS.dashboard;
}

/** The crumb for a project sub-route, or null for the overview itself. */
function getProjectSectionCrumb(projectId: string, remainder: string) {
  const stepMatch = remainder.match(/^steps\/(\d+)/);
  if (stepMatch) {
    return { href: `/project/${projectId}/steps/${stepMatch[1]}`, label: stepLabel(stepMatch[1]) };
  }

  if (remainder === "scope") {
    return { href: `/project/${projectId}/scope`, label: PROJECT_SECTION_LABELS.scope };
  }

  if (remainder === "lens") {
    return { href: `/project/${projectId}/lens`, label: PROJECT_SECTION_LABELS.lens };
  }

  if (remainder === "pitch-kit") {
    return { href: `/project/${projectId}/pitch-kit`, label: PROJECT_SECTION_LABELS.pitchKit };
  }

  if (remainder === "focus") {
    return { href: `/project/${projectId}/focus`, label: PROJECT_SECTION_LABELS.focus };
  }

  return null;
}

/**
 * The header trail. It always ends with where you are, and on a project route it
 * always names the project — narrow screens drop the leading crumbs, not the
 * trailing ones, because collapsing to "Dashboard" told a student nothing about
 * the step they were reading.
 *
 * `projectTitle` is null until the project nav data arrives.
 */
export function getHeaderBreadcrumbs(pathname: string, projectTitle: string | null): Breadcrumb[] {
  const projectId = extractProjectId(pathname);

  if (projectId) {
    const remainder = pathname.replace(`/project/${projectId}`, "").replace(/^\//, "");
    const section = getProjectSectionCrumb(projectId, remainder);

    return [
      { href: "/dashboard", label: WORKSPACE_LABELS.dashboard, showOnMobile: false },
      {
        href: `/project/${projectId}`,
        // Until the title loads the crumb still says what kind of page this is
        // rather than flashing empty.
        label: projectTitle ?? WORKSPACE_LABELS.projectWorkspace,
        showOnMobile: true,
      },
      ...(section ? [{ ...section, showOnMobile: true }] : []),
    ];
  }

  const pageLabel = getPageLabel(pathname);
  if (pathname === "/dashboard") {
    return [{ href: "/dashboard", label: pageLabel, showOnMobile: true }];
  }

  return [
    { href: "/dashboard", label: WORKSPACE_LABELS.dashboard, showOnMobile: false },
    { href: pathname, label: pageLabel, showOnMobile: true },
  ];
}
