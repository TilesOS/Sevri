import { getRequiredUser } from "@/lib/auth/guard";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getLatestOnboardingAnswers } from "@/lib/db/queries/onboarding";

export default async function OnboardingPage() {
  const user = await getRequiredUser();
  const initialAnswers = await getLatestOnboardingAnswers(user.id);

  return <OnboardingWizard initialAnswers={initialAnswers} />;
}
