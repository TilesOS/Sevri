import type { Plan } from "@/types/domain";

export const themeScript = `(() => {
  const root = document.documentElement;
  root.dataset.theme = "editorial-light";
  root.classList.remove("dark");
})();`;

export function getPlanLabel(plan: Plan) {
  return plan === "pro_monthly" ? "Pro" : "Free";
}
