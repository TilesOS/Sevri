import { GenerationContextSchema, type GenerationContext } from "@/lib/ai/schemas";

type RiskFlag = GenerationContext["risk_flags"][number];
type Difficulty = GenerationContext["skill_assessment"];
type DomainFamily = "hardware" | "arts" | "literature" | "community" | "venture" | "environment" | "science" | "general";

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : fallback;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => clean(item)).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => clean(item)).filter(Boolean);
  return [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function difficulty(value: unknown, fallback: Difficulty = "beginner"): Difficulty {
  return value === "advanced" || value === "intermediate" || value === "beginner" ? value : fallback;
}

function weeklyHours(value: unknown) {
  const hours = Number(value);
  return Number.isFinite(hours) ? Math.max(1, Math.min(80, Math.round(hours))) : 6;
}

function detectDomainFamily(anchors: string[]): DomainFamily {
  const text = anchors.join(" ").toLowerCase();
  if (/(circuit|electronics|embedded|arduino|robot|sensor|mechanical|fabricat|wood|metal)/.test(text)) return "hardware";
  if (/(art|film|photo|music|theater|design|illustrat|animation|ceramic|fashion)/.test(text)) return "arts";
  if (/(literature|poetry|novel|writing|language|history|archive|oral history)/.test(text)) return "literature";
  if (/(community|civic|neighborhood|mutual aid|organizing|public service)/.test(text)) return "community";
  if (/(business|entrepreneur|venture|marketing|finance|product|customer)/.test(text)) return "venture";
  if (/(environment|climate|ecology|water|air quality|soil|conservation)/.test(text)) return "environment";
  if (/(biology|chemistry|physics|health|medicine|neuro|science|data)/.test(text)) return "science";
  return "general";
}

function fieldPractices(family: DomainFamily) {
  const practices: Record<DomainFamily, string[]> = {
    hardware: ["prototype at safe low voltage", "document iterations with measurements and photos"],
    arts: ["develop through studies or drafts", "show curatorial and production choices"],
    literature: ["work from a bounded corpus", "separate interpretation from unsupported claims"],
    community: ["co-design with affected people", "measure a modest observable outcome"],
    venture: ["test demand before scaling", "keep claims tied to real customer evidence"],
    environment: ["use a repeatable sampling method", "record conditions and limitations"],
    science: ["define variables and controls", "distinguish observation from causation"],
    general: ["prototype the core idea early", "collect observable evidence of success"],
  };
  return practices[family];
}

function safetyConsiderations(raw: Record<string, unknown>, family: DomainFamily) {
  const text = JSON.stringify(raw).toLowerCase();
  const notes: string[] = [];
  if (family === "hardware" || /(tool|solder|electric|mains|battery|laser|machine)/.test(text)) {
    notes.push("Use supervised, low-voltage work; exclude mains electricity and unsafe tool use.");
  }
  if (/(medical|health|patient|diagnos|treatment)/.test(text)) notes.push("Do not provide medical advice or test interventions on people.");
  if (/(survey|interview|human participant|oral history|community)/.test(text)) notes.push("Use informed consent, minimize personal data, and allow participants to withdraw.");
  if (/(chemical|reagent|flame|biohazard)/.test(text)) notes.push("Replace unsupervised chemical or biological work with a safe simulation, public dataset, or supervised protocol.");
  if (notes.length === 0) notes.push("Use ordinary age-appropriate privacy, attribution, and safe-work practices.");
  return notes;
}

function riskFlags(raw: Record<string, unknown>, anchors: string[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (weeklyHours(raw.weekly_time_available) < 3) flags.push("too_little_time");
  if (anchors.length < 2) flags.push("too_vague");
  if (!clean(raw.available_resources) && list(raw.format_preferences).includes("physical")) flags.push("resource_constraint");
  if (difficulty(raw.preferred_challenge, "intermediate") === "advanced" && difficulty(raw.experience_level) === "beginner") flags.push("insufficient_guidance");
  return flags;
}

export function buildGenerationContext(input: { rawIntake: Record<string, unknown> }): GenerationContext {
  const raw = input.rawIntake;
  const anchors = unique([...list(raw.interests), ...list(raw.favorite_subjects), ...list(raw.preference_notes), ...list(raw.existing_skills)]).slice(0, 8);
  const safeAnchors = anchors.length ? anchors : ["student-led project"];
  const family = detectDomainFamily(safeAnchors);
  const open = raw.open_to_anything !== false;
  const formats = open ? [] : list(raw.format_preferences).filter((item) => ["physical", "digital", "investigative", "creative", "community", "venture"].includes(item));
  const resources = clean(raw.available_resources, "Use only tools, materials, facilities, and people the student has explicitly named or can access freely.");
  const constraints = unique([clean(raw.budget_constraints), clean(raw.other_constraints)]).join(" ") || "No additional constraints were stated.";
  const goal = clean(raw.project_goal, "portfolio");
  const success = clean(raw.success_definition, "Finish a concrete artifact and explain the choices behind it.");

  return GenerationContextSchema.parse({
    summary: `Your strongest anchors are ${safeAnchors.slice(0, 3).join(", ")}. Compare distinct ways to turn them into finished, explainable work.`,
    interpreted_interests: safeAnchors,
    skill_assessment: difficulty(raw.experience_level),
    risk_flags: riskFlags(raw, safeAnchors),
    project_context_json: {
      domain_brief: `${safeAnchors.join(", ")} are the project anchors. Preserve their actual field language and practices.`,
      anchor_interests: safeAnchors,
      goal_signal: `Primary goal: ${goal.replace(/_/g, " ")}. The recommendation must support that purpose without inflating claims.`,
      success_definition: success,
      resource_snapshot: resources,
      preferred_formats: formats,
      open_to_anything: open,
      existing_skills: list(raw.existing_skills),
      field_practices: fieldPractices(family),
      scope_risks: ["Adding outputs that do not strengthen the core proof loop", "Assuming access, participants, materials, or expertise the student did not name"],
      safety_ethics_considerations: safetyConsiderations(raw, family),
      anti_generic_warnings: ["Do not silently turn the idea into an app or an academic paper.", "Use concrete artifacts and observable success evidence from the student's actual interests."],
      scope_guardrails: ["Choose one central challenge and a small set of primary artifacts.", "Replace unsafe or inaccessible work with supervised, low-risk, finishable versions."],
      focus_signal: open ? "Make the three directions differ meaningfully in format or approach." : `Stay near these preferences while allowing useful hybrids: ${formats.join(", ")}.`,
      project_goal: goal,
      constraints_summary: constraints,
      weekly_hours: weeklyHours(raw.weekly_time_available),
      completion_date: clean(raw.completion_date) || null,
      preferred_challenge: difficulty(raw.preferred_challenge, "intermediate"),
    },
  });
}

interface StoredGenerationContextRow {
  summary: string;
  interpreted_interests: string[];
  skill_assessment: string;
  risk_flags: string[];
  project_context_json: unknown;
}

export function coerceStoredGenerationContext(row: StoredGenerationContextRow): GenerationContext {
  return GenerationContextSchema.parse({
    summary: row.summary,
    interpreted_interests: row.interpreted_interests,
    skill_assessment: difficulty(row.skill_assessment),
    risk_flags: row.risk_flags,
    project_context_json: row.project_context_json,
  });
}

export function estimateWeeklyHoursFromContext(context: GenerationContext) { return context.project_context_json.weekly_hours; }
export function estimateWeeksFromContext(context: GenerationContext) {
  const base = context.skill_assessment === "advanced" ? 8 : context.skill_assessment === "intermediate" ? 7 : 6;
  return Math.min(12, base + (context.risk_flags.includes("too_little_time") ? 1 : 0));
}
export function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project"; }
export function titleCase(value: string) { return value.split(/\s+/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "); }
export function getPrimaryAnchor(context: GenerationContext) { return titleCase(context.interpreted_interests[0] ?? "Project"); }
export function getDomainFamilyFromContext(context: GenerationContext) { return detectDomainFamily(context.project_context_json.anchor_interests); }
export function hasGrounding(text: string, anchors: string[]) {
  const normalized = text.toLowerCase();
  return anchors.some((anchor) => anchor.toLowerCase().split(/[^a-z0-9]+/).some((token) => token.length > 3 && normalized.includes(token)));
}
