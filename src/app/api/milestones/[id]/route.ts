import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  completed: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  const { id } = await context.params;

  try {
    const body = bodySchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("milestones")
      .update({
        completed: body.completed,
        completed_at: body.completed ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id, completed, completed_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 400 });
  }
}