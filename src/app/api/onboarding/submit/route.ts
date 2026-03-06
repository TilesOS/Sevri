import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { onboardingInputSchema, upsertOnboardingData } from "@/lib/db/mutations/onboarding";
import { trackEvent } from "@/lib/analytics/events";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import { captureServerError } from "@/lib/sentry/server";

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const json = await request.json();
    const payload = onboardingInputSchema.parse(json);

    const intake = await upsertOnboardingData(user.id, payload);
    await trackEvent(user.id, "onboarding_completed", { intake_id: intake.id });

    if (user.email) {
      const template = welcomeEmailTemplate(payload.full_name);
      await sendEmail(user.email, template.subject, template.html);
    }

    return NextResponse.json({ intake_id: intake.id }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "onboarding/submit" });
    return NextResponse.json({ error: "Failed to submit onboarding" }, { status: 400 });
  }
}