import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProjectWorkspace } from "@/lib/db/queries/projects";

export interface ProjectReviewerSummary {
  id: string;
  reviewer_user_id: string;
  joined_at: string;
  revoked_at: string | null;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
}

export interface ProjectInvitationSummary {
  id: string;
  reviewer_email: string;
  personal_note: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  expires_at: string;
}

export async function listProjectReviewers(projectId: string): Promise<ProjectReviewerSummary[]> {
  const supabase = await createServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from("project_reviewers")
    .select("id, reviewer_user_id, joined_at, revoked_at")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list reviewers: ${error.message}`);
  }

  const reviewers = rows ?? [];
  if (reviewers.length === 0) {
    return [];
  }

  const reviewerIds = reviewers.map((r) => r.reviewer_user_id);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, display_name, full_name")
    .in("user_id", reviewerIds);

  if (profileError) {
    throw new Error(`Failed to load reviewer profiles: ${profileError.message}`);
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p as { display_name: string | null; full_name: string | null }]),
  );

  return reviewers.map((reviewer) => {
    const profile = profileById.get(reviewer.reviewer_user_id);
    return {
      id: reviewer.id,
      reviewer_user_id: reviewer.reviewer_user_id,
      joined_at: reviewer.joined_at,
      revoked_at: reviewer.revoked_at,
      display_name: profile?.display_name ?? null,
      full_name: profile?.full_name ?? null,
      email: null,
    };
  });
}

export async function listProjectInvitations(projectId: string): Promise<ProjectInvitationSummary[]> {
  const supabase = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("project_invitations")
    .select("id, reviewer_email, personal_note, status, created_at, expires_at")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list invitations: ${error.message}`);
  }

  return (data ?? []) as ProjectInvitationSummary[];
}

export interface ReviewerProjectSummary {
  project_id: string;
  project_title: string;
  student_display_name: string;
  last_student_activity_at: string | null;
}

export async function listReviewerProjects(reviewerUserId: string): Promise<ReviewerProjectSummary[]> {
  const supabase = await createServerSupabaseClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("project_reviewers")
    .select("project_id, joined_at")
    .eq("reviewer_user_id", reviewerUserId)
    .is("revoked_at", null);

  if (membershipError) {
    throw new Error(`Failed to load reviewer memberships: ${membershipError.message}`);
  }

  const projectIds = (memberships ?? []).map((m) => m.project_id);
  if (projectIds.length === 0) {
    return [];
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, title, user_id, updated_at")
    .in("id", projectIds);

  if (projectsError) {
    throw new Error(`Failed to load reviewer projects: ${projectsError.message}`);
  }

  const studentIds = Array.from(new Set((projects ?? []).map((p) => p.user_id)));
  const { data: studentProfiles, error: studentProfileError } = await supabase
    .from("profiles")
    .select("user_id, display_name, full_name")
    .in("user_id", studentIds);

  if (studentProfileError) {
    throw new Error(`Failed to load student profiles: ${studentProfileError.message}`);
  }

  const profileById = new Map(
    (studentProfiles ?? []).map((p) => [p.user_id as string, p as { display_name: string | null; full_name: string | null }]),
  );

  return (projects ?? []).map((project) => {
    const profile = profileById.get(project.user_id);
    return {
      project_id: project.id,
      project_title: project.title,
      student_display_name: profile?.display_name ?? profile?.full_name ?? "A student",
      last_student_activity_at: project.updated_at ?? null,
    };
  });
}

export interface MilestoneReviewRow {
  id: string;
  milestone_id: string;
  reviewer_user_id: string;
  submission_id: string | null;
  strength: string;
  tighten: string;
  next_action: string;
  ready_to_mark_complete: boolean;
  created_at: string;
  superseded_at: string | null;
  reviewer_display_name: string | null;
  reviewer_full_name: string | null;
  reviewer_email: string | null;
}

export async function listMilestoneReviews(milestoneId: string): Promise<MilestoneReviewRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from("milestone_reviews")
    .select(
      "id, milestone_id, reviewer_user_id, submission_id, strength, tighten, next_action, ready_to_mark_complete, created_at, superseded_at",
    )
    .eq("milestone_id", milestoneId)
    .is("superseded_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load milestone reviews: ${error.message}`);
  }

  const reviews = rows ?? [];
  if (reviews.length === 0) {
    return [];
  }

  const reviewerIds = Array.from(new Set(reviews.map((r) => r.reviewer_user_id)));
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, display_name, full_name")
    .in("user_id", reviewerIds);

  if (profilesError) {
    throw new Error(`Failed to load reviewer profiles: ${profilesError.message}`);
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p as { display_name: string | null; full_name: string | null }]),
  );

  return reviews.map((review) => {
    const profile = profileById.get(review.reviewer_user_id);
    return {
      ...review,
      reviewer_display_name: profile?.display_name ?? null,
      reviewer_full_name: profile?.full_name ?? null,
      reviewer_email: null,
    };
  });
}

export async function getMilestoneForReviewer(milestoneId: string, reviewerUserId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: milestone, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("id", milestoneId)
    .single();

  if (error || !milestone) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("project_reviewers")
    .select("id")
    .eq("project_id", milestone.project_id)
    .eq("reviewer_user_id", reviewerUserId)
    .is("revoked_at", null)
    .maybeSingle();

  if (membershipError || !membership) {
    return null;
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title, status")
    .eq("id", milestone.project_id)
    .single();

  if (projectError || !project) {
    return null;
  }

  return { milestone, project };
}

export async function getReviewerProjectWorkspace(projectId: string, reviewerUserId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: membership, error } = await supabase
    .from("project_reviewers")
    .select("id")
    .eq("project_id", projectId)
    .eq("reviewer_user_id", reviewerUserId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check reviewer membership: ${error.message}`);
  }

  if (!membership) {
    return null;
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return null;
  }

  const { data: roadmap } = await supabase
    .from("project_roadmaps")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  return {
    project,
    roadmap: roadmap ?? null,
    milestones: milestones ?? [],
  } as Awaited<ReturnType<typeof getProjectWorkspace>>;
}
