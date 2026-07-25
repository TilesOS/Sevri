import { getAuthenticatedUser } from "@/lib/auth/guard";
import { getUserPlan } from "@/lib/db/queries/subscriptions";

export interface MarketingViewer {
  isAuthenticated: boolean;
  isPro: boolean;
}

const ANONYMOUS: MarketingViewer = { isAuthenticated: false, isPro: false };

/**
 * What the public pages need to know about whoever is reading them, so their
 * calls to action match reality: a signed-in Pro subscriber should not be told
 * to "Create account" or offered an upgrade they already bought.
 *
 * Never throws. A failure to read the plan degrades to "signed in, not Pro",
 * which shows an upgrade path rather than hiding the workspace.
 */
export async function getMarketingViewer(): Promise<MarketingViewer> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return ANONYMOUS;
    }

    const plan = await getUserPlan(user.id).catch(() => "free" as const);

    return { isAuthenticated: true, isPro: plan === "pro_monthly" };
  } catch {
    return ANONYMOUS;
  }
}
