import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { runProfileNormalization } from "@/lib/ai/pipelines";
import { captureServerError } from "@/lib/sentry/server";

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    try {
      const rateLimit = await enforceRateLimit({
        userId: user.id,
        endpoint: "normalize-profile",
        maxRequests: 10,
        windowMinutes: 60,
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded", reset_at: rateLimit.resetAt },
          { status: 429 },
        );
      }
    } catch (rateLimitError) {
      captureServerError(rateLimitError, {
        route: "ai/normalize-profile",
        stage: "rate-limit",
      });
    }

    const supabase = await createServerSupabaseClient();
    const { data: intake, error: intakeError } = await supabase
      .from("intakes")
      .select("id, raw_answers_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intakeError || !intake) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const normalized = await runProfileNormalization(
      (intake.raw_answers_json as Record<string, unknown>) ?? {},
    );

    const { data, error } = await supabase
      .from("normalized_profiles")
      .insert({
        user_id: user.id,
        intake_id: intake.id,
        summary: normalized.parsed.summary,
        interpreted_interests: normalized.parsed.interpreted_interests,
        skill_assessment: normalized.parsed.skill_assessment,
        risk_flags: normalized.parsed.risk_flags,
        raw_model_output_json: normalized.raw,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ normalized_profile_id: data.id, ...normalized.parsed }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "ai/normalize-profile" });
    const details = getErrorDetails(error);
    return NextResponse.json(
      {
        error: "Failed to normalize profile",
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 500 },
    );
  }
}
