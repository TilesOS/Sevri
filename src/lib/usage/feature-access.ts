import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { hasRoadmapDetailAccess } from "@/lib/usage/limits";
import type { Plan } from "@/types/domain";

export type RestrictedFeature = "full_roadmap";

export interface UpgradeRequiredError {
  code: "upgrade_required";
  feature: RestrictedFeature;
  error: string;
  upgrade_url: string;
}

export type FeatureAccessResult =
  | { allowed: true; plan: Plan }
  | { allowed: false; plan: Plan; error: UpgradeRequiredError };

function buildUpgradeRequiredError(feature: RestrictedFeature): UpgradeRequiredError {
  switch (feature) {
    case "full_roadmap":
      return {
        code: "upgrade_required",
        feature,
        error: "Upgrade to Pro to unlock milestone guidance and evaluation across your roadmap.",
        upgrade_url: "/billing",
      };
  }
}

export async function assertFeatureAccess(input: {
  userId: string;
  feature: RestrictedFeature;
}): Promise<FeatureAccessResult> {
  const plan = await getUserPlan(input.userId);

  switch (input.feature) {
    case "full_roadmap":
      if (hasRoadmapDetailAccess(plan)) {
        return { allowed: true, plan };
      }

      return {
        allowed: false,
        plan,
        error: buildUpgradeRequiredError(input.feature),
      };
  }
}

export function createUpgradeRequiredResponse(error: UpgradeRequiredError) {
  return NextResponse.json(error, { status: 403 });
}
