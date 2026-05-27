import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ChecklistState } from "@/lib/db/queries/milestone-guidance";

export async function setMilestoneChecklistState(
  milestoneId: string,
  state: ChecklistState,
): Promise<{ updated: boolean }> {
  const supabase = await createServerSupabaseClient();

  // Update only — the row is created by the guidance-generation route on first load,
  // so missing rows here mean the user hasn't opened guidance yet (no-op).
  const { data, error } = await supabase
    .from("milestone_guidance")
    .update({ checklist_state_json: state })
    .eq("milestone_id", milestoneId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to save checklist state: ${error.message}`);
  }

  return { updated: Boolean(data) };
}
