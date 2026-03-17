import { getRequiredUser } from "@/lib/auth/guard";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  await getRequiredUser();

  return <OnboardingWizard />;
}
