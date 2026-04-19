import { NextResponse } from "next/server";

import { requireApiStudent } from "@/lib/auth/api";
import {
  deleteProjectGithubLinksForUser,
  deleteUserIntegration,
} from "@/lib/db/mutations/github";
import { captureServerError } from "@/lib/sentry/server";

export async function DELETE() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  try {
    await deleteProjectGithubLinksForUser(user.id);
    await deleteUserIntegration(user.id, "github");
    return NextResponse.json({ status: "disconnected" }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "integrations/github/disconnect" });
    return NextResponse.json(
      { error: "Failed to disconnect GitHub" },
      { status: 500 },
    );
  }
}
