import {
  ResearchNormalizedProfileSchema,
  SoftwareNormalizedProfileSchema,
  type NormalizedProfile,
} from "@/lib/ai/schemas";

type RiskFlag =
  | "too_ambitious"
  | "too_vague"
  | "too_advanced"
  | "too_little_time"
  | "misaligned_goal"
  | "insufficient_guidance"
  | "resource_constraint";

interface StoredNormalizedProfileRow {
  summary: string;
  interpreted_interests: string[];
  skill_assessment: string;
  risk_flags: string[];
  project_track: string;
  track_payload_json: unknown;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asRiskFlags(value: unknown): RiskFlag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validFlags: RiskFlag[] = [
    "too_ambitious",
    "too_vague",
    "too_advanced",
    "too_little_time",
    "misaligned_goal",
    "insufficient_guidance",
    "resource_constraint",
  ];

  return value.filter((item): item is RiskFlag => typeof item === "string" && validFlags.includes(item as RiskFlag));
}

function asSkillAssessment(value: unknown): "beginner" | "intermediate" | "advanced" {
  if (value === "advanced" || value === "intermediate") {
    return value;
  }

  return "beginner";
}

function asProjectTrack(value: unknown) {
  return value === "research" ? "research" : "software";
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function coerceStoredNormalizedProfile(row: StoredNormalizedProfileRow): NormalizedProfile {
  const projectTrack = asProjectTrack(row.project_track);
  const interpretedInterests = row.interpreted_interests?.length
    ? row.interpreted_interests
    : [projectTrack === "research" ? "applied research" : "software engineering"];
  const rawPayload = row.track_payload_json && typeof row.track_payload_json === "object"
    ? (row.track_payload_json as Record<string, unknown>)
    : {};

  if (projectTrack === "research") {
    return ResearchNormalizedProfileSchema.parse({
      project_track: "research",
      summary: row.summary,
      interpreted_interests: interpretedInterests,
      skill_assessment: asSkillAssessment(row.skill_assessment),
      risk_flags: asRiskFlags(row.risk_flags),
      track_payload_json: {
        domain_brief: asString(
          rawPayload.domain_brief,
          `${interpretedInterests.slice(0, 3).join(", ")} are the core domain anchors. Keep the project focused on one researchable question with feasible evidence.`,
        ),
        anchor_interests: asStringArray(rawPayload.anchor_interests).length
          ? asStringArray(rawPayload.anchor_interests)
          : interpretedInterests,
        goal_signal: asString(rawPayload.goal_signal, "Produce a credible, evidence-driven research project with polished final deliverables."),
        resource_snapshot: asString(rawPayload.resource_snapshot, "Use accessible tools, limited student time, and realistic mentorship availability."),
        anti_generic_warnings: asStringArray(rawPayload.anti_generic_warnings).length
          ? asStringArray(rawPayload.anti_generic_warnings)
          : [
              "Do not default to student-life or wellness topics unless explicitly requested.",
              "Make the question and method concrete before writing polished framing.",
            ],
        research_readiness: asString(rawPayload.research_readiness, "Keep the methodology narrow and defensible for a motivated student."),
        scope_guardrails: asStringArray(rawPayload.scope_guardrails).length
          ? asStringArray(rawPayload.scope_guardrails)
          : ["Choose one question", "Choose one primary method"],
        mentor_resource_notes: asString(rawPayload.mentor_resource_notes, "Use mentor time for method review and limitation checks when available."),
        viable_methodologies: asStringArray(rawPayload.viable_methodologies).length
          ? asStringArray(rawPayload.viable_methodologies)
          : ["secondary data analysis", "focused literature review"],
      },
    });
  }

  return SoftwareNormalizedProfileSchema.parse({
    project_track: "software",
    summary: row.summary,
    interpreted_interests: interpretedInterests,
    skill_assessment: asSkillAssessment(row.skill_assessment),
    risk_flags: asRiskFlags(row.risk_flags),
    track_payload_json: {
      domain_brief: asString(
        rawPayload.domain_brief,
        `${interpretedInterests.slice(0, 3).join(", ")} are the core domain anchors. Keep the project centered on one real workflow or tool with a narrow MVP.`,
      ),
      anchor_interests: asStringArray(rawPayload.anchor_interests).length
        ? asStringArray(rawPayload.anchor_interests)
        : interpretedInterests,
      goal_signal: asString(rawPayload.goal_signal, "Ship a concrete software product that solves a real workflow problem and is easy to demo."),
      resource_snapshot: asString(rawPayload.resource_snapshot, "Use the student's available hours, current tools, and hardware limits to keep scope believable."),
      anti_generic_warnings: asStringArray(rawPayload.anti_generic_warnings).length
        ? asStringArray(rawPayload.anti_generic_warnings)
        : [
            "Do not default to study assistants or generic productivity tools unless explicitly requested.",
            "The MVP should prove one useful workflow, not a broad platform.",
          ],
      project_style_fit: asString(rawPayload.project_style_fit, "Best fit is a focused software tool with one clear end-to-end user workflow."),
      scope_guardrails: asStringArray(rawPayload.scope_guardrails).length
        ? asStringArray(rawPayload.scope_guardrails)
        : ["Keep the MVP narrow", "Cut optional integrations if the timeline slips"],
      problem_lenses: asStringArray(rawPayload.problem_lenses).length
        ? asStringArray(rawPayload.problem_lenses)
        : ["Choose a real user pain point", "Prefer tools with observable before/after value"],
      delivery_bias: asString(rawPayload.delivery_bias, "Favor a demoable web or script-based product with clear inputs, outputs, and success criteria."),
    },
  });
}
