import {
  ResearchGenerationContextSchema,
  SoftwareGenerationContextSchema,
  type GenerationContext,
  type ProjectTrack,
} from "@/lib/ai/schemas";
import { joinSentences } from "@/lib/text/prose";

type RiskFlag =
  | "too_ambitious"
  | "too_vague"
  | "too_advanced"
  | "too_little_time"
  | "misaligned_goal"
  | "insufficient_guidance"
  | "resource_constraint";

type DomainFamily = "hardware" | "photonics" | "security" | "ai" | "systems" | "science" | "general";

const LOW_SIGNAL_PHRASES = new Set([
  "software",
  "software engineering",
  "engineering",
  "technology",
  "tech",
  "research",
  "project",
  "science",
  "computer science",
]);

const LOW_SIGNAL_TOKENS = new Set([
  "a",
  "an",
  "and",
  "app",
  "application",
  "college",
  "data",
  "engineering",
  "for",
  "in",
  "internship",
  "learning",
  "of",
  "portfolio",
  "project",
  "research",
  "science",
  "software",
  "student",
  "students",
  "system",
  "technology",
  "the",
  "tool",
  "workflow",
]);

function normalizePhrase(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueTrimmed(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizePhrase(value)).filter(Boolean)));
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizePhrase(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalizePhrase(item))
      .filter(Boolean);
  }

  return [];
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function buildAntiGenericWarnings(projectTrack: ProjectTrack, rawIntake: Record<string, unknown>) {
  const combined = JSON.stringify(rawIntake);
  const warnings = [
    projectTrack === "research"
      ? "Do not drift into generic student-life, wellness, or study-habit research unless the intake explicitly points there."
      : "Do not drift into generic productivity, student-life, or study assistant apps unless the intake explicitly points there.",
    "Reuse the user's actual domain language, not polished generic framing.",
  ];

  if (!/(student|study|learning|education|wellness|mental health|school|classroom)/i.test(combined)) {
    warnings.push("If student users appear, they must be part of a real domain workflow rather than the default audience.");
  }

  return warnings;
}

function extractAnchorCandidates(rawIntake: Record<string, unknown>) {
  const candidates = uniqueTrimmed([
    ...toStringArray(rawIntake.interests),
    ...toStringArray(rawIntake.favorite_subjects),
    ...toStringArray(rawIntake.preferred_project_style),
    ...toStringArray(rawIntake.preferred_research_domain),
    ...toStringArray(rawIntake.known_tools),
    ...toStringArray(rawIntake.additional_context),
  ]);

  const filtered = candidates.filter((item) => !LOW_SIGNAL_PHRASES.has(item.toLowerCase()));
  return (filtered.length ? filtered : candidates).slice(0, 6);
}

function extractAnchorKeywords(anchors: string[]) {
  return Array.from(
    new Set(
      anchors
        .flatMap((anchor) => anchor.toLowerCase().split(/[^a-z0-9+]+/))
        .filter((token) => token.length >= 2 && !LOW_SIGNAL_TOKENS.has(token)),
    ),
  );
}

function detectDomainFamily(anchors: string[]): DomainFamily {
  const combined = anchors.join(" ").toLowerCase();

  if (/(chip|microarchitecture|computer architecture|fpga|embedded|digital logic|verilog|cpu|cache|rtl)/.test(combined)) {
    return "hardware";
  }

  if (/(photon|waveguide|optics|optical|laser|resonator)/.test(combined)) {
    return "photonics";
  }

  if (/(security|malware|threat|forensic|encryption|auth|cyber)/.test(combined)) {
    return "security";
  }

  if (/(ai|ml|machine learning|llm|nlp|computer vision|neural)/.test(combined)) {
    return "ai";
  }

  if (/(distributed|network|cloud|compiler|systems|operating system|database|infra)/.test(combined)) {
    return "systems";
  }

  if (/(biology|chemistry|physics|health|climate|energy|genomics|public health|economics|finance)/.test(combined)) {
    return "science";
  }

  return "general";
}

function getWeeklyHours(rawIntake: Record<string, unknown>) {
  const value = Number(rawIntake.weekly_time_available ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 6;
}

function coerceSkillAssessment(value: unknown): "beginner" | "intermediate" | "advanced" {
  const raw = String(value ?? "").toLowerCase();

  if (raw.includes("advanced")) {
    return "advanced";
  }

  if (raw.includes("intermediate")) {
    return "intermediate";
  }

  return "beginner";
}

function buildGoalSignal(rawIntake: Record<string, unknown>, projectTrack: ProjectTrack) {
  const targetOutcome = String(rawIntake.target_outcome ?? "portfolio").replace(/_/g, " ");
  const deliverable = String(rawIntake.target_research_deliverable ?? "portfolio entry").replace(/_/g, " ");

  if (projectTrack === "research") {
    return `Deliver a credible research artifact for ${targetOutcome} goals with a polished ${deliverable} and an evidence path you can defend.`;
  }

  return `Ship a concrete software project that is easy to demo, explain, and defend for ${targetOutcome} goals.`;
}

function buildResourceSnapshot(rawIntake: Record<string, unknown>, projectTrack: ProjectTrack, skill: "beginner" | "intermediate" | "advanced") {
  const weeklyHours = getWeeklyHours(rawIntake);
  const constraints = asString(rawIntake.constraints, "").trim();
  const parts = [`${weeklyHours}h/week`, `${skill} experience`];
  const tools = projectTrack === "software" ? toStringArray(rawIntake.known_tools) : [];

  if (tools.length > 0) {
    parts.push(`tools: ${tools.slice(0, 4).join(", ")}`);
  }

  if (projectTrack === "research") {
    parts.push(`method preference: ${String(rawIntake.methodology_preference ?? "data analysis").replace(/_/g, " ")}`);
    const accessDetails = asString(rawIntake.data_or_resource_access, "").trim();
    if (accessDetails) {
      parts.push(`access: ${accessDetails}`);
    }
  }

  if (constraints) {
    parts.push(`constraints: ${constraints}`);
  }

  return `${parts.join("; ")}.`;
}

/**
 * Combines the free-text constraint fields. Both are the user's own words, so
 * they are joined as whole sentences rather than sliced to a character budget —
 * a slice here is stored and later shown, and lands mid-word.
 */
function buildConstraintsSummary(rawIntake: Record<string, unknown>) {
  const constraints = asString(rawIntake.constraints, "").trim();
  const additional = asString(rawIntake.additional_context, "").trim();
  const combined = joinSentences(constraints, additional);

  return combined.length > 0 ? combined : "No major constraints were stated.";
}

function buildSoftwareFocusSignal(rawIntake: Record<string, unknown>, anchors: string[]) {
  const preferredStyle = asString(rawIntake.preferred_project_style, "focused tool");

  return `Aim for a ${preferredStyle} in ${anchors[0] ?? "the user's domain"} with one sharp user workflow.`;
}

function buildResearchFocusSignal(rawIntake: Record<string, unknown>, anchors: string[]) {
  const domain = asString(rawIntake.preferred_research_domain, anchors[0] ?? "the chosen domain");
  const deliverable = String(rawIntake.target_research_deliverable ?? "portfolio_entry").replace(/_/g, " ");

  return `Keep the research question narrow inside ${domain} and oriented toward a believable ${deliverable}.`;
}

function buildResearchReadiness(skill: "beginner" | "intermediate" | "advanced") {
  if (skill === "advanced") {
    return "You can handle a moderately technical method if the scope stays narrow.";
  }

  if (skill === "intermediate") {
    return "You can handle a structured method with a clear procedure, a bounded evidence source, and explicit limitation framing.";
  }

  return "Keep the method simple enough that you can defend each step clearly.";
}

function getRiskFlags(rawIntake: Record<string, unknown>, projectTrack: ProjectTrack, anchors: string[]) {
  const skill = coerceSkillAssessment(projectTrack === "research" ? rawIntake.research_experience : rawIntake.coding_experience);
  const weeklyHours = getWeeklyHours(rawIntake);
  const riskFlags = new Set<RiskFlag>();
  const family = detectDomainFamily(anchors);

  if (anchors.length === 0) {
    riskFlags.add("too_vague");
  }

  if (weeklyHours <= 3) {
    riskFlags.add("too_little_time");
  }

  if (projectTrack === "software") {
    if (skill === "beginner" && (family === "hardware" || family === "photonics")) {
      riskFlags.add("too_advanced");
    }

    if (weeklyHours <= 4 && skill !== "beginner") {
      riskFlags.add("too_ambitious");
    }
  } else {
    if (asString(rawIntake.data_or_resource_access, "").trim().length === 0) {
      riskFlags.add("resource_constraint");
    }
  }

  return Array.from(riskFlags);
}

function buildSoftwareProblemLenses(family: DomainFamily, anchors: string[], rawIntake: Record<string, unknown>) {
  const primaryAnchor = anchors[0]?.toLowerCase() ?? "the domain";
  const targetOutcome = String(rawIntake.target_outcome ?? "portfolio").replace(/_/g, " ");

  const baseLens =
    family === "hardware"
      ? `Translate ${primaryAnchor} tradeoffs into a comparison tool or simulator.`
      : family === "photonics"
        ? `Turn a ${primaryAnchor} modeling or sweep workflow into a usable analysis surface.`
        : family === "security"
          ? `Build a focused ${primaryAnchor} detection, analysis, or audit tool with clear visual output.`
          : family === "ai"
            ? `Create a ${primaryAnchor} evaluation, comparison, or debugging surface with visible results.`
            : `Solve a specific ${primaryAnchor} workflow pain point for one clear user.`;

  const anchorLens = anchors.length >= 2
    ? `Connect ${anchors[0].toLowerCase()} with ${anchors[1].toLowerCase()} in a way that produces a unique, domain-grounded tool.`
    : `Dig deeper into ${primaryAnchor} — find the sub-problem that a generic tool misses.`;

  const outcomeLens =
    targetOutcome === "internship"
      ? "Build something that demonstrates the engineering judgment an interviewer would ask about."
      : targetOutcome === "college apps"
        ? "Produce a project with a clear narrative arc — problem, approach, result — that reads well in an application essay."
        : targetOutcome === "learning"
          ? "Prioritize a project where the student learns a new technique by applying it to their domain."
          : "Prefer tools with visible before-and-after value that photograph well in a portfolio.";

  return [baseLens, anchorLens, outcomeLens].slice(0, 3);
}

function buildSoftwareContext(rawIntake: Record<string, unknown>) {
  const anchors = extractAnchorCandidates(rawIntake);
  const interpretedInterests = anchors.length ? anchors : ["software engineering"];
  const family = detectDomainFamily(interpretedInterests);
  const skill = coerceSkillAssessment(rawIntake.coding_experience);
  const riskFlags = getRiskFlags(rawIntake, "software", interpretedInterests);
  const weeklyHours = getWeeklyHours(rawIntake);
  const targetOutcome = String(rawIntake.target_outcome ?? "portfolio").replace(/_/g, " ");

  return SoftwareGenerationContextSchema.parse({
    project_track: "software",
    summary: `Your strongest anchors are ${interpretedInterests.slice(0, 3).join(", ")}. Keep the project narrow, grounded in that domain, and easy to demo.`,
    interpreted_interests: interpretedInterests,
    skill_assessment: skill,
    risk_flags: riskFlags,
    track_payload_json: {
      domain_brief: `${interpretedInterests.join(", ")} are the core domain anchors. Stay in that domain and avoid generic default app ideas.`,
      anchor_interests: interpretedInterests,
      goal_signal: buildGoalSignal(rawIntake, "software"),
      resource_snapshot: buildResourceSnapshot(rawIntake, "software", skill),
      anti_generic_warnings: buildAntiGenericWarnings("software", rawIntake),
      scope_guardrails: [
        "Center the MVP on one user and one end-to-end workflow.",
        "Cut integrations or automation that do not improve the first demo.",
      ],
      focus_signal: buildSoftwareFocusSignal(rawIntake, interpretedInterests),
      target_outcome: targetOutcome,
      constraints_summary: buildConstraintsSummary(rawIntake),
      weekly_hours: weeklyHours,
      project_style_fit: asString(rawIntake.preferred_project_style, "focused software tool"),
      problem_lenses: buildSoftwareProblemLenses(family, interpretedInterests, rawIntake),
      delivery_bias:
        skill === "beginner"
          ? "Favor a narrow tool with one useful output."
          : "Favor a scoped product with one defensible workflow and a strong demo path.",
    },
  });
}

function buildResearchMethodPool(methodPreference: string, family: DomainFamily): [string, string] {
  if (methodPreference === "experiment") {
    if (family === "ai") return ["controlled prompt or model comparison study", "small A/B test on model outputs"];
    if (family === "science") return ["small controlled lab or field experiment", "simulation-backed comparison study"];
    return ["small controlled experiment", "simulation-backed comparison"];
  }

  if (methodPreference === "survey based") {
    if (family === "science") return ["structured expert interview with coding", "domain-specific survey instrument"];
    return ["focused survey with structured instrument", "survey with lightweight secondary analysis"];
  }

  if (methodPreference === "literature review") {
    if (family === "ai") return ["systematic review of recent model evaluations", "scoped literature synthesis with gap analysis"];
    return ["focused systematic review", "structured literature synthesis"];
  }

  if (family === "ai") return ["secondary dataset or benchmark analysis", "comparative model evaluation on curated inputs"];
  if (family === "science") return ["secondary dataset analysis with domain-specific variables", "focused observational comparison"];
  return ["secondary data analysis", "focused literature review"];
}

function buildResearchContext(rawIntake: Record<string, unknown>) {
  const anchors = extractAnchorCandidates(rawIntake);
  const interpretedInterests = anchors.length ? anchors : ["applied research"];
  const skill = coerceSkillAssessment(rawIntake.research_experience);
  const riskFlags = getRiskFlags(rawIntake, "research", interpretedInterests);
  const weeklyHours = getWeeklyHours(rawIntake);
  const targetOutcome = String(rawIntake.target_outcome ?? "portfolio").replace(/_/g, " ");
  const methodPreference = String(rawIntake.methodology_preference ?? "data_analysis").replace(/_/g, " ");
  const family = detectDomainFamily(interpretedInterests);

  return ResearchGenerationContextSchema.parse({
    project_track: "research",
    summary: `Your strongest anchors are ${interpretedInterests.slice(0, 3).join(", ")}. Keep the question believable, evidence-based, and tightly scoped.`,
    interpreted_interests: interpretedInterests,
    skill_assessment: skill,
    risk_flags: riskFlags,
    track_payload_json: {
      domain_brief: `${interpretedInterests.join(", ")} are the core domain anchors. Keep the project inside that domain with one narrow question and one believable evidence path.`,
      anchor_interests: interpretedInterests,
      goal_signal: buildGoalSignal(rawIntake, "research"),
      resource_snapshot: buildResourceSnapshot(rawIntake, "research", skill),
      anti_generic_warnings: buildAntiGenericWarnings("research", rawIntake),
      scope_guardrails: [
        "Choose one primary question and one primary evidence source.",
        "State the limitation note early so the project stays believable.",
      ],
      focus_signal: buildResearchFocusSignal(rawIntake, interpretedInterests),
      target_outcome: targetOutcome,
      constraints_summary: buildConstraintsSummary(rawIntake),
      weekly_hours: weeklyHours,
      research_readiness: buildResearchReadiness(skill),
      methodology_guidance: `Preferred method is ${methodPreference}. Choose the cleanest evidence path that matches the student's actual access.`,
      viable_methodologies: buildResearchMethodPool(methodPreference, family),
    },
  });
}

export function buildGenerationContext(input: {
  projectTrack: ProjectTrack;
  rawIntake: Record<string, unknown>;
}): GenerationContext {
  return input.projectTrack === "research" ? buildResearchContext(input.rawIntake) : buildSoftwareContext(input.rawIntake);
}

interface StoredGenerationContextRow {
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

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function coerceStoredGenerationContext(row: StoredGenerationContextRow): GenerationContext {
  const projectTrack = asProjectTrack(row.project_track);
  const interpretedInterests = row.interpreted_interests?.length
    ? row.interpreted_interests
    : [projectTrack === "research" ? "applied research" : "software engineering"];
  const rawPayload = row.track_payload_json && typeof row.track_payload_json === "object"
    ? (row.track_payload_json as Record<string, unknown>)
    : {};

  if (projectTrack === "research") {
    return ResearchGenerationContextSchema.parse({
      project_track: "research",
      summary: asString(row.summary, `Your anchors: ${interpretedInterests.slice(0, 3).join(", ")}.`),
      interpreted_interests: interpretedInterests,
      skill_assessment: coerceSkillAssessment(row.skill_assessment),
      risk_flags: asRiskFlags(row.risk_flags),
      track_payload_json: {
        domain_brief: asString(rawPayload.domain_brief, `${interpretedInterests.join(", ")} are the core domain anchors.`),
        anchor_interests: asStringArray(rawPayload.anchor_interests).length ? asStringArray(rawPayload.anchor_interests) : interpretedInterests,
        goal_signal: asString(rawPayload.goal_signal, "Deliver a credible research artifact."),
        resource_snapshot: asString(rawPayload.resource_snapshot, "Use realistic student resources and time."),
        anti_generic_warnings: asStringArray(rawPayload.anti_generic_warnings).length
          ? asStringArray(rawPayload.anti_generic_warnings)
          : buildAntiGenericWarnings("research", {}),
        scope_guardrails: asStringArray(rawPayload.scope_guardrails).length
          ? asStringArray(rawPayload.scope_guardrails)
          : ["Choose one question", "Choose one evidence source"],
        focus_signal: asString(rawPayload.focus_signal, "Keep the question narrow and believable."),
        target_outcome: asString(rawPayload.target_outcome, "portfolio"),
        constraints_summary: asString(rawPayload.constraints_summary, "No major constraints were stated."),
        weekly_hours: asNumber(rawPayload.weekly_hours, 6),
        research_readiness: asString(rawPayload.research_readiness, "Keep the methodology simple and defensible."),
        methodology_guidance: asString(
          rawPayload.methodology_guidance ?? rawPayload.mentor_resource_notes,
          "Choose the cleanest method and evidence path the student can defend.",
        ),
        viable_methodologies: asStringArray(rawPayload.viable_methodologies).length
          ? asStringArray(rawPayload.viable_methodologies)
          : ["secondary data analysis", "focused literature review"],
      },
    });
  }

  return SoftwareGenerationContextSchema.parse({
    project_track: "software",
    summary: asString(row.summary, `Your anchors: ${interpretedInterests.slice(0, 3).join(", ")}.`),
    interpreted_interests: interpretedInterests,
    skill_assessment: coerceSkillAssessment(row.skill_assessment),
    risk_flags: asRiskFlags(row.risk_flags),
    track_payload_json: {
      domain_brief: asString(rawPayload.domain_brief, `${interpretedInterests.join(", ")} are the core domain anchors.`),
      anchor_interests: asStringArray(rawPayload.anchor_interests).length ? asStringArray(rawPayload.anchor_interests) : interpretedInterests,
      goal_signal: asString(rawPayload.goal_signal, "Ship a concrete software project."),
      resource_snapshot: asString(rawPayload.resource_snapshot, "Use realistic student time and tools."),
      anti_generic_warnings: asStringArray(rawPayload.anti_generic_warnings).length
        ? asStringArray(rawPayload.anti_generic_warnings)
        : buildAntiGenericWarnings("software", {}),
      scope_guardrails: asStringArray(rawPayload.scope_guardrails).length
        ? asStringArray(rawPayload.scope_guardrails)
        : ["Keep the MVP narrow", "Cut optional integrations"],
      focus_signal: asString(rawPayload.focus_signal, "Focus on one user workflow."),
      target_outcome: asString(rawPayload.target_outcome, "portfolio"),
      constraints_summary: asString(rawPayload.constraints_summary, "No major constraints were stated."),
      weekly_hours: asNumber(rawPayload.weekly_hours, 6),
      project_style_fit: asString(rawPayload.project_style_fit, "focused software tool"),
      problem_lenses: asStringArray(rawPayload.problem_lenses).length
        ? asStringArray(rawPayload.problem_lenses)
        : ["Solve a real workflow pain point", "Prefer visible before-and-after value"],
      delivery_bias: asString(rawPayload.delivery_bias, "Favor a scoped, demoable tool."),
    },
  });
}

export function estimateWeeklyHoursFromContext(context: GenerationContext) {
  return context.track_payload_json.weekly_hours;
}

export function estimateWeeksFromContext(context: GenerationContext) {
  let weeks = context.skill_assessment === "advanced" ? 8 : context.skill_assessment === "intermediate" ? 7 : 6;

  if (context.risk_flags.includes("too_little_time")) {
    weeks += 1;
  }

  if (context.risk_flags.includes("too_ambitious")) {
    weeks += 1;
  }

  return Math.min(12, weeks);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

export function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getPrimaryAnchor(context: GenerationContext) {
  return titleCase(context.interpreted_interests[0] ?? "Domain");
}

export function getDomainFamilyFromContext(context: GenerationContext) {
  return detectDomainFamily(context.track_payload_json.anchor_interests);
}

export function hasGrounding(text: string, anchors: string[]) {
  const normalized = text.toLowerCase();
  if (anchors.some((anchor) => normalized.includes(anchor.toLowerCase()))) {
    return true;
  }

  return extractAnchorKeywords(anchors).some((token) => normalized.includes(token));
}
