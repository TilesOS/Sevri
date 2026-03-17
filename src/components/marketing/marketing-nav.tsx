import { getAuthenticatedUser } from "@/lib/auth/guard";
import { MarketingNavClient } from "@/components/marketing/marketing-nav-client";

export async function MarketingNav() {
  const user = await getAuthenticatedUser();
  return <MarketingNavClient isAuthenticated={Boolean(user)} />;
}
