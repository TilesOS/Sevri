import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { captureServerError } from "@/lib/sentry/server";
import { settingsProfileSchema } from "@/lib/validators/settings";

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const json = await request.json();
    const payload = settingsProfileSchema.parse(json);
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        full_name: payload.full_name,
        student_stage: payload.student_stage,
        target_outcome: payload.target_outcome,
        project_track: payload.project_track,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return NextResponse.json({ message: "Settings saved." }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid settings input",
          details: error.issues[0]?.message ?? "Please review your changes and try again.",
        },
        { status: 400 },
      );
    }

    captureServerError(error, { route: "settings/profile" });
    const details = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to save settings",
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 400 },
    );
  }
}
