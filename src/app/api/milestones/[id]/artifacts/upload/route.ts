import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", ["jpg", "jpeg"]], ["image/png", ["png"]], ["image/webp", ["webp"]],
  ["application/pdf", ["pdf"]], ["text/plain", ["txt"]], ["text/markdown", ["md", "markdown"]],
  ["text/csv", ["csv"]], ["application/json", ["json"]],
]);
const requestSchema = z.object({ filename: z.string().min(1).max(180), mime_type: z.string().min(1).max(120), size_bytes: z.number().int().positive().max(10 * 1024 * 1024) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const { id: milestoneId } = await context.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload request.", details: parsed.error.flatten() }, { status: 400 });

  const allowedExtensions = ALLOWED_TYPES.get(parsed.data.mime_type);
  const extension = parsed.data.filename.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions?.includes(extension)) {
    return NextResponse.json({ error: "That file type is not supported, or its extension does not match its contents." }, { status: 415 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: milestone } = await supabase.from("milestones").select("id, project_id").eq("id", milestoneId).maybeSingle();
  if (!milestone) return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
  const { data: project } = await supabase.from("projects").select("id").eq("id", milestone.project_id).eq("user_id", user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: "Milestone not found." }, { status: 404 });

  const safeExtension = allowedExtensions[0];
  const path = `${user.id}/${project.id}/${milestoneId}/${crypto.randomUUID()}.${safeExtension}`;
  const { data, error } = await supabase.storage.from("project-evidence").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: "Could not prepare the evidence upload." }, { status: 500 });
  return NextResponse.json({ path, token: data.token, signed_url: data.signedUrl });
}
