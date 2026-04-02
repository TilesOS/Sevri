import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { onboardingInputSchema, upsertOnboardingData } from "@/lib/db/mutations/onboarding";
import { trackEvent } from "@/lib/analytics/track";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import { captureServerError } from "@/lib/sentry/server";
import { resolveDisplayName } from "@/lib/auth/names";

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const json = await request.json();
    const payload = onboardingInputSchema.parse(json);

    const intake = await upsertOnboardingData(user, payload);

    const postSaveTasks: Promise<unknown>[] = [
      trackEvent(user.id, "onboarding_completed", { intake_id: intake.id, project_track: payload.project_track }),
    ];

    if (user.email) {
      const template = welcomeEmailTemplate(
        resolveDisplayName({
          userMetadata: user.user_metadata,
          email: user.email,
        }),
      );
      postSaveTasks.push(sendEmail(user.email, template.subject, template.html));
    }

    const taskResults = await Promise.allSettled(postSaveTasks);
    taskResults.forEach((result) => {
      if (result.status === "rejected") {
        captureServerError(result.reason, {
          route: "onboarding/submit",
          stage: "post-save-task",
        });
      }
    });

    return NextResponse.json({ intake_id: intake.id, project_track: payload.project_track }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "onboarding/submit" });
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to submit onboarding",
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 400 },
    );
  }
}
