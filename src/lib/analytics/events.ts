import { z } from "zod";

export const APP_EVENT_TYPES = [
  "onboarding_started",
  "onboarding_completed",
  "recommendations_generated",
  "recommendation_selected",
  "roadmap_generated",
  "milestone_guidance_generated",
  "upgrade_clicked",
  "checkout_completed",
  "work_evaluation_completed",
  "generation_feedback_submitted",
  "portfolio_viewed",
  "portfolio_project_opened",
  "portfolio_curation_generated",
  "portfolio_curation_regenerated",
  "portfolio_reflection_saved",
  "portfolio_export_generated",
  "portfolio_publish_started",
  "portfolio_publish_safety_blocked",
  "portfolio_published",
  "portfolio_unpublished",
  "portfolio_public_page_viewed",
] as const;

export const appEventSchema = z.enum(APP_EVENT_TYPES);

export type AppEvent = (typeof APP_EVENT_TYPES)[number];

export async function trackClientEvent(
  eventType: AppEvent,
  metadata: Record<string, unknown> = {},
) {
  const response = await fetch("/api/events/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: eventType,
      metadata,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to track event (${eventType})`);
  }
}
