import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { getCalendarPageData } from "@/lib/db/queries/calendar";

export async function GET() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  try {
    const data = await getCalendarPageData(user.id);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load calendar." },
      { status: 500 },
    );
  }
}
