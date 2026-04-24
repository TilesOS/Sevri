import { z } from "zod";
import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics/track";
import { requireApiStudent } from "@/lib/auth/api";
import { publishPortfolioPage } from "@/lib/db/mutations/portfolio";
import { getPortfolioDisplayName } from "@/lib/portfolio/display-name";
import { buildPublicSafetyInput } from "@/lib/portfolio/public-surface";
import { getPortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";
import { runSafetyChecks } from "@/lib/portfolio/safety";
import { generateUniquePortfolioSlug } from "@/lib/portfolio/slug";
import { captureServerError } from "@/lib/sentry/server";
import { assertFeatureAccess, createUpgradeRequiredResponse } from "@/lib/usage/feature-access";

const publishSchema = z.object({
  display_name_choice: z.enum(["anonymous", "real"]),
  age_attestation: z.boolean(),
  public_acknowledgement: z.boolean(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) return response;

  const body = publishSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid publish payload." }, { status: 400 });
  }

  if (!body.data.age_attestation || !body.data.public_acknowledgement) {
    return NextResponse.json({ error: "Age attestation and public acknowledgement are required." }, { status: 400 });
  }

  const { projectId } = await context.params;
  const view = await getPortfolioEntryDetailView(projectId, user.id);
  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await assertFeatureAccess({ userId: user.id, feature: "portfolio_publish" });
  if (!access.allowed) {
    return createUpgradeRequiredResponse(access.error);
  }

  try {
    await trackEvent(user.id, "portfolio_publish_started", {
      project_id: projectId,
      portfolio_entry_id: view.entry.id,
    });

    const displayName = await getPortfolioDisplayName({
      userId: user.id,
      choice: body.data.display_name_choice,
    });
    const safetyInput = buildPublicSafetyInput(view, displayName);
    const safety = runSafetyChecks(safetyInput);
    if (!safety.passed) {
      await trackEvent(user.id, "portfolio_publish_safety_blocked", {
        project_id: projectId,
        portfolio_entry_id: view.entry.id,
        findings: safety.findings,
      });
      return NextResponse.json(
        { code: "safety_check_failed", findings: safety.findings },
        { status: 422 },
      );
    }

    const slug = view.publicPage?.slug ?? await generateUniquePortfolioSlug();
    const publicPage = await publishPortfolioPage({
      entryId: view.entry.id,
      userId: user.id,
      slug,
      displayNameChoice: body.data.display_name_choice,
      safetySnapshot: {
        checked_at: new Date().toISOString(),
        passed: true,
        display_name_choice: body.data.display_name_choice,
        public_fields: safetyInput,
      },
    });
    const pageSlug = String(publicPage.slug);

    await trackEvent(user.id, "portfolio_published", {
      project_id: projectId,
      portfolio_entry_id: view.entry.id,
      slug: pageSlug,
    });

    return NextResponse.json({
      public_page: publicPage,
      url: `/p/${pageSlug}`,
    });
  } catch (error) {
    captureServerError(error, {
      route: "portfolio/publish",
      project_id: projectId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish Portfolio page." },
      { status: 400 },
    );
  }
}
