import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { hasStepGuidanceAccess, reviewerLimit } from "@/lib/usage/limits";
import type { Plan } from "@/types/domain";

export type RestrictedFeature = "step_guidance" | "invite_reviewer";

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
    case "step_guidance":
      return {
        code: "upgrade_required",
        feature,
        error: "Upgrade to Pro to unlock detailed step coaching and work evaluation.",
        upgrade_url: "/billing",
      };
    case "invite_reviewer":
      return {
        code: "upgrade_required",
        feature,
        error: "Upgrade to Pro to invite reviewers to your projects.",
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
    case "step_guidance":
      if (hasStepGuidanceAccess(plan)) {
        return { allowed: true, plan };
      }
      return { allowed: false, plan, error: buildUpgradeRequiredError(input.feature) };
    case "invite_reviewer":
      if (reviewerLimit(plan) > 0) {
        return { allowed: true, plan };
      }
      return { allowed: false, plan, error: buildUpgradeRequiredError(input.feature) };
  }
}

export function createUpgradeRequiredResponse(error: UpgradeRequiredError) {
  return NextResponse.json(error, { status: 403 });
}
