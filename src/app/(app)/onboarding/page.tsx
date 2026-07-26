import type { Metadata } from "next";
import { getRequiredUser } from "@/lib/auth/guard";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getLatestOnboardingAnswers } from "@/lib/db/queries/onboarding";

export const metadata: Metadata = {
  title: "Onboarding",
};

export default async function OnboardingPage() {
  const user = await getRequiredUser();
  const initialAnswers = await getLatestOnboardingAnswers(user.id);

  return <OnboardingWizard initialAnswers={initialAnswers} />;
}
