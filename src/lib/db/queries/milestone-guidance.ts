import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StepGuidanceSchema } from "@/lib/ai/schemas";
import type { StepGuidance } from "@/types/domain";

export type ChecklistState = Record<string, boolean>;

export interface MilestoneGuidanceRow {
  id: string;
  guidance: StepGuidance;
  checklistState: ChecklistState;
}

function coerceChecklistState(value: unknown): ChecklistState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const out: ChecklistState = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "boolean") {
      out[key] = raw;
    }
  }
  return out;
}

export async function getMilestoneGuidance(milestoneId: string): Promise<MilestoneGuidanceRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("milestone_guidance")
    .select("id, guidance_json, checklist_state_json")
    .eq("milestone_id", milestoneId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch milestone guidance: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const parsed = StepGuidanceSchema.safeParse(data.guidance_json);
  if (!parsed.success) {
    return null;
  }

  return {
    id: data.id,
    guidance: parsed.data,
    checklistState: coerceChecklistState(data.checklist_state_json),
  };
}
