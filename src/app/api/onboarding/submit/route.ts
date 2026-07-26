import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { onboardingInputSchema, upsertOnboardingData } from "@/lib/db/mutations/onboarding";
import { trackEvent } from "@/lib/analytics/track";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import { captureServerError } from "@/lib/sentry/server";
import { resolveDisplayName } from "@/lib/auth/names";

/** Wizard-facing names for the fields a submission can fail on. */
const FIELD_LABELS: Record<string, string> = {
  student_stage: "Student stage",
  target_outcome: "Project outcome",
  interests: "Interests",
  favorite_subjects: "Favorite subjects",
  weekly_time_available: "Weekly time available",
  coding_experience: "Coding experience",
  preferred_project_style: "Preferred project style",
  preferred_research_domain: "Preferred research domain",
  research_experience: "Research experience",
  methodology_preference: "Methodology preference",
  target_research_deliverable: "Target final deliverable",
};

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
