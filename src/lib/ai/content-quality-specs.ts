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
    ...(context.project_context_json?.anchor_interests ?? []),
  ];

  return uniqueTokens([...DEFAULT_ALLOWED_TERMS, ...anchors]);
}

// `maxLength` mirrors the Zod `.max()` on the same field so an over-length draft
// is sent back to the model for a shorter, complete rewrite. Nothing downstream
// cuts a value to fit — `maxUiSafe` is a layout hint the UI clamps with CSS.
const TITLE: FieldSpec = { kind: "title", minCredible: 8, maxLength: 120, maxUiSafe: 100 };
const TITLE_WIDE: FieldSpec = { kind: "title", minCredible: 8, maxLength: 140, maxUiSafe: 120 };
const PROSE_SHORT: FieldSpec = { kind: "prose", minCredible: 24, maxLength: 220 };
const PROSE_MED: FieldSpec = { kind: "prose", minCredible: 40, maxLength: 260 };
const PROSE_LONG: FieldSpec = { kind: "prose", minCredible: 60, maxLength: 360 };
const PROSE_XLONG: FieldSpec = { kind: "prose", minCredible: 80, maxLength: 700 };
const PROSE_BRIEF: FieldSpec = { kind: "prose", minCredible: 120, maxLength: 600 };
const BULLET: FieldSpec = { kind: "bullet", minCredible: 16, maxLength: 180 };
const BULLET_LONG: FieldSpec = { kind: "bullet", minCredible: 50, maxLength: 220 };
// Seed fields are compact descriptors shown under a label. They still receive
// truncation, contamination, balance, and length checks, but a noun phrase such
// as "Community health coordinators" should not fail for lacking a period.
const DESCRIPTOR_SHORT: FieldSpec = { kind: "list_item", minCredible: 16, maxLength: 220 };

/** Narrows a base spec to the exact `.max()` its Zod field carries. */
function withMax(spec: FieldSpec, maxLength: number): FieldSpec {
  return { ...spec, maxLength };
}

// Stage 1: recommendation batch
export const OPTIONS_QUALITY_SPEC: FieldSpecMap = {
  "recommendations[*].title": TITLE,
  "recommendations[*].summary": withMax(PROSE_LONG, 340),
  "recommendations[*].why_it_fits": withMax(PROSE_LONG, 360),
  "recommendations[*].project_blueprint_json.central_challenge": withMax(DESCRIPTOR_SHORT, 180),
  "recommendations[*].project_blueprint_json.approach": withMax(DESCRIPTOR_SHORT, 220),
  "recommendations[*].project_blueprint_json.scope_boundary": withMax(DESCRIPTOR_SHORT, 180),
};

// Stage 2: roadmap overview
export const ROADMAP_QUALITY_SPEC: FieldSpecMap = {
  project_title: TITLE_WIDE,
  short_overview: withMax(PROSE_LONG, 320),
  project_brief: PROSE_BRIEF,
  "steps[*].title": TITLE,
  "steps[*].objective": withMax(PROSE_MED, 220),
  "steps[*].deliverable": withMax(PROSE_SHORT, 180),
  "steps[*].validation_check": PROSE_SHORT,
  "steps[*].scope_guardrail": PROSE_SHORT,
  "cut_if_behind[*]": BULLET,
  "success_criteria[*]": BULLET,
  "pitch_kit.elevator_pitch": { kind: "prose", minCredible: 80, maxLength: 400 },
  "pitch_kit.resume_bullets[*]": BULLET_LONG,
  "pitch_kit.talking_points[*].label": { kind: "title", minCredible: 4, maxLength: 40, maxUiSafe: 40 },
  "pitch_kit.talking_points[*].body": { kind: "prose", minCredible: 40, maxLength: 300 },
  "learning_resources[*].title": TITLE_WIDE,
  "learning_resources[*].provider": { kind: "title", minCredible: 2, maxLength: 80, maxUiSafe: 80 },
  "learning_resources[*].why_it_matters": withMax(PROSE_MED, 260),
};

// Stage 3: step guidance
export const STEP_GUIDANCE_QUALITY_SPEC: FieldSpecMap = {
  what_to_do_now: withMax(PROSE_LONG, 260),
  encouragement: withMax(PROSE_MED, 220),
  "checklist[*]": BULLET,
  "pitfalls[*]": BULLET,
  "tools_resources[*]": BULLET,
  "done_when[*]": BULLET,
  "email_version.subject": TITLE,
  "email_version.preview": withMax(PROSE_SHORT, 200),
  "email_version.body": withMax(PROSE_XLONG, 1200),
};

// Stage 4: work evaluation
export const WORK_EVALUATION_QUALITY_SPEC: FieldSpecMap = {
  "criterion_verdicts[*].criterion": { kind: "prose", minCredible: 16, maxLength: 240 },
  "criterion_verdicts[*].note": withMax(PROSE_SHORT, 300),
  overall_assessment: withMax(PROSE_XLONG, 500),
  strongest_aspect: { kind: "prose", minCredible: 32, maxLength: 200 },
  clearest_gap: { kind: "prose", minCredible: 32, maxLength: 200 },
  next_best_action: withMax(PROSE_MED, 300),
};

// Stage 5: portfolio curation and exports
export const WORK_PORTFOLIO_CURATION_QUALITY_SPEC: FieldSpecMap = {
  curated_summary: PROSE_XLONG,
};

/** The pitch kit checked on its own, for stored rows the audit script inspects. */
export const PITCH_KIT_QUALITY_SPEC: FieldSpecMap = {
  elevator_pitch: { kind: "prose", minCredible: 80, maxLength: 400 },
  "resume_bullets[*]": BULLET_LONG,
  "talking_points[*].label": { kind: "title", minCredible: 4, maxLength: 40, maxUiSafe: 40 },
  "talking_points[*].body": { kind: "prose", minCredible: 40, maxLength: 300 },
};

export const COMMON_APP_ACTIVITY_QUALITY_SPEC: FieldSpecMap = {
  activity_type: { kind: "title", minCredible: 8, maxLength: 80, maxUiSafe: 80 },
  position_leadership_description: { kind: "title", minCredible: 5, maxLength: 50, maxUiSafe: 50 },
  organization_name: { kind: "title", minCredible: 8, maxLength: 100, maxUiSafe: 100 },
  participation_grade_levels: { kind: "title", minCredible: 2, maxLength: 80, maxUiSafe: 80 },
  timing_of_participation: { kind: "title", minCredible: 4, maxLength: 100, maxUiSafe: 100 },
  details: { kind: "prose", minCredible: 80, maxLength: 150 },
};

export const RESUME_BULLETS_QUALITY_SPEC: FieldSpecMap = {
  "bullets[*]": BULLET_LONG,
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
export const PORTFOLIO_SUMMARY_SPEC: FieldSpec = PROSE_XLONG;
