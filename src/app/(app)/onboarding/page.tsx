import type { Metadata } from "next";
import { getRequiredUser } from "@/lib/auth/guard";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getLatestOnboardingAnswers } from "@/lib/db/queries/onboarding";
import { getEmailPreference } from "@/lib/email/preferences";

export const metadata: Metadata = {
  title: "Onboarding",
};

export default async function OnboardingPage() {
  const user = await getRequiredUser();
  const [initialAnswers, emailPreference] = await Promise.all([
    getLatestOnboardingAnswers(user.id),
    getEmailPreference(user.id),
  ]);
  const hasStoredAnswers = Boolean(initialAnswers.answers);

  return (
    <OnboardingWizard
      initialAnswers={initialAnswers}
      initialLifecycleEmailEnabled={
        emailPreference.lifecycleEnabled || (emailPreference.onboardingDefaultEnabled && !hasStoredAnswers)
      }
    />
  );
}
