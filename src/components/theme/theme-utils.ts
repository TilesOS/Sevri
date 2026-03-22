import type { Plan, ProjectTrack } from "@/types/domain";

export const themeScript = `(() => {
  const root = document.documentElement;
  root.dataset.theme = "editorial-light";
  root.classList.remove("dark");
})();`;

export const trackThemes: Record<
  ProjectTrack,
  {
    badgeTone: "software" | "research";
    accentSurfaceClassName: string;
    borderClassName: string;
    label: string;
  }
> = {
  software: {
    badgeTone: "software",
    accentSurfaceClassName: "bg-secondary-amber-soft",
    borderClassName: "border-secondary-amber-line",
    label: "Software",
  },
  research: {
    badgeTone: "research",
    accentSurfaceClassName: "bg-paper",
    borderClassName: "border-line",
    label: "Research",
  },
};

export function getPlanLabel(plan: Plan) {
  return plan === "pro_monthly" ? "Pro" : "Free";
}

export function getTrackLabel(track: ProjectTrack) {
  return trackThemes[track].label;
}
