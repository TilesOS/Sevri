import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createGitHubClient } from "@/lib/integrations/github/client";
import { captureServerError } from "@/lib/sentry/server";
import { activityCycleKey, activationStage, elapsedDays, inactivityStage } from "@/lib/email/sequence";
import { enqueueEmailMessage } from "@/lib/email/outbox";

interface EnabledPreference {
  user_id: string;
  enrolled_at: string;
}

const LIFECYCLE_PLANNER_KEY = "lifecycle";
const LIFECYCLE_RECIPIENT_BATCH_SIZE = 50;
const LIFECYCLE_PLANNING_BUDGET_MS = 40_000;

async function loadPlannerCursor() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("email_planner_state")
    .select("cursor_user_id")
    .eq("planner_key", LIFECYCLE_PLANNER_KEY)
    .maybeSingle();
  if (error) throw new Error(`Failed to load lifecycle planner cursor: ${error.message}`);
  return data?.cursor_user_id ?? null;
}

async function savePlannerCursor(cursorUserId: string | null) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("email_planner_state").upsert(
    {
      planner_key: LIFECYCLE_PLANNER_KEY,
      cursor_user_id: cursorUserId,
    },
    { onConflict: "planner_key" },
  );
  if (error) throw new Error(`Failed to save lifecycle planner cursor: ${error.message}`);
}

async function loadEnabledPreferences(afterUserId: string | null) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("email_preferences")
    .select("user_id, enrolled_at")
    .eq("lifecycle_enabled", true)
    .is("delivery_suppressed_at", null)
    .not("enrolled_at", "is", null)
    .order("user_id", { ascending: true })
    .limit(LIFECYCLE_RECIPIENT_BATCH_SIZE);
  if (afterUserId) query = query.gt("user_id", afterUserId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load lifecycle enrollment: ${error.message}`);
  return (data ?? []) as EnabledPreference[];
}

async function userEmail(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw new Error(`Failed to load lifecycle email recipient: ${error.message}`);
  return data.user.email ?? null;
}

async function planActivation(preference: EnabledPreference, now: Date) {
  const supabase = createAdminSupabaseClient();
  const { data: intake, error: intakeError } = await supabase
    .from("intakes")
    .select("id, created_at")
    .eq("user_id", preference.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (intakeError || !intake) return false;

  const baseline = new Date(Math.max(new Date(intake.created_at).getTime(), new Date(preference.enrolled_at).getTime()));
  const { count, error: projectError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", preference.user_id)
    .gte("selected_at", intake.created_at);
  if (projectError || (count ?? 0) > 0) return false;

  const prefix = `activation:${intake.id}:`;
  const { data: prior } = await supabase
    .from("email_messages")
    .select("dedupe_key")
    .eq("user_id", preference.user_id)
    .in("dedupe_key", [`${prefix}3`, `${prefix}7`])
    .neq("status", "canceled");
  const sent = new Set<3 | 7>();
  for (const row of prior ?? []) {
    if (row.dedupe_key.endsWith(":3")) sent.add(3);
    if (row.dedupe_key.endsWith(":7")) sent.add(7);
  }
  const stage = activationStage(elapsedDays(baseline, now), sent);
  if (!stage) return false;
  const email = await userEmail(preference.user_id);
  if (!email) return false;
  await enqueueEmailMessage({
    userId: preference.user_id,
    intakeId: intake.id,
    messageType: stage === 3 ? "activation_day_3" : "activation_day_7",
    dedupeKey: `${prefix}${stage}`,
    toEmail: email,
    sender: "hello",
  });
  return true;
}

async function refreshGithubActivity(project: {
  id: string;
  user_id: string;
  last_meaningful_activity_at: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data: link, error } = await supabase
    .from("project_github_links")
    .select("repo_full_name, default_branch, status")
    .eq("project_id", project.id)
    .maybeSingle();
  if (error || !link || link.status !== "active") return { activityAt: project.last_meaningful_activity_at, safe: !error };

  try {
    const client = await createGitHubClient(project.user_id);
    const commits = await client.listCommits(link.repo_full_name, {
      since: project.last_meaningful_activity_at,
      sha: link.default_branch,
      perPage: 100,
    });
    const latest = commits
      .map((commit) => commit.author.date)
      .filter(Boolean)
      .sort()
      .at(-1);
    if (!latest || new Date(latest) <= new Date(project.last_meaningful_activity_at)) {
      return { activityAt: project.last_meaningful_activity_at, safe: true };
    }
    const activityAt = new Date(Math.min(new Date(latest).getTime(), Date.now())).toISOString();
    const { error: updateError } = await supabase
      .from("projects")
      .update({ last_meaningful_activity_at: activityAt })
      .eq("id", project.id)
      .eq("user_id", project.user_id);
    if (updateError) throw new Error(updateError.message);
    return { activityAt, safe: true };
  } catch (refreshError) {
    captureServerError(refreshError, { stage: "coach_github_refresh", project_id: project.id });
    // Avoid a false inactivity email when the source of truth could not be checked.
    return { activityAt: project.last_meaningful_activity_at, safe: false };
  }
}

function curatedEmailPayload(value: unknown) {
  if (!value || typeof value !== "object") return { subject: "", body: "" };
  const payload = value as Record<string, unknown>;
  return {
    subject: typeof payload.subject === "string" ? payload.subject : "",
    body: typeof payload.body === "string" ? payload.body : "",
  };
}

async function planCoach(preference: EnabledPreference, now: Date) {
  const supabase = createAdminSupabaseClient();
  const capStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCoachCount } = await supabase
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", preference.user_id)
    .in("message_type", ["coach_inactive_7", "coach_inactive_14"])
    .in("status", ["pending", "processing", "sent", "delivered", "failed"])
    .gte("created_at", capStart);
  if ((recentCoachCount ?? 0) > 0) return false;

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, user_id, title, last_meaningful_activity_at")
    .eq("user_id", preference.user_id)
    .eq("status", "active")
    .is("archived_at", null)
    .order("last_meaningful_activity_at", { ascending: true });
  if (error) throw new Error(`Failed to load coach candidates: ${error.message}`);

  for (const project of projects ?? []) {
    const { count: roadmapCount } = await supabase
      .from("project_roadmaps")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id);
    if (!roadmapCount) continue;

    const baselineBeforeRefresh = new Date(
      Math.max(new Date(project.last_meaningful_activity_at).getTime(), new Date(preference.enrolled_at).getTime()),
    ).toISOString();
    if (elapsedDays(baselineBeforeRefresh, now) < 7) continue;

    const refreshed = await refreshGithubActivity(project);
    if (!refreshed.safe) continue;
    const baseline = new Date(
      Math.max(new Date(refreshed.activityAt).getTime(), new Date(preference.enrolled_at).getTime()),
    ).toISOString();
    const cycle = activityCycleKey(baseline);
    const prefix = `coach:${project.id}:${cycle}:`;
    const { data: prior } = await supabase
      .from("email_messages")
      .select("dedupe_key")
      .in("dedupe_key", [`${prefix}7`, `${prefix}14`])
      .neq("status", "canceled");
    const sent = new Set<7 | 14>();
    for (const row of prior ?? []) {
      if (row.dedupe_key.endsWith(":7")) sent.add(7);
      if (row.dedupe_key.endsWith(":14")) sent.add(14);
    }
    const stage = inactivityStage(elapsedDays(baseline, now), sent);
    if (!stage) continue;

    const { data: milestone } = await supabase
      .from("milestones")
      .select("id, title")
      .eq("project_id", project.id)
      .eq("completed", false)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    let curated = { subject: "", body: "" };
    if (milestone) {
      const { data: guidance } = await supabase
        .from("milestone_guidance")
        .select("email_payload_json")
        .eq("milestone_id", milestone.id)
        .maybeSingle();
      curated = curatedEmailPayload(guidance?.email_payload_json);
    }
    const email = await userEmail(preference.user_id);
    if (!email) return false;
    await enqueueEmailMessage({
      userId: preference.user_id,
      projectId: project.id,
      messageType: stage === 7 ? "coach_inactive_7" : "coach_inactive_14",
      dedupeKey: `${prefix}${stage}`,
      toEmail: email,
      sender: "coach",
      payload: {
        projectTitle: project.title,
        stepTitle: milestone?.title ?? "",
        curatedSubject: curated.subject,
        curatedBody: curated.body,
      },
    });
    return true;
  }
  return false;
}

export async function planLifecycleEmails(now = new Date()) {
  const startedAt = Date.now();
  let cursor = await loadPlannerCursor();
  let preferences = await loadEnabledPreferences(cursor);
  if (preferences.length === 0 && cursor) {
    cursor = null;
    await savePlannerCursor(null);
    preferences = await loadEnabledPreferences(null);
  }

  let activation = 0;
  let coach = 0;
  let errors = 0;
  let recipients = 0;
  for (const preference of preferences) {
    if (recipients > 0 && Date.now() - startedAt >= LIFECYCLE_PLANNING_BUDGET_MS) break;
    try {
      if (await planActivation(preference, now)) activation += 1;
      if (await planCoach(preference, now)) coach += 1;
    } catch (error) {
      errors += 1;
      captureServerError(error, { stage: "lifecycle_planning", user_id: preference.user_id });
    } finally {
      recipients += 1;
      cursor = preference.user_id;
      await savePlannerCursor(cursor);
    }
  }

  if (recipients === preferences.length && preferences.length < LIFECYCLE_RECIPIENT_BATCH_SIZE) {
    cursor = null;
    await savePlannerCursor(null);
  }
  return { activation, coach, errors, recipients };
}
