import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { onboardingInputSchema, upsertOnboardingData } from "@/lib/db/mutations/onboarding";
import { trackEvent } from "@/lib/analytics/track";
import { enqueueAndDispatchEmail } from "@/lib/email/outbox";
import { setLifecycleEmailPreference } from "@/lib/email/preferences";
import { captureServerError } from "@/lib/sentry/server";
import { resolveDisplayName } from "@/lib/auth/names";

/** Wizard-facing names for the fields a submission can fail on. */
const FIELD_LABELS: Record<string, string> = {
  student_stage: "Student stage",
  project_goal: "Project goal",
  success_definition: "Definition of success",
  interests: "Interests",
  favorite_subjects: "Favorite subjects",
  weekly_time_available: "Weekly time available",
  format_preferences: "Project formats",
  experience_level: "Experience level",
  preferred_challenge: "Preferred challenge",
};

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const json = await request.json();
    const payload = onboardingInputSchema.parse(json);
    const { lifecycle_emails_enabled: lifecycleEmailsEnabled } = z
      .object({ lifecycle_emails_enabled: z.boolean().default(true) })
      .parse(json);

    const intake = await upsertOnboardingData(user, payload);

    const postSaveTasks: Promise<unknown>[] = [
      trackEvent(user.id, "onboarding_completed", {
        intake_id: intake.id,
        project_goal: payload.project_goal,
        open_to_anything: payload.open_to_anything,
      }),
      setLifecycleEmailPreference(user.id, lifecycleEmailsEnabled),
    ];

    if (user.email) {
      postSaveTasks.push(enqueueAndDispatchEmail({
        userId: user.id,
        intakeId: intake.id,
        messageType: "welcome",
        dedupeKey: `welcome:${user.id}`,
        toEmail: user.email,
        sender: "hello",
        payload: { fullName: resolveDisplayName({
          userMetadata: user.user_metadata,
          email: user.email,
        }) },
      }));
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

    return NextResponse.json({ intake_id: intake.id }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "onboarding/submit" });
    const details = error instanceof Error ? error.message : "Unknown error";

    // Validation failures name the offending answers; anything else stays a
    // generic message rather than leaking internals into the wizard.
    if (error instanceof ZodError) {
      const fields = Array.from(
        new Set(
          error.issues
            .map((issue) => FIELD_LABELS[String(issue.path[0] ?? "")])
            .filter((label): label is string => Boolean(label)),
        ),
      );

      return NextResponse.json(
        {
          error:
            fields.length > 0
              ? `Please complete these answers before finishing: ${fields.join(", ")}.`
              : "Some answers are missing or incomplete. Review the form and try again.",
          code: "invalid_onboarding",
          details: process.env.NODE_ENV === "development" ? details : undefined,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "We couldn't save your onboarding answers. Try again in a moment.",
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 400 },
    );
  }
}
