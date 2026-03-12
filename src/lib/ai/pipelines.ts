import {
  buildNormalizeSystemPrompt,
  buildNormalizeUserPrompt,
  buildRecommendationsSystemPrompt,
  buildRecommendationsUserPrompt,
  buildRoadmapSystemPrompt,
  buildRoadmapUserPrompt,
} from "@/lib/ai/prompts";
import { generateStructuredOutput } from "@/lib/ai/client";
import {
  RecommendationBatchSchema,
  ResearchNormalizedProfileSchema,
  ResearchRoadmapSchema,
  SoftwareNormalizedProfileSchema,
  SoftwareRoadmapSchema,
  type NormalizedProfile,
  type ProjectTrack,
  type RecommendationBatch,
  type Roadmap,
} from "@/lib/ai/schemas";

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

const STUDENT_THEME_PATTERNS = [
  /student[-\s]?life/i,
  /study habit/i,
  /well[-\s]?being/i,
  /wellness/i,
  /productivity app/i,
  /study assistant/i,
  /campus/i,
  /academic success/i,
];

const GENERIC_MILESTONE_TITLES = new Set([
  "foundation setup",
  "core workflow",
  "insight layer",
  "polish and packaging",
  "question + scope lock",
  "method design",
  "execution + analysis",
  "deliverables + positioning",
  "research your topic",
  "build the project",
  "refine and present",
]);

const ARTIFACT_PATTERN = /\b(schema|endpoint|table|dashboard|simulator|benchmark|trace|dataset|notebook|figure|poster|paper|abstract|prototype|script|analysis|survey|protocol|readme|deployment|test|demo|report|visualization|model|experiment)\b/i;

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

function normalizePhrase(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueTrimmed(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizePhrase(value)).filter(Boolean)));
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractAnchorCandidates(rawIntake: Record<string, unknown>) {
  const candidates = uniqueTrimmed([
    ...toStringArray(rawIntake.interests),
    ...toStringArray(rawIntake.favorite_subjects),
    ...toStringArray(rawIntake.preferred_project_style),
    ...toStringArray(rawIntake.preferred_research_domain),
    ...toStringArray(rawIntake.known_tools),
    ...toStringArray(rawIntake.research_tools_or_resources),
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

function hasGrounding(text: string, anchors: string[]) {
  const normalized = text.toLowerCase();
  if (anchors.some((anchor) => normalized.includes(anchor.toLowerCase()))) {
    return true;
  }

  return extractAnchorKeywords(anchors).some((token) => normalized.includes(token));
}

function studentThemesAllowed(text: string) {
  return /(student|study|learning|education|wellness|mental health|school|classroom)/i.test(text);
}

function containsBlockedTheme(text: string, allowStudentThemes: boolean) {
  if (allowStudentThemes) {
    return false;
  }

  return STUDENT_THEME_PATTERNS.some((pattern) => pattern.test(text));
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
  const targets = toStringArray(rawIntake.target_schools_or_companies).slice(0, 2);
  const deliverable = String(rawIntake.target_research_deliverable ?? "portfolio entry").replace(/_/g, " ");

  if (projectTrack === "research") {
    return targets.length > 0
      ? `Produce a research deliverable that feels credible for ${targetOutcome} goals and strong enough to discuss around ${targets.join(" and ")}.`
      : `Produce a research deliverable that feels credible for ${targetOutcome} goals, with a polished ${deliverable} at the end.`;
  }

  return targets.length > 0
    ? `Ship a concrete software project that demonstrates strong judgment for ${targetOutcome} goals and would feel believable to ${targets.join(" and ")}.`
    : `Ship a concrete software project that is easy to demo, explain, and defend for ${targetOutcome} goals.`;
}

function buildResourceSnapshot(rawIntake: Record<string, unknown>, projectTrack: ProjectTrack, skill: "beginner" | "intermediate" | "advanced") {
  const weeklyHours = getWeeklyHours(rawIntake);
  const constraints = String(rawIntake.constraints ?? "").trim();
  const tools = projectTrack === "research" ? toStringArray(rawIntake.research_tools_or_resources) : toStringArray(rawIntake.known_tools);
  const mentorAccess = String(rawIntake.mentor_access ?? "limited");
  const parts = [`About ${weeklyHours} hours per week`, `${skill} experience`];

  if (tools.length > 0) {
    parts.push(`available tools include ${tools.slice(0, 4).join(", ")}`);
  }

  if (projectTrack === "research") {
    parts.push(`mentor access is ${mentorAccess}`);
  }

  if (constraints) {
    parts.push(`constraints: ${constraints}`);
  }

  return `${parts.join("; ")}.`;
}

function buildAntiGenericWarnings(projectTrack: ProjectTrack, rawIntake: Record<string, unknown>) {
  const combined = JSON.stringify(rawIntake);
  const warnings = [
    projectTrack === "research"
      ? "Do not switch the topic to vague student-life or wellness research unless the intake explicitly asks for it."
      : "Do not switch the topic to a study assistant or generic productivity app unless the intake explicitly asks for it.",
    "Keep the title, summary, and milestones anchored to the user's real domain language.",
  ];

  if (!studentThemesAllowed(combined)) {
    warnings.push("If student users appear, they must be part of a real domain workflow rather than the default audience.");
  }

  return warnings;
}

function softwareDifficulty(skill: "beginner" | "intermediate" | "advanced") {
  if (skill === "advanced") {
    return "intermediate_advanced" as const;
  }

  if (skill === "intermediate") {
    return "intermediate" as const;
  }

  return "beginner_intermediate" as const;
}

function researchDifficulty(skill: "beginner" | "intermediate" | "advanced") {
  if (skill === "advanced") {
    return "intermediate_advanced" as const;
  }

  if (skill === "intermediate") {
    return "intermediate" as const;
  }

  return "beginner_intermediate" as const;
}

function estimateWeeklyHoursFromProfile(profile: NormalizedProfile) {
  if (profile.risk_flags.includes("too_little_time")) {
    return 4;
  }

  return profile.skill_assessment === "advanced" ? 8 : profile.skill_assessment === "intermediate" ? 7 : 6;
}

function estimateWeeksFromProfile(profile: NormalizedProfile) {
  let weeks = profile.skill_assessment === "advanced" ? 9 : profile.skill_assessment === "intermediate" ? 8 : 7;

  if (profile.risk_flags.includes("too_little_time")) {
    weeks += 1;
  }

  if (profile.risk_flags.includes("too_ambitious")) {
    weeks += 1;
  }

  return Math.min(12, weeks);
}

function finishabilityScore(profile: NormalizedProfile) {
  let score = 9;

  if (profile.risk_flags.includes("too_little_time")) {
    score -= 2;
  }

  if (profile.risk_flags.includes("too_ambitious")) {
    score -= 1;
  }

  if (profile.risk_flags.includes("too_advanced")) {
    score -= 1;
  }

  return Math.max(6, score);
}

function impressivenessScoreForFamily(family: DomainFamily) {
  return family === "hardware" || family === "photonics" || family === "systems" ? 9 : family === "security" || family === "ai" ? 8 : 7;
}

function buildSoftwareNormalizedPayload(rawIntake: Record<string, unknown>, anchors: string[], skill: "beginner" | "intermediate" | "advanced") {
  const preferredStyle = String(rawIntake.preferred_project_style ?? "focused software tool").trim();
  const family = detectDomainFamily(anchors);

  return {
    domain_brief: `${anchors.join(", ")} are the strongest domain anchors. The software project should stay inside that domain, solve a real workflow or analysis problem, and avoid generic student-life framing.`,
    anchor_interests: anchors,
    goal_signal: buildGoalSignal(rawIntake, "software"),
    resource_snapshot: buildResourceSnapshot(rawIntake, "software", skill),
    anti_generic_warnings: buildAntiGenericWarnings("software", rawIntake),
    project_style_fit: `A ${preferredStyle || "focused software tool"} is a strong fit if it proves one end-to-end workflow in ${anchors[0] ?? "the user's domain"}.`,
    scope_guardrails: [
      "Keep the MVP centered on one primary workflow with one user type.",
      "Cut integrations and advanced automation if they do not improve the first demo.",
    ],
    problem_lenses:
      family === "hardware"
        ? ["Translate domain tradeoffs into a simulator or analysis interface.", "Make technical outputs easy to compare with benchmark-style inputs."]
        : family === "photonics"
          ? ["Turn parameter sweeps or simulated device behavior into a usable analysis tool.", "Focus on one concrete modeling or comparison workflow."]
          : ["Solve a domain-specific workflow pain point for a clearly defined user.", "Prefer measurable outputs over broad feature lists."],
    delivery_bias:
      skill === "beginner"
        ? "Favor a narrow web or script-based tool with one useful output and a clean demo path."
        : "Favor a tool or analysis product with one sharp workflow, one defensible data model, and a strong demo narrative.",
  };
}

function buildResearchNormalizedPayload(rawIntake: Record<string, unknown>, anchors: string[], skill: "beginner" | "intermediate" | "advanced") {
  const methodPreference = String(rawIntake.methodology_preference ?? "data_analysis").replace(/_/g, " ");

  return {
    domain_brief: `${anchors.join(", ")} are the strongest domain anchors. The research project should ask one real question in that domain, identify a believable evidence plan, and avoid generic student-life framing unless explicitly requested.`,
    anchor_interests: anchors,
    goal_signal: buildGoalSignal(rawIntake, "research"),
    resource_snapshot: buildResourceSnapshot(rawIntake, "research", skill),
    anti_generic_warnings: buildAntiGenericWarnings("research", rawIntake),
    research_readiness:
      skill === "advanced"
        ? "The student can handle a moderately technical method if the question stays narrow and the evidence plan is accessible."
        : "The project should stay narrow enough that method quality and limitation framing remain strong.",
    scope_guardrails: [
      "Choose one primary question and one primary evidence source.",
      "Write the limitation note early so the scope stays believable.",
    ],
    mentor_resource_notes: `Preferred method is ${methodPreference}. Use mentor or teacher time for method review, feasibility checks, and interpretation feedback if available.`,
    viable_methodologies:
      methodPreference === "experiment"
        ? ["small controlled experiment", "simulation-backed comparison"]
        : methodPreference === "survey based"
          ? ["focused survey", "survey plus lightweight secondary analysis"]
          : ["secondary data analysis", "focused literature review"],
  };
}

function fallbackSoftwareNormalizedProfile(rawIntake: Record<string, unknown>): NormalizedProfile {
  const interpretedInterests = extractAnchorCandidates(rawIntake);
  const skill = coerceSkillAssessment(rawIntake.coding_experience);
  const weeklyHours = getWeeklyHours(rawIntake);
  const preferredDifficulty = String(rawIntake.preferred_difficulty ?? "").toLowerCase();
  const riskFlags = new Set<RiskFlag>();

  if (interpretedInterests.length === 0) {
    riskFlags.add("too_vague");
  }

  if (weeklyHours <= 3) {
    riskFlags.add("too_little_time");
  }

  if (skill === "beginner" && preferredDifficulty.includes("advanced")) {
    riskFlags.add("too_advanced");
  }

  if (weeklyHours <= 4 && (preferredDifficulty.includes("intermediate") || preferredDifficulty.includes("advanced"))) {
    riskFlags.add("too_ambitious");
  }

  const anchors = interpretedInterests.length ? interpretedInterests : ["software engineering"];

  return SoftwareNormalizedProfileSchema.parse({
    project_track: "software",
    summary: `The strongest software anchors are ${anchors.slice(0, 3).join(", ")}. The project should solve a concrete problem inside that domain with a narrow MVP and no default drift into generic student-life tooling.`,
    interpreted_interests: anchors,
    skill_assessment: skill,
    risk_flags: Array.from(riskFlags),
    track_payload_json: buildSoftwareNormalizedPayload(rawIntake, anchors, skill),
  });
}

function fallbackResearchNormalizedProfile(rawIntake: Record<string, unknown>): NormalizedProfile {
  const interpretedInterests = extractAnchorCandidates(rawIntake);
  const skill = coerceSkillAssessment(rawIntake.research_experience);
  const weeklyHours = getWeeklyHours(rawIntake);
  const mentorAccess = String(rawIntake.mentor_access ?? "limited").toLowerCase();
  const riskFlags = new Set<RiskFlag>();

  if (interpretedInterests.length === 0) {
    riskFlags.add("too_vague");
  }

  if (weeklyHours <= 3) {
    riskFlags.add("too_little_time");
  }

  if (mentorAccess === "none") {
    riskFlags.add("insufficient_guidance");
  }

  if (String(rawIntake.data_or_resource_access ?? "").trim().length === 0) {
    riskFlags.add("resource_constraint");
  }

  const anchors = interpretedInterests.length ? interpretedInterests : ["applied research"];

  return ResearchNormalizedProfileSchema.parse({
    project_track: "research",
    summary: `The strongest research anchors are ${anchors.slice(0, 3).join(", ")}. The project should define one believable question in that domain with a feasible evidence plan and no default drift into generic student-life themes.`,
    interpreted_interests: anchors,
    skill_assessment: skill,
    risk_flags: Array.from(riskFlags),
    track_payload_json: buildResearchNormalizedPayload(rawIntake, anchors, skill),
  });
}

function getProfileAnchors(profile: NormalizedProfile) {
  const anchors = profile.track_payload_json.anchor_interests ?? [];
  return uniqueTrimmed([...(anchors.length ? anchors : []), ...profile.interpreted_interests]).slice(0, 6);
}

function validateNormalizedProfile(profile: NormalizedProfile) {
  const anchors = getProfileAnchors(profile);
  const payloadText = JSON.stringify(profile.track_payload_json);
  const combined = `${profile.summary} ${payloadText}`;
  const allowStudentThemes = studentThemesAllowed(combined);
  const issues: string[] = [];

  if (anchors.length === 0) {
    issues.push("Provide at least one clear anchor interest.");
  }

  if (!hasGrounding(combined, anchors)) {
    issues.push("The normalized profile is not clearly grounded in the anchor interests.");
  }

  if (containsBlockedTheme(combined, allowStudentThemes)) {
    issues.push("The normalized profile drifts into blocked default themes without support from the intake.");
  }

  if ((profile.track_payload_json.anti_generic_warnings ?? []).length < 2) {
    issues.push("Include stronger anti-generic warnings.");
  }

  if (profile.project_track === "software") {
    if (profile.track_payload_json.problem_lenses.length < 2) {
      issues.push("Software profile needs clearer problem lenses.");
    }
  } else if (profile.track_payload_json.viable_methodologies.length < 2) {
    issues.push("Research profile needs clearer viable methodologies.");
  }

  return issues;
}

function getSoftwareRecommendationPayload(recommendation: Record<string, unknown>) {
  const payload = asRecord(recommendation.track_payload_json);
  return {
    target_user: asString(payload.target_user, "a clearly defined niche user"),
    problem_statement: asString(payload.problem_statement, "solve one real problem in the user's stated domain"),
    core_workflow: asString(payload.core_workflow, "take one key input and produce one useful output"),
    mvp_boundary: asString(payload.mvp_boundary, "ship one narrow workflow and cut everything else"),
    validation_plan: asString(payload.validation_plan, "test the workflow with a small real scenario"),
  };
}

function getResearchRecommendationPayload(recommendation: Record<string, unknown>) {
  const payload = asRecord(recommendation.track_payload_json);
  return {
    research_question: asString(payload.research_question ?? payload.research_question_or_hypothesis, "Define one concrete research question."),
    hypothesis_or_focus: asString(payload.hypothesis_or_focus, "Focus on one comparison or measurable relationship."),
    methodology: asString(payload.methodology, "Use one clear, feasible primary method."),
    evidence_or_data_plan: asString(payload.evidence_or_data_plan, "Use one accessible data or evidence source."),
    scope_boundaries: asString(payload.scope_boundaries, "Limit the scope to one question and one evidence source."),
    limitation_note: asString(payload.limitation_note, "State the main limitation clearly and early."),
  };
}

function validateRecommendationBatch(batch: RecommendationBatch, profile: NormalizedProfile) {
  const anchors = getProfileAnchors(profile);
  const allowStudentThemes = studentThemesAllowed(JSON.stringify(profile));
  const titles = new Set<string>();
  const issues: string[] = [];

  batch.recommendations.forEach((recommendation, index) => {
    const recommendationText = `${recommendation.title} ${recommendation.summary} ${recommendation.rationale} ${JSON.stringify(recommendation.track_payload_json)}`;

    if (titles.has(recommendation.title.toLowerCase())) {
      issues.push(`Recommendation ${index + 1} duplicates another title.`);
    }
    titles.add(recommendation.title.toLowerCase());

    if (!hasGrounding(recommendationText, anchors)) {
      issues.push(`Recommendation ${index + 1} is not grounded in the user's stated interests.`);
    }

    if (containsBlockedTheme(recommendationText, allowStudentThemes)) {
      issues.push(`Recommendation ${index + 1} drifts into blocked default themes.`);
    }

    if (profile.project_track === "software") {
      const payload = getSoftwareRecommendationPayload(recommendation as unknown as Record<string, unknown>);
      if (/student/i.test(payload.target_user) && !allowStudentThemes) {
        issues.push(`Recommendation ${index + 1} defaults to students as the user without support from the profile.`);
      }

      if (payload.problem_statement.length < 25 || payload.core_workflow.length < 25 || payload.mvp_boundary.length < 25) {
        issues.push(`Recommendation ${index + 1} needs a more concrete software payload.`);
      }
    } else {
      const payload = getResearchRecommendationPayload(recommendation as unknown as Record<string, unknown>);
      if (payload.research_question.length < 25 || payload.methodology.length < 20 || payload.evidence_or_data_plan.length < 20) {
        issues.push(`Recommendation ${index + 1} needs a more concrete research payload.`);
      }
    }
  });

  return issues;
}

function validateRoadmap(roadmap: Roadmap, profile: NormalizedProfile) {
  const anchors = getProfileAnchors(profile);
  const allowStudentThemes = studentThemesAllowed(JSON.stringify(profile));
  const issues: string[] = [];
  const roadmapText = `${roadmap.overview} ${roadmap.mvp_scope} ${JSON.stringify(roadmap.track_payload_json)}`;

  if (!hasGrounding(roadmapText, anchors)) {
    issues.push("Roadmap overview and scope are not clearly grounded in the project domain.");
  }

  if (containsBlockedTheme(roadmapText, allowStudentThemes)) {
    issues.push("Roadmap drifts into blocked default themes.");
  }

  if (roadmap.milestones.length < 4 || roadmap.milestones.length > 6) {
    issues.push("Roadmap should include 4 to 6 milestones.");
  }

  roadmap.milestones.forEach((milestone, index) => {
    if (GENERIC_MILESTONE_TITLES.has(milestone.title.toLowerCase())) {
      issues.push(`Milestone ${index + 1} uses a generic title.`);
    }

    if (!ARTIFACT_PATTERN.test(milestone.description) && !hasGrounding(milestone.description, anchors)) {
      issues.push(`Milestone ${index + 1} does not name a concrete deliverable or project-specific artifact.`);
    }
  });

  if (roadmap.project_track === "software") {
    if (roadmap.track_payload_json.ship_criteria.length < 2) {
      issues.push("Software roadmap needs concrete ship criteria.");
    }
  } else if (roadmap.track_payload_json.step_by_step_plan.length < 4) {
    issues.push("Research roadmap needs a clearer step-by-step plan.");
  }

  return issues;
}

function makeSoftwareRecommendation(input: {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  targetUser: string;
  problemStatement: string;
  coreWorkflow: string;
  mvpBoundary: string;
  validationPlan: string;
  toolsNeeded: string[];
  skills: string[];
  difficulty: ReturnType<typeof softwareDifficulty>;
  estimatedWeeks: number;
  weeklyHours: number;
  impressivenessScore: number;
  finishabilityScore: number;
  authenticityNote: string;
}) {
  return {
    id: input.id,
    project_track: "software" as const,
    title: input.title,
    summary: input.summary,
    rationale: input.rationale,
    difficulty: input.difficulty,
    estimated_weeks: input.estimatedWeeks,
    weekly_hours: input.weeklyHours,
    skills_demonstrated: input.skills,
    tools_needed: input.toolsNeeded,
    impressiveness_score: input.impressivenessScore,
    finishability_score: input.finishabilityScore,
    authenticity_note: input.authenticityNote,
    track_payload_json: {
      target_user: input.targetUser,
      problem_statement: input.problemStatement,
      core_workflow: input.coreWorkflow,
      mvp_boundary: input.mvpBoundary,
      validation_plan: input.validationPlan,
    },
  };
}

function makeResearchRecommendation(input: {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  researchQuestion: string;
  hypothesisOrFocus: string;
  methodology: string;
  evidencePlan: string;
  scopeBoundaries: string;
  limitationNote: string;
  toolsNeeded: string[];
  skills: string[];
  difficulty: ReturnType<typeof researchDifficulty>;
  estimatedWeeks: number;
  weeklyHours: number;
  impressivenessScore: number;
  finishabilityScore: number;
  authenticityNote: string;
}) {
  return {
    id: input.id,
    project_track: "research" as const,
    title: input.title,
    summary: input.summary,
    rationale: input.rationale,
    difficulty: input.difficulty,
    estimated_weeks: input.estimatedWeeks,
    weekly_hours: input.weeklyHours,
    skills_demonstrated: input.skills,
    tools_needed: input.toolsNeeded,
    impressiveness_score: input.impressivenessScore,
    finishability_score: input.finishabilityScore,
    authenticity_note: input.authenticityNote,
    track_payload_json: {
      research_question: input.researchQuestion,
      hypothesis_or_focus: input.hypothesisOrFocus,
      methodology: input.methodology,
      evidence_or_data_plan: input.evidencePlan,
      scope_boundaries: input.scopeBoundaries,
      limitation_note: input.limitationNote,
    },
  };
}

function getSoftwareFamilyRecipe(family: DomainFamily, primary: string) {
  switch (family) {
    case "hardware":
      return {
        targetUser: "hardware students or hobbyists exploring architecture tradeoffs",
        artifacts: ["Microarchitecture Explorer", "Trace Workbench", "Verification Dashboard"],
        problem: "compare architecture tradeoffs without heavy tooling or scattered notes",
        workflows: [
          "configure a simplified architecture, run benchmark traces, and compare performance outputs",
          "ingest a trace, label the bottleneck pattern, and export a side-by-side report",
          "track failing cases, expected outputs, and unresolved regressions in one review surface",
        ],
        mvp: [
          "support one simplified architecture model, one trace set, and one comparison dashboard",
          "support one trace format, one annotation flow, and one exportable report",
          "support manual case entry, status tracking, and one regression review view",
        ],
        validation: [
          "compare the output trends with textbook expectations and a few benchmark cases",
          "test the reporting flow against hand-worked trace examples",
          "seed the dashboard with realistic verification cases and confirm it improves review clarity",
        ],
        tools: ["Next.js", "TypeScript", "Python or Rust", "Charts"],
        skills: ["Systems modeling", "Performance analysis", "Domain translation", "Product scoping"],
      };
    case "photonics":
      return {
        targetUser: "students comparing photonic device parameter choices",
        artifacts: ["Parameter Sweep Studio", "Mode Comparison Dashboard", "Design Notebook"],
        problem: "turn raw photonics simulations into understandable design comparisons",
        workflows: [
          "run a small parameter sweep and compare response curves in one place",
          "import simulation outputs and align a few key metrics across device variants",
          "record assumptions, simulation runs, and design decisions in one technical notebook",
        ],
        mvp: [
          "support one device family, one sweep workflow, and one comparison view",
          "support one import format and one metric dashboard",
          "support one project workspace, one run log format, and one comparison screen",
        ],
        validation: [
          "check whether known parameter changes produce the expected trend in the dashboard",
          "test the import and comparison flow on two or three real simulation outputs",
          "populate the notebook with real iterations and confirm it explains why the final choice was made",
        ],
        tools: ["Next.js", "TypeScript", "Python", "Plotting library"],
        skills: ["Scientific tooling", "Visualization", "Documentation", "Scope management"],
      };
    case "security":
      return {
        targetUser: "small security teams or student researchers reviewing repeat artifacts",
        artifacts: ["Threat Triage Console", "Misconfiguration Scanner", "Review Dashboard"],
        problem: "organize evidence and decisions for a recurring security workflow without generic SOC bloat",
        workflows: [
          "ingest one artifact type, tag the indicators, and log the next triage step",
          "check one configuration family against transparent rules and explain each finding",
          "track evidence, unresolved questions, and follow-up checks across a small case set",
        ],
        mvp: [
          "support one artifact type, one rule set, and one exportable triage view",
          "support one configuration family and a short list of transparent rules",
          "support a small case list, evidence notes, and review statuses",
        ],
        validation: [
          "test the workflow on a curated benign-versus-suspicious sample set",
          "run the rules against known safe and unsafe examples",
          "seed the dashboard with realistic cases and confirm it improves review consistency",
        ],
        tools: ["Next.js", "TypeScript", "Supabase", "Zod"],
        skills: ["Security reasoning", "Workflow design", "Case modeling", "Communication"],
      };
    default:
      return {
        targetUser: `people working on recurring ${primary.toLowerCase()} tasks`,
        artifacts: ["Workflow Analyzer", "Comparison Lab", "Decision Support Tool"],
        problem: `structure one recurring ${primary.toLowerCase()} problem instead of relying on ad hoc notes or spreadsheets`,
        workflows: [
          `capture one key ${primary.toLowerCase()} input and produce one useful domain-specific output`,
          `compare a small set of ${primary.toLowerCase()} options with a transparent rubric`,
          `turn messy ${primary.toLowerCase()} inputs into one recommended next step with explanation`,
        ],
        mvp: [
          "support one user type, one workflow, and one meaningful output",
          "support one comparison rubric and one exportable result view",
          "support one decision type and one explanation output",
        ],
        validation: [
          `test the workflow on a few realistic ${primary.toLowerCase()} examples and document where it helps`,
          `use a small scenario set and confirm the comparison output feels worth sharing`,
          `compare the tool output against your own manual reasoning on a few cases`,
        ],
        tools: ["Next.js", "TypeScript", "Supabase", "Zod"],
        skills: ["Problem framing", "Product scoping", "Data modeling", "UX judgment"],
      };
  }
}

function getResearchFamilyRecipe(family: DomainFamily, primary: string) {
  switch (family) {
    case "hardware":
      return {
        titles: [
          `How Do Configuration Tradeoffs Change Performance in a Simplified ${primary} Model?`,
          `Which Benchmark Pattern Reveals the Biggest ${primary} Bottleneck?`,
          `What Verification or Memory Behavior Pattern Matters Most in a Small ${primary} Study?`,
        ],
        questionStem: `${primary.toLowerCase()} behavior under a narrow, measurable set of conditions`,
        methodology: "use a simplified simulator or curated case set, vary one small set of conditions, and compare the outputs with tables and plots",
        evidence: "benchmark traces, simulated outputs, or a small verification case log",
        scope: "one model or case family, one benchmark or case set, and one main comparison path",
        limitation: "The work depends on a simplified model or small case set, so conclusions should stay local to the chosen setup.",
        tools: ["Python", "Notebook", "Charts", "Technical writing tools"],
        skills: ["Question framing", "Systems modeling", "Analysis", "Technical communication"],
      };
    case "photonics":
      return {
        titles: [
          `Modeling Polarization Sensitivity in ${primary} Waveguides and Ring Resonators`,
          `How Does Geometry Variation Affect Loss or Resonance Shift in ${primary}?`,
          `Which Device Parameter Most Strongly Changes Performance in a Student-Scale ${primary} Model?`,
        ],
        questionStem: `${primary.toLowerCase()} device behavior under a small, clearly named parameter sweep`,
        methodology: "run a disciplined simulation or secondary-modeling workflow and compare a small number of parameter changes",
        evidence: "simulated response curves, loss metrics, resonance shifts, and a short literature baseline",
        scope: "one device family, one simulation workflow, and one small set of parameters",
        limitation: "The study depends on simulation assumptions and should not imply fabrication or lab validation unless real data is available.",
        tools: ["Simulation software or Python", "Notebook", "Charts", "Literature sources"],
        skills: ["Modeling", "Scientific analysis", "Visualization", "Limitation framing"],
      };
    case "security":
      return {
        titles: [
          `Which Static Features Best Distinguish Benign and Malicious ${primary} Samples?`,
          `What Misconfiguration Patterns Appear Most Often in a Small ${primary} Review Dataset?`,
          `How Consistent Is Transparent Rule-Based Triage on a Small ${primary} Case Set?`,
        ],
        questionStem: `${primary.toLowerCase()} risk patterns in a curated, accessible dataset`,
        methodology: "assemble a small labeled or tagged case set, apply a transparent rubric, and analyze the resulting pattern frequencies or simple classification behavior",
        evidence: "a curated case log or labeled dataset with categories, severity notes, and short qualitative examples",
        scope: "one artifact family, one feature or tagging rubric, and descriptive conclusions only",
        limitation: "A small dataset or simplified feature set limits generalization, so the project should emphasize interpretability and failure analysis.",
        tools: ["Python or notebook", "Spreadsheet", "Charts", "Write-up tools"],
        skills: ["Dataset curation", "Rubric design", "Pattern analysis", "Research communication"],
      };
    default:
      return {
        titles: [
          `What Measurable Factor Most Influences Outcomes in ${primary}?`,
          `Comparing Two Practical Approaches to Evaluating ${primary} Under Realistic Constraints`,
          `Building a Small Benchmark for Better ${primary} Decisions`,
        ],
        questionStem: `${primary.toLowerCase()} outcomes inside a narrow, clearly bounded student-scale context`,
        methodology: "use one primary method, such as secondary data analysis, a narrow literature-backed comparison, or a small simulation study, and document each step cleanly",
        evidence: `one accessible evidence source tied to ${primary.toLowerCase()}, plus figures or tables that summarize the main pattern`,
        scope: "one question, one evidence source, and one main analysis path",
        limitation: "The project should avoid broad causal claims and state the main evidence limits explicitly.",
        tools: ["Notebook or spreadsheet", "Literature sources", "Charts", "Writing tools"],
        skills: ["Question design", "Evidence synthesis", "Analysis", "Limitation framing"],
      };
  }
}

function fallbackSoftwareRecommendations(normalizedProfile: NormalizedProfile): RecommendationBatch {
  const anchors = getProfileAnchors(normalizedProfile);
  const primary = titleCase(anchors[0] ?? "Domain");
  const family = detectDomainFamily(anchors);
  const recipe = getSoftwareFamilyRecipe(family, primary);
  const difficulty = softwareDifficulty(normalizedProfile.skill_assessment);
  const estimatedWeeks = estimateWeeksFromProfile(normalizedProfile);
  const weeklyHours = estimateWeeklyHoursFromProfile(normalizedProfile);
  const impressivenessScore = impressivenessScoreForFamily(family);
  const finishability = finishabilityScore(normalizedProfile);

  const recommendations = recipe.artifacts.map((artifact, index) =>
    makeSoftwareRecommendation({
      id: `${slugify(primary)}-${slugify(artifact)}`,
      title: `${primary} ${artifact}`,
      summary: `Build a focused ${artifact.toLowerCase()} for ${primary.toLowerCase()} work that helps ${recipe.targetUser.toLowerCase()} ${recipe.problem}.`,
      rationale: `This stays clearly inside ${primary.toLowerCase()} instead of drifting into generic app ideas, and the MVP is believable because it centers on one real workflow with a visible output.`,
      targetUser: recipe.targetUser,
      problemStatement: `Users need a better way to ${recipe.problem}.`,
      coreWorkflow: recipe.workflows[index] ?? recipe.workflows[0],
      mvpBoundary: `For the MVP, ${recipe.mvp[index] ?? recipe.mvp[0]}.`,
      validationPlan: `Validate the project by ${recipe.validation[index] ?? recipe.validation[0]}.`,
      toolsNeeded: recipe.tools,
      skills: recipe.skills,
      difficulty,
      estimatedWeeks: index === 1 ? estimatedWeeks + 1 : estimatedWeeks,
      weeklyHours,
      impressivenessScore: index === 2 ? impressivenessScore - 1 : impressivenessScore,
      finishabilityScore: index === 1 ? finishability - 1 : finishability,
      authenticityNote: `Use real examples from ${primary.toLowerCase()} that you genuinely care about so the workflow, rules, and tradeoffs feel earned rather than generic.`,
    }),
  );

  return RecommendationBatchSchema.parse({ recommendations });
}

function fallbackResearchRecommendations(normalizedProfile: NormalizedProfile): RecommendationBatch {
  const anchors = getProfileAnchors(normalizedProfile);
  const primary = titleCase(anchors[0] ?? "Domain");
  const family = detectDomainFamily(anchors);
  const recipe = getResearchFamilyRecipe(family, primary);
  const difficulty = researchDifficulty(normalizedProfile.skill_assessment);
  const estimatedWeeks = estimateWeeksFromProfile(normalizedProfile) + 1;
  const weeklyHours = estimateWeeklyHoursFromProfile(normalizedProfile);
  const impressivenessScore = impressivenessScoreForFamily(family);
  const finishability = finishabilityScore(normalizedProfile);

  const recommendations = recipe.titles.map((title, index) =>
    makeResearchRecommendation({
      id: `${slugify(primary)}-research-${index + 1}`,
      title,
      summary: `Design a student-scale study focused on ${recipe.questionStem} using ${recipe.methodology}.`,
      rationale: `The question, method, and evidence source are concrete enough to feel real while still keeping the project narrow and believable for a motivated student.`,
      researchQuestion: title.endsWith("?") ? title : `${title}?`,
      hypothesisOrFocus: `Focus on one comparison or relationship inside ${recipe.questionStem}.`,
      methodology: recipe.methodology,
      evidencePlan: `Use ${recipe.evidence}.`,
      scopeBoundaries: `Keep the study to ${recipe.scope}.`,
      limitationNote: recipe.limitation,
      toolsNeeded: recipe.tools,
      skills: recipe.skills,
      difficulty,
      estimatedWeeks,
      weeklyHours,
      impressivenessScore: index === 2 ? impressivenessScore - 1 : impressivenessScore,
      finishabilityScore: index === 1 ? finishability - 1 : finishability,
      authenticityNote: `State every simplifying assumption explicitly so the project reads as disciplined inquiry instead of inflated academic polish.`,
    }),
  );

  return RecommendationBatchSchema.parse({ recommendations });
}

function getSoftwareRoadmapPayload(selectedProject: Record<string, unknown>) {
  const payload = asRecord(selectedProject.track_payload_json);
  const summary = asString(selectedProject.summary, "one real workflow in the user's domain");

  return {
    title: asString(selectedProject.title, "Software Project"),
    targetUser: asString(payload.target_user, "a clearly defined niche user"),
    problemStatement: asString(payload.problem_statement, summary),
    coreWorkflow: asString(payload.core_workflow, "accept one input and produce one useful output"),
    mvpBoundary: asString(payload.mvp_boundary, "ship one narrow workflow and delay all optional features"),
    validationPlan: asString(payload.validation_plan, "test the workflow with a small real case set and document the result"),
  };
}

function getResearchRoadmapPayload(selectedProject: Record<string, unknown>) {
  const payload = asRecord(selectedProject.track_payload_json);

  return {
    title: asString(selectedProject.title, "Research Project"),
    researchQuestion: asString(payload.research_question ?? payload.research_question_or_hypothesis, "Define one concrete research question."),
    hypothesisOrFocus: asString(payload.hypothesis_or_focus, "Focus on one comparison or measurable relationship."),
    methodology: asString(payload.methodology, "Use one feasible primary method."),
    evidencePlan: asString(payload.evidence_or_data_plan, "Use one accessible evidence source."),
    scopeBoundaries: asString(payload.scope_boundaries, "Keep the scope to one question and one evidence source."),
    limitationNote: asString(payload.limitation_note, "State the main methodological limit clearly and early."),
  };
}

function fallbackSoftwareRoadmap(input: {
  selectedProject: Record<string, unknown>;
  detailLevel: "limited" | "full";
}): Roadmap {
  const project = getSoftwareRoadmapPayload(input.selectedProject);

  return SoftwareRoadmapSchema.parse({
    project_track: "software",
    overview: `${project.title} is a domain-grounded software build centered on ${project.problemStatement.toLowerCase()} and designed to ship as one believable MVP rather than a broad platform.`,
    mvp_scope: `${project.mvpBoundary} The MVP succeeds when ${project.targetUser} can complete ${project.coreWorkflow.toLowerCase()} without manual glue work outside the product.`,
    feature_ladder: {
      must_have: [
        `Typed data model for the ${project.targetUser} workflow`,
        `A working end-to-end implementation of ${project.coreWorkflow.toLowerCase()}`,
        "Visible output or comparison view that proves the tool is useful",
      ],
      should_have: [
        "Validation states, empty states, and one polished demo path",
        "A lightweight report, export, or summary artifact for sharing results",
      ],
      could_have: ["One extra convenience feature after the core workflow is stable"],
    },
    milestones: [
      {
        order_index: 0,
        title: `Lock the ${project.title} spec and success rubric`,
        description: `Write a short product brief that names the target user, documents ${project.problemStatement.toLowerCase()}, defines the MVP boundary, and lists the exact success criteria you will use during validation.`,
      },
      {
        order_index: 1,
        title: `Build the data and input layer for ${project.title}`,
        description: `Implement the schema, input form or parser, and persistence flow needed to capture the minimum data required for ${project.coreWorkflow.toLowerCase()}, then prove it works with a seeded example dataset or manual test case.`,
      },
      {
        order_index: 2,
        title: `Implement the core ${project.title} workflow`,
        description: `Ship the main processing logic that turns the captured input into the product's useful output, and verify the end-to-end flow with at least two realistic scenarios from the target domain.`,
      },
      {
        order_index: 3,
        title: `Add the review and validation surface`,
        description: `Build the dashboard, comparison view, or summary screen that makes the output understandable, then run the validation plan by documenting where the tool helps and where it still breaks down.`,
      },
      {
        order_index: 4,
        title: `Package the demo, README, and cut list`,
        description: `Record the final demo path, write the README sections for problem, workflow, tradeoffs, and validation results, and explicitly list the features that were cut to keep the MVP believable.`,
      },
    ],
    repo_structure: [
      { path: "src/app", purpose: "Routes, pages, and API handlers for the MVP workflow." },
      { path: "src/components", purpose: "Reusable UI for input, review, and summary states." },
      { path: "src/lib/domain", purpose: "Core workflow logic, validators, and domain-specific utilities." },
      { path: "README.md", purpose: "Problem statement, architecture choices, validation notes, and demo narrative." },
    ],
    readme_draft: `# ${project.title}\n\n## Problem\n${project.problemStatement}\n\n## Target User\n${project.targetUser}\n\n## Core Workflow\n${project.coreWorkflow}\n\n## MVP Boundary\n${project.mvpBoundary}\n\n## Validation Plan\n${project.validationPlan}\n\n## What I Built\n- A narrow workflow that turns real inputs into a useful output\n- A review surface that makes the output understandable\n- A scoped implementation designed to ship instead of sprawl\n\n## Tradeoffs\nI prioritized one believable workflow over optional breadth, automation, or integrations.\n\n## Next Steps\n${input.detailLevel === "full" ? "Add one carefully chosen extension only after the core validation path is stable." : "Add one small extension after the MVP is stable."}`,
    cut_if_behind: [
      "Skip extra integrations and keep the data source manual or local.",
      "Delay polish features until the main workflow and validation path are demo-ready.",
    ],
    stretch_goals:
      input.detailLevel === "full"
        ? ["Add a shareable results artifact for mentors or reviewers.", "Introduce one deeper validation or analytics layer after the MVP is stable."]
        : ["Add one export or saved-view feature.", "Add one extra comparison filter after the MVP ships."],
    explanation_guide: {
      elevator_pitch: `${project.title} is a focused software product for ${project.targetUser} that solves ${project.problemStatement.toLowerCase()} through one clear end-to-end workflow.`,
      resume_bullets: [
        `Built and shipped ${project.title}, a scoped software tool for ${project.targetUser} with typed data flow and a real validation path.`,
        `Defined a narrow MVP around ${project.coreWorkflow.toLowerCase()} and documented the tradeoffs needed to keep the project believable and finishable.`,
      ],
      interview_talking_points: [
        "How I chose the user and problem instead of building a generic app.",
        "How I defined the MVP boundary and cut the right features.",
        "How I validated the workflow with realistic examples from the domain.",
      ],
    },
    track_payload_json: {
      target_user: project.targetUser,
      problem_statement: project.problemStatement,
      core_workflow: project.coreWorkflow,
      mvp_boundary: project.mvpBoundary,
      validation_checkpoint: project.validationPlan,
      ship_criteria: [
        "A new user can complete the core workflow from input to output without manual intervention.",
        "The README and demo clearly explain the problem, workflow, and what was intentionally cut.",
      ],
    },
  });
}

function fallbackResearchRoadmap(input: {
  selectedProject: Record<string, unknown>;
  detailLevel: "limited" | "full";
}): Roadmap {
  const project = getResearchRoadmapPayload(input.selectedProject);

  return ResearchRoadmapSchema.parse({
    project_track: "research",
    overview: `${project.title} is a domain-grounded student research project centered on ${project.researchQuestion.toLowerCase()} with a concrete evidence plan and a disciplined limitation note.`,
    mvp_scope: `${project.scopeBoundaries} The project succeeds when the question, evidence source, analysis steps, and final interpretation all stay tightly aligned instead of expanding into a vague broad topic.`,
    feature_ladder: {
      must_have: [
        "A locked research question and hypothesis/focus statement",
        `A usable evidence plan for ${project.evidencePlan.toLowerCase()}`,
        "A findings section with explicit limitations and conservative claims",
      ],
      should_have: [
        "A literature matrix or source map that justifies the method choices",
        "A figure, table, or comparison view that makes the main finding easy to explain",
      ],
      could_have: ["One mentor review or presentation rehearsal after the core write-up is done"],
    },
    milestones: [
      {
        order_index: 0,
        title: `Lock the ${project.title} question and scope`,
        description: `Write a one-page brief that states ${project.researchQuestion.toLowerCase()}, records the main hypothesis or focus, names the evidence source, and fixes the scope boundaries before any extra exploration expands the project.`,
      },
      {
        order_index: 1,
        title: `Build the literature matrix and method protocol`,
        description: `Collect the core sources or references, summarize the most relevant findings in a literature matrix, and draft the exact procedure you will use for ${project.methodology.toLowerCase()}.`,
      },
      {
        order_index: 2,
        title: `Prepare the evidence set and analysis workspace`,
        description: `Assemble, clean, or structure the materials for ${project.evidencePlan.toLowerCase()}, then create the notebook, spreadsheet, or coding workspace where every analysis step will be recorded.`,
      },
      {
        order_index: 3,
        title: `Run the analysis and produce figures or tables`,
        description: `Execute the planned method, log the outputs in a reproducible way, and create the figure, table, or comparison artifact that best supports the main finding without overstating the evidence.`,
      },
      {
        order_index: 4,
        title: `Draft the final paper, poster, or presentation package`,
        description: `Write the findings, methods, and limitation sections, then build the final deliverable package with an abstract, key visuals, and a short explanation of what the project can and cannot claim.`,
      },
    ],
    repo_structure: [
      { path: "research/proposal.md", purpose: "Question statement, scope boundaries, literature notes, and method rationale." },
      { path: "research/data", purpose: "Downloaded, collected, or cleaned evidence with clear provenance notes." },
      { path: "research/analysis", purpose: "Notebook, script, or spreadsheet used to run the analysis reproducibly." },
      { path: "research/final", purpose: "Final paper, poster, presentation, and supporting figures or tables." },
    ],
    readme_draft: `# ${project.title}\n\n## Research Question\n${project.researchQuestion}\n\n## Hypothesis / Focus\n${project.hypothesisOrFocus}\n\n## Methodology\n${project.methodology}\n\n## Evidence Plan\n${project.evidencePlan}\n\n## Scope Boundaries\n${project.scopeBoundaries}\n\n## Main Limitation\n${project.limitationNote}\n\n## Deliverables\n- Final paper or brief\n- Poster or slide deck\n- Portfolio-ready summary with limitations\n\n## Reflection\nThis project prioritizes one believable question, one evidence path, and one clear final interpretation over fake academic grandiosity.`,
    cut_if_behind: [
      "Drop secondary analyses and keep the write-up centered on one defendable finding.",
      "Prioritize the paper or brief before spending extra time on poster polish.",
    ],
    stretch_goals:
      input.detailLevel === "full"
        ? ["Add one mentor review round after the first full draft.", "Convert the final result into a short public talk or recorded walkthrough."]
        : ["Add one polished figure appendix.", "Add one concise comparison slide after the main draft is done."],
    explanation_guide: {
      elevator_pitch: `${project.title} is a focused research project that investigates ${project.researchQuestion.toLowerCase()} using ${project.methodology.toLowerCase()} and a clearly bounded evidence plan.`,
      resume_bullets: [
        `Designed and executed a scoped research project on ${project.title} with a defined question, evidence plan, and limitation framing.`,
        `Turned the analysis into a polished deliverable set that highlighted the method, results, and main constraints honestly.`,
      ],
      interview_talking_points: [
        "How I chose a question that was ambitious but still believable with my resources.",
        "How I built the evidence plan and kept the method disciplined.",
        "How I handled limitations without weakening the credibility of the project.",
      ],
    },
    track_payload_json: {
      research_question: project.researchQuestion,
      hypothesis_or_focus: project.hypothesisOrFocus,
      methodology: project.methodology,
      evidence_or_data_plan: project.evidencePlan,
      scope_boundaries: project.scopeBoundaries,
      limitation_note: project.limitationNote,
      why_this_fits: "The project is ambitious enough to feel impressive, but the scope stays realistic because the question, method, and evidence source are all narrow and explicit.",
      step_by_step_plan: [
        "Lock the question, evidence source, and scope boundaries in a short written brief.",
        "Build the literature matrix and draft the exact method protocol.",
        "Prepare the dataset, source set, or instrument and document all assumptions.",
        "Run the analysis, create the main figures or tables, and log interpretation notes.",
        "Write the final deliverables with a clear limitation section and conservative claims.",
      ],
      timeline_and_milestones: [
        "Week 1: finalize the question, scope, and evidence plan.",
        "Weeks 2-3: gather literature, draft the protocol, and prepare the analysis workspace.",
        "Weeks 4-5: execute the method and produce the main figures or tables.",
        "Weeks 6-7: write the paper or brief and package the final presentation materials.",
      ],
      risks_and_blockers: [
        "The evidence source may be noisier or smaller than expected.",
        "The question can become too broad if extra comparisons keep getting added.",
        "Interpretation quality drops quickly if the limitation section is not written early.",
      ],
      final_deliverables: ["Research brief or paper", "Poster or presentation", "Portfolio summary with limitations"],
      portfolio_or_application_positioning: "Position the project as disciplined inquiry: a real question, a real method, and honest interpretation under realistic student constraints.",
    },
  });
}

export async function runProfileNormalization(input: {
  projectTrack: ProjectTrack;
  rawIntake: Record<string, unknown>;
}) {
  try {
    const schema = input.projectTrack === "research" ? ResearchNormalizedProfileSchema : SoftwareNormalizedProfileSchema;
    return await generateStructuredOutput({
      schema,
      systemPrompt: buildNormalizeSystemPrompt(input.projectTrack),
      userPrompt: buildNormalizeUserPrompt({ intakeJson: JSON.stringify(input.rawIntake) }),
      maxRetries: 2,
      validator: validateNormalizedProfile,
    });
  } catch (error) {
    const parsed =
      input.projectTrack === "research"
        ? fallbackResearchNormalizedProfile(input.rawIntake)
        : fallbackSoftwareNormalizedProfile(input.rawIntake);

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "normalize-profile",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

export async function runRecommendationGeneration(normalizedProfile: NormalizedProfile) {
  try {
    const result = await generateStructuredOutput({
      schema: RecommendationBatchSchema,
      systemPrompt: buildRecommendationsSystemPrompt(normalizedProfile.project_track),
      userPrompt: buildRecommendationsUserPrompt({ normalizedProfileJson: JSON.stringify(normalizedProfile) }),
      maxRetries: 2,
      validator: (parsed) => validateRecommendationBatch(parsed, normalizedProfile),
    });

    const withSafeIds = result.parsed.recommendations.map((item, index) => ({
      ...item,
      id: item.id || `${normalizedProfile.project_track}_${index + 1}`,
      project_track: normalizedProfile.project_track,
    }));

    return {
      parsed: { recommendations: withSafeIds },
      raw: result.raw,
    };
  } catch (error) {
    const parsed =
      normalizedProfile.project_track === "research"
        ? fallbackResearchRecommendations(normalizedProfile)
        : fallbackSoftwareRecommendations(normalizedProfile);

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "recommendations",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

export async function runRoadmapGeneration(input: {
  selectedProject: Record<string, unknown>;
  normalizedProfile: NormalizedProfile;
  detailLevel: "limited" | "full";
}) {
  const projectTrack = input.normalizedProfile.project_track;

  try {
    const schema = projectTrack === "research" ? ResearchRoadmapSchema : SoftwareRoadmapSchema;

    return await generateStructuredOutput({
      schema,
      systemPrompt: buildRoadmapSystemPrompt(projectTrack),
      userPrompt: buildRoadmapUserPrompt(projectTrack, {
        selectedProjectJson: JSON.stringify(input.selectedProject),
        normalizedProfileJson: JSON.stringify(input.normalizedProfile),
        detailLevel: input.detailLevel,
      }),
      maxRetries: 2,
      validator: (parsed) => validateRoadmap(parsed, input.normalizedProfile),
    });
  } catch (error) {
    const parsed =
      projectTrack === "research"
        ? fallbackResearchRoadmap({ selectedProject: input.selectedProject, detailLevel: input.detailLevel })
        : fallbackSoftwareRoadmap({ selectedProject: input.selectedProject, detailLevel: input.detailLevel });

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "roadmap",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}



