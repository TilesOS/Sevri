import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { appEventSchema } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

const payloadSchema = z.object({
  event_type: appEventSchema,
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const payload = payloadSchema.parse(await request.json());
    await trackEvent(user.id, payload.event_type, payload.metadata ?? {});

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }
}
