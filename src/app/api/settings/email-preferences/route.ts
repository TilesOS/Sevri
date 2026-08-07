import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getEmailPreference, setLifecycleEmailPreference } from "@/lib/email/preferences";
import { captureServerError } from "@/lib/sentry/server";

const bodySchema = z.object({ lifecycle_enabled: z.boolean() });

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  try {
    return NextResponse.json(await getEmailPreference(user.id));
  } catch (error) {
    captureServerError(error, { route: "settings/email-preferences", method: "GET" });
    return NextResponse.json({ error: "Failed to load email preferences" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  try {
    const payload = bodySchema.parse(await request.json());
    await setLifecycleEmailPreference(user.id, payload.lifecycle_enabled);
    return NextResponse.json({ message: "Email preferences saved." });
  } catch (error) {
    if (error instanceof Error && error.message === "delivery_suppressed") {
      return NextResponse.json({ error: "Delivery is paused for this address. Contact support@sevri.co to restore it." }, { status: 409 });
    }
    captureServerError(error, { route: "settings/email-preferences", method: "POST" });
    return NextResponse.json({ error: "Failed to save email preferences" }, { status: 400 });
  }
}
