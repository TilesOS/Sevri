import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { setMilestoneChecklistState } from "@/lib/db/mutations/milestone-guidance";
import { captureServerError } from "@/lib/sentry/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  state: z.record(z.string(), z.boolean()),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let stage = "start";

  try {
    stage = "auth";
    const { user, response } = await requireApiUser();
    if (!user) {
      return response;
    }

    stage = "parse-request";
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const { id } = await context.params;

    // Confirm the user owns the project that the milestone belongs to.
    // (RLS would block the write anyway, but a 404 here is clearer than a silent no-op.)
    stage = "verify-ownership";
    const supabase = await createServerSupabaseClient();
    const { data: milestone, error: milestoneError } = await supabase
      .from("milestones")
      .select("id, project_id, projects!inner(user_id)")
      .eq("id", id)
      .maybeSingle();

    if (milestoneError) {
      throw new Error(milestoneError.message);
    }
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    stage = "save-checklist-state";
    const result = await setMilestoneChecklistState(id, body.state);

    if (!result.updated) {
      // No guidance row exists yet — the user hasn't opened guidance for this step.
      // Nothing to persist against, but don't treat as an error.
      return NextResponse.json({ saved: false, reason: "no_guidance_yet" }, { status: 200 });
    }

    return NextResponse.json({ saved: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError && stage === "parse-request") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    console.error("milestone checklist state failed", { stage, error });
    captureServerError(error, { route: "ai/milestones/guidance/checklist", stage });
    return NextResponse.json({ error: "Failed to save checklist state" }, { status: 500 });
  }
}
