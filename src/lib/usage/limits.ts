import type { Plan } from "@/types/domain";

export const PLAN_LIMITS = {
  free: {
    recommendation_batches: 2,
    full_roadmap: false,
    readme_export: false,
    portfolio_packaging: false,
  },
  pro_monthly: {
    recommendation_batches: 20,
    full_roadmap: true,
    readme_export: true,
    portfolio_packaging: true,
  },
} as const;

export function canGenerateRecommendations(plan: Plan, batchesUsed: number) {
  return batchesUsed < PLAN_LIMITS[plan].recommendation_batches;
}

export function hasRoadmapDetailAccess(plan: Plan) {
  return PLAN_LIMITS[plan].full_roadmap;
}

export function hasReadmeExportAccess(plan: Plan) {
  return PLAN_LIMITS[plan].readme_export;
}

export function hasPortfolioPackagingAccess(plan: Plan) {
  return PLAN_LIMITS[plan].portfolio_packaging;
}
