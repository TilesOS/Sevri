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
    iconClassName: string;
    label: string;
  }
> = {
  software: {
    badgeTone: "software",
    accentSurfaceClassName: "bg-surface-mint",
    borderClassName: "border-teal-deep/20",
    iconClassName: "text-teal-deep",
    label: "Software",
  },
  research: {
    badgeTone: "research",
    accentSurfaceClassName: "bg-navy/5",
    borderClassName: "border-navy/20",
    iconClassName: "text-navy",
    label: "Research",
  },
};

export function getPlanLabel(plan: Plan) {
  return plan === "pro_monthly" ? "Pro" : "Free";
}

export function getTrackLabel(track: ProjectTrack) {
  return trackThemes[track].label;
}
