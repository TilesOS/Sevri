// Per-stage FieldSpec maps for the content-quality layer.
// Each stage names the fields that must be complete English prose or clean titles;
// fields not listed here are ignored (ids, enums, numbers, freeform tech lists, etc.).

import type { FieldSpec, FieldSpecMap } from "@/lib/ai/content-quality";
import type { GenerationContext } from "@/lib/ai/schemas";

const DEFAULT_ALLOWED_TERMS: readonly string[] = [
  "MVP",
  "CSS",
  "HTML",
  "JS",
  "TS",
  "API",
  "SDK",
  "GPU",
  "CPU",
  "ML",
  "AI",
  "NLP",
  "PCB",
  "FPGA",
  "arXiv",
  "LaTeX",
  "RTL",
  "SQL",
  "JSON",
  "YAML",
  "HTTP",
  "HTTPS",
  "URL",
  "UI",
  "UX",
  "MVP",
  "R&D",
  "LLM",
  "GPT",
  "IoT",
  "TCP",
  "UDP",
  "DNS",
  "CI",
  "CD",
];

function uniqueTokens(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function buildAllowedTerms(context?: GenerationContext | null): readonly string[] {
  if (!context) return DEFAULT_ALLOWED_TERMS;

  const anchors = [
    ...(context.interpreted_interests ?? []),
    ...(context.track_payload_json?.anchor_interests ?? []),
  ];

  return uniqueTokens([...DEFAULT_ALLOWED_TERMS, ...anchors]);
}

const TITLE: FieldSpec = { kind: "title", minCredible: 8, maxUiSafe: 100 };
const TITLE_WIDE: FieldSpec = { kind: "title", minCredible: 8, maxUiSafe: 120 };
const PROSE_SHORT: FieldSpec = { kind: "prose", minCredible: 24 };
const PROSE_MED: FieldSpec = { kind: "prose", minCredible: 40 };
const PROSE_LONG: FieldSpec = { kind: "prose", minCredible: 60 };
const PROSE_XLONG: FieldSpec = { kind: "prose", minCredible: 80 };
const PROSE_BRIEF: FieldSpec = { kind: "prose", minCredible: 120 };
const BULLET: FieldSpec = { kind: "bullet", minCredible: 16 };

// Stage 1: recommendation batch
export const OPTIONS_QUALITY_SPEC: FieldSpecMap = {
  "recommendations[*].title": TITLE,
  "recommendations[*].summary": PROSE_LONG,
  "recommendations[*].why_it_fits": PROSE_LONG,
  // Software seed fields
  "recommendations[*].track_payload_json.target_user": PROSE_SHORT,
  "recommendations[*].track_payload_json.problem_statement": PROSE_SHORT,
  "recommendations[*].track_payload_json.core_workflow": PROSE_SHORT,
  "recommendations[*].track_payload_json.mvp_boundary": PROSE_SHORT,
  "recommendations[*].track_payload_json.validation_plan": PROSE_SHORT,
  // Research seed fields (share the same path since track is discriminated)
  "recommendations[*].track_payload_json.research_question": PROSE_SHORT,
  "recommendations[*].track_payload_json.hypothesis_or_focus": PROSE_SHORT,
  "recommendations[*].track_payload_json.methodology": PROSE_SHORT,
  "recommendations[*].track_payload_json.evidence_plan": PROSE_SHORT,
  "recommendations[*].track_payload_json.scope_boundaries": PROSE_SHORT,
  "recommendations[*].track_payload_json.limitation_note": PROSE_SHORT,
};

// Stage 2: roadmap overview
export const ROADMAP_QUALITY_SPEC: FieldSpecMap = {
  project_title: TITLE_WIDE,
  short_overview: PROSE_LONG,
  project_brief: PROSE_BRIEF,
  "steps[*].title": TITLE,
  "steps[*].objective": PROSE_MED,
  "steps[*].deliverable": PROSE_SHORT,
  "steps[*].validation_check": PROSE_SHORT,
  "steps[*].scope_guardrail": PROSE_SHORT,
  "cut_if_behind[*]": BULLET,
  "success_criteria[*]": BULLET,
};

// Stage 3: step guidance
export const STEP_GUIDANCE_QUALITY_SPEC: FieldSpecMap = {
  what_to_do_now: PROSE_LONG,
  encouragement: PROSE_MED,
  "checklist[*]": BULLET,
  "pitfalls[*]": BULLET,
  "tools_resources[*]": BULLET,
  "done_when[*]": BULLET,
  "email_version.subject": TITLE,
  "email_version.preview": PROSE_SHORT,
  "email_version.body": PROSE_XLONG,
};

// Stage 4: work evaluation
export const WORK_EVALUATION_QUALITY_SPEC: FieldSpecMap = {
  "criterion_verdicts[*].criterion": { kind: "prose", minCredible: 16 },
  "criterion_verdicts[*].note": PROSE_SHORT,
  overall_assessment: PROSE_XLONG,
  strongest_aspect: { kind: "prose", minCredible: 32 },
  clearest_gap: { kind: "prose", minCredible: 32 },
  next_best_action: PROSE_MED,
};

// Handy standalone field specs for render-side safeRenderText calls.
export const RECOMMENDATION_CARD_TITLE_SPEC: FieldSpec = TITLE;
export const RECOMMENDATION_CARD_PROSE_SPEC: FieldSpec = PROSE_LONG;
export const ROADMAP_PROJECT_TITLE_SPEC: FieldSpec = TITLE_WIDE;
export const ROADMAP_OVERVIEW_PROSE_SPEC: FieldSpec = PROSE_LONG;
export const STEP_TITLE_SPEC: FieldSpec = TITLE;
export const STEP_OBJECTIVE_SPEC: FieldSpec = PROSE_MED;
export const GUIDANCE_WHAT_TO_DO_SPEC: FieldSpec = PROSE_LONG;
export const GUIDANCE_ENCOURAGEMENT_SPEC: FieldSpec = PROSE_MED;
