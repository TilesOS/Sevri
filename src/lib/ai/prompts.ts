import type { GenerationContext, ProjectOption, RoadmapOverview, RoadmapStep, StepGuidance } from "@/lib/ai/schemas";

export interface PromptFeedbackItem {
  signal: "good" | "mixed" | "bad";
  notes: string | null;
  contextLabel?: string | null;
}

const QUALITY_CLAUSE = "Every prose field must be a complete thought ending in terminal punctuation (. ! ?). Titles, labels, URLs, provider names, and short taxonomy values do not need terminal punctuation. Never truncate mid-word. If a field would run past its length budget, write a shorter complete version. Keep titles under 100 characters and end them on a noun phrase, not a preposition or conjunction. Write in English only; use foreign words only for proper nouns or standard technical terms. Do not use placeholder text, ellipses to indicate cut-off content, or bracketed notes.";

/**
 * Voice contract for every field a student reads. The pipeline's own vocabulary
 * (target outcome, normalized profile, anchor interests) must never surface, and
 * the reader is addressed directly rather than described in the third person.
 */
const VOICE_CLAUSE = "Write to the student directly in second person: say \"you\" and \"your project\", never \"the student\", \"they\", or \"their\". Never name Sevri, the profile, or any internal field name such as target outcome, anchor interests, or focus signal in text the student will read. Be encouraging but credible; do not inflate what the work proves.";

function formatFeedback(feedback: PromptFeedbackItem[] | undefined) {
  if (!feedback || feedback.length === 0) {
    return "No prior user feedback is available for this stage.";
  }

  const grouped: Record<string, string[]> = { good: [], mixed: [], bad: [] };
  for (const item of feedback) {
    const note = item.notes?.trim() || "No written note.";
    const label = item.contextLabel?.trim() ? ` [${item.contextLabel.trim()}]` : "";
    grouped[item.signal].push(`${note}${label}`);
  }

  const parts: string[] = [];
  if (grouped.bad.length > 0) {
    parts.push(`DISLIKED: ${grouped.bad.join("; ")}`);
  }
  if (grouped.mixed.length > 0) {
    parts.push(`MIXED: ${grouped.mixed.join("; ")}`);
  }
  if (grouped.good.length > 0) {
    parts.push(`LIKED: ${grouped.good.join("; ")}`);
  }

  if (parts.length === 0) {
    return "No prior user feedback is available for this stage.";
  }

  return [
    "Prior feedback from this user (weight DISLIKED items most heavily):",
    ...parts,
  ].join("\n");
}

export function buildNormalizeSystemPrompt() {
  return [
    "You are Sevri's universal project-context normalizer.",
    "Return only JSON that matches the schema.",
    "Extract goals, interests, preferred formats, experience, resources, constraints, field practices, scope risks, and safety or ethics considerations.",
    "Anchor the profile to the user's real domain language, constraints, time budget, and desired proof.",
    "Infer at most one careful step beyond what the user explicitly signals.",
    "Populate anti_generic_warnings, scope_guardrails, and goal/resource summaries with concrete, useful language.",
    "Preserve current experience and preferred challenge as separate signals. Never raise the stated current experience merely because the user requested an ambitious challenge.",
    "If the intake is specific, the normalized profile must stay specific.",
    "The summary field is shown to the student on the idea board, so write it to them in second person (\"your\"), not about them.",
    QUALITY_CLAUSE,
  ].join(" ");
}

export function buildNormalizeUserPrompt(input: {
  rawIntake: Record<string, unknown>;
  feedback?: PromptFeedbackItem[];
}) {
  return [
    "Onboarding intake JSON:",
    JSON.stringify(input.rawIntake, null, 2),
    "Relevant prior feedback:",
    formatFeedback(input.feedback),
    "Requirements:",
    "- Reuse the user's actual technical or research language whenever possible.",
    "- Keep the normalized profile narrow enough to drive differentiated outputs.",
    "- Treat current experience as a guidance-depth signal and preferred_difficulty as the student's appetite for stretch. Preserve both independently.",
    "- Do not introduce removed concepts like mentor access, school/company targeting, or tool access assumptions unless the raw intake explicitly names them in free text.",
  ].join("\n\n");
}

function contextEmphasisSeed(context: GenerationContext): number {
  const str = context.summary + context.project_context_json.domain_brief;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const EMPHASIS_KEYS = [
  ["goal_signal", "focus_signal"],
  ["constraints_summary", "resource_snapshot"],
  ["domain_brief", "anchor_interests"],
  ["project_goal", "focus_signal"],
] as const;

function formatContext(context: GenerationContext) {
  const seed = contextEmphasisSeed(context);
  const emphasizedKeys = new Set<string>(EMPHASIS_KEYS[seed % EMPHASIS_KEYS.length]);
  emphasizedKeys.add("skill_assessment");
  emphasizedKeys.add("preferred_challenge");

  const payload = context.project_context_json;

  const fields: Array<[string, string, string]> = [
    ["summary", "Summary", context.summary],
    ["skill_assessment", "Skill level", context.skill_assessment],
    ["anchor_interests", "Anchors", payload.anchor_interests.join(", ")],
    ["domain_brief", "Domain brief", payload.domain_brief],
    ["goal_signal", "Goal", payload.goal_signal],
    ["project_goal", "Project goal", payload.project_goal],
    ["success_definition", "Personal success", payload.success_definition],
    ["resource_snapshot", "Resources", payload.resource_snapshot],
    ["anti_generic_warnings", "Anti-generic warnings", payload.anti_generic_warnings.join(" | ")],
    ["weekly_hours", "Weekly hours", String(payload.weekly_hours)],
    ["preferred_challenge", "Preferred challenge", payload.preferred_challenge],
    ["constraints_summary", "Constraints", payload.constraints_summary],
    ["scope_guardrails", "Scope guardrails", payload.scope_guardrails.join(" | ")],
    ["focus_signal", "Focus", payload.focus_signal],
  ];

  fields.push(
    ["preferred_formats", "Preferred formats", payload.open_to_anything ? "Open to anything" : payload.preferred_formats.join(", ")],
    ["field_practices", "Field practices", payload.field_practices.join(" | ")],
    ["safety_ethics", "Safety and ethics", payload.safety_ethics_considerations.join(" | ")],
  );

  const emphasized: string[] = [];
  const standard: string[] = [];

  for (const [key, label, value] of fields) {
    if (emphasizedKeys.has(key)) {
      emphasized.push(`PRIMARY FOCUS — ${label}: ${value}`);
    } else {
      standard.push(`${label}: ${value}`);
    }
  }

  if (context.risk_flags.length > 0) {
    standard.push(`Risk flags: ${context.risk_flags.join(", ")}`);
  }

  return [...emphasized, ...standard].join("\n");
}

export function buildOptionsSystemPrompt() {
  return [
    "You generate concise cross-domain project options for Sevri.",
    "Return only JSON that matches the schema.",
    "Generate exactly 3 options in this exact ladder and order: (1) difficulty=beginner is FOCUSED, (2) difficulty=intermediate is STRETCH, (3) difficulty=advanced is AMBITIOUS.",
    "These difficulty values are comparative scope tiers, not claims about the student's ability. Calibrate all three to current experience and preferred challenge.",
    "Keep titles specific and summaries to 1-2 sentences. Use why_it_fits to explain the connection between this student's specific background and the project — reference their domain anchors, constraints, or goals by name.",
    "Stay grounded in the student's real domain interests and constraints.",
    "Avoid generic student-life, study-habit, or productivity ideas unless the context explicitly supports them.",
    "Every option must include a descriptive project_kind_label and a concrete project_blueprint_json with central challenge, approach, primary artifacts, proof of success, scope boundary, resources, and safety or ethics notes.",
    "Also return skills_demonstrated, tools_needed, impressiveness_score, and finishability_score for every option.",
    "Open students must receive three meaningfully different formats or approaches. Preference-led students should stay near their choices, with hybrids when useful.",
    "Never silently force an idea into an app or a research paper. Every idea needs concrete artifacts and observable success evidence.",
    "FOCUSED: the smallest serious version with a sharp audience/question and a complete proof loop; never a generic fallback.",
    "STRETCH: a meaningfully different direction that teaches one important new technique or method while staying finishable.",
    "AMBITIOUS: the hardest realistic challenge requested. It must have the strongest creative or real-world impact thesis, one non-obvious technical/methodological mechanism, and a credible proof path. Difficulty comes from depth and judgment, not feature count.",
    "If preferred challenge is advanced, keep even the focused option intellectually serious; reduce breadth, not caliber. If current experience is beginner, make the ambitious option learning-heavy but still buildable from available resources.",
    "Scores must reflect the real time budget, skill level, and risk flags rather than generic optimism.",
    "These seed fields become the foundation for roadmap generation - make them specific enough to drive a real execution plan.",
    VOICE_CLAUSE,
    QUALITY_CLAUSE,
  ].join(" ");
}

const CREATIVE_ANGLES = [
  "Favor projects where the student builds something they would actually use in their own workflow.",
  "Favor projects that produce a visual or interactive artifact — something you can screenshot or screen-record for a portfolio.",
  "Favor projects that solve a problem the student has personally encountered or observed in their domain.",
  "Favor projects that could impress a technical interviewer by demonstrating systems thinking or domain expertise.",
  "Favor projects that produce a reusable tool or dataset that others in the domain could benefit from.",
  "Favor projects where the core value is immediately visible in a 60-second demo.",
];

export function buildOptionsUserPrompt(context: GenerationContext, feedback?: PromptFeedbackItem[]) {
  const angle = CREATIVE_ANGLES[contextEmphasisSeed(context) % CREATIVE_ANGLES.length];

  return [
    "Student context:",
    formatContext(context),
    "Relevant prior feedback:",
    formatFeedback(feedback),
    "Requirements:",
    "- Make the three options clearly different from each other.",
    "- Each option should feel finishable for the stated time budget.",
    "- Keep the blueprint concrete and useful for later roadmap generation.",
    "- scope_boundary must define what is in versus out of the core version.",
    "- proof_of_success must describe observable evidence.",
    "- Skills demonstrated should feel resume-relevant and specific to the option.",
    "- Tools needed should be realistic for the student's context, not an aspirational stack dump.",
    "",
    `Creative direction for this student: ${angle}`,
  ].join("\n\n");
}

export function buildRoadmapSystemPrompt() {
  return [
    "You create structured execution roadmaps for Sevri projects in any field.",
    "Return only JSON that matches the schema.",
    "Generate 4 to 6 steps.",
    "",
    "project_brief: A 2-4 sentence paragraph that captures WHO the project is for, WHAT problem it solves, HOW the student will approach it, WHY it matters in practice, and WHAT a successful outcome looks like. This becomes the single source of truth for the entire project.",
    "core_scope: The smallest complete version that preserves the central proof loop.",
    "artifact_plan: Name every primary artifact and why it exists.",
    "project_overview_draft: A plain-language portfolio overview that does not assume a code repository.",
    "",
    "Each step must have: a sequential order_index starting at 0, a project-specific title (never generic), a concrete objective, a tangible deliverable, a rough time estimate, a validation_check (how the student proves this step is done), and a scope_guardrail (what to avoid or cut during this step).",
    "",
    "cut_if_behind: 1-4 items the student can drop if they fall behind schedule. These must be specific to THIS project.",
    "success_criteria: 2-5 concrete conditions that define project success. Tie them to actual deliverables and evidence, not effort.",
    "",
    "Do not use generic titles like 'Foundation Setup', 'Core Workflow', or 'Polish and Packaging'. Instead, use titles that name a specific project artifact, domain concept, or user-facing feature (e.g., 'Wire the Trace Parser', 'Score the Rubric Matrix', 'Ship the Comparison View'). The title should tell the student exactly WHAT they are building in this step.",
    "Every deliverable must be a concrete artifact, not a phase name.",
    "",
    "pitch_kit: How the student talks about this project once it exists. Write it as finished prose the student could say out loud without editing.",
    "pitch_kit.elevator_pitch: 2-4 sentences naming what the project is, who it serves, and what makes it credible. No hype and no invented results.",
    "pitch_kit.resume_bullets: 2-3 bullets that each start with a past-tense action verb and describe the artifact and the evidence. Claim only what the roadmap actually produces.",
    "pitch_kit.talking_points: exactly 3 points. Each has a short label (for example 'Why this project', 'What it does', 'Why it matters') and a body of 1-2 complete sentences.",
    "Every pitch_kit field is read by the student and is written for them: complete sentences, correct capitalization, no trailing fragments.",
    "learning_resources: 5-8 real resources found with web search for this exact project. Include at least one start_here, two build_with, and one go_deeper resource. Prefer official documentation, universities, recognized research organizations, primary papers/datasets, and high-quality maintained tutorials.",
    "Every learning resource URL must be copied from a retrieved web-search source. Never invent, autocomplete, or guess a URL. Choose the exact page the student should open, not a search result page or generic homepage. Explain why it matters for this project and map it to a real roadmap step. use_during_step is 1-based: the first roadmap step is 1.",
    "Use free_access=true only when the useful material is available without payment. Do not describe a resource as current unless web evidence supports that claim.",
    "",
    "Do not include long rationale, README text, or extra sections.",
    VOICE_CLAUSE,
    QUALITY_CLAUSE,
  ].join(" ");
}

export function buildRoadmapUserPrompt(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  feedback?: PromptFeedbackItem[];
}) {
  return [
    "Student context:",
    formatContext(input.context),
    "Selected option:",
    [
      `Title: ${input.selectedOption.title}`,
      `Summary: ${input.selectedOption.summary}`,
      `Why it fits: ${input.selectedOption.why_it_fits}`,
      `Difficulty: ${input.selectedOption.difficulty}`,
      `Estimated weeks: ${input.selectedOption.estimated_weeks}`,
      `Project blueprint: ${JSON.stringify(input.selectedOption.project_blueprint_json)}`,
    ].join("\n"),
    "Relevant prior feedback:",
    formatFeedback(input.feedback),
    "Requirements:",
    "- The project_brief must synthesize the student context + selected option into a clear execution anchor.",
    "- The project_brief should make the real-world relevance visible, not just the build plan.",
    "- The roadmap should feel practical for the student to start immediately.",
    "- Keep each step scoped tightly enough for a synchronous product experience.",
    "- Every step's deliverable must be a concrete artifact the student can point to.",
    "- validation_check for each step must describe observable evidence that the step is complete.",
    "- scope_guardrail for each step must name the most likely scope creep risk for that step.",
    "- cut_if_behind items must be specific features, sections, or sub-tasks from THIS project.",
    "- Phrase each cut_if_behind item as a thing that can wait (a noun phrase such as 'the export view'), not as an instruction to delete it now.",
    "- success_criteria must tie to real deliverables, not effort or process.",
    "- pitch_kit must describe only what this roadmap actually delivers, in the student's own second-person voice.",
    "- Search the web before choosing learning_resources. The resource set must teach the prerequisite concepts and project-specific techniques implied by this roadmap's difficulty.",
    "- Learning resources are part of the execution plan: use_during_step must point to the step where each source becomes useful.",
  ].join("\n\n");
}

export function buildStepGuidanceSystemPrompt(stepIndex: number, totalSteps: number) {
  const positionGuidance =
    stepIndex === 0
      ? "This is the FIRST step. Focus the guidance on getting started with confidence. Emphasize clarity of setup, early decision-making about tools and scope, and the psychological momentum of producing the first small artifact."
      : stepIndex >= totalSteps - 1
        ? "This is the FINAL step. Focus the guidance on finishing strong. Emphasize packaging the work for its intended audience, honest quality assessment, and creating a narrative about what was accomplished and why."
        : "This is a MIDDLE step. Focus the guidance on maintaining momentum and quality. Emphasize connection to the previous deliverable, concrete progress markers, and scope discipline.";

  return [
    "You generate rich per-step guidance for Sevri projects in any field.",
    "Return only JSON that matches the schema.",
    "Be specific, actionable, and encouraging without filler.",
    "Assume the student needs a clear next move, a realistic checklist, and honest pitfalls.",
    "Make the advice detailed enough to feel premium, but keep every bullet practical.",
    "Checklist items must be short, action-first, and ordered like real execution moves.",
    "Aim for a clear flow such as define -> prepare -> build -> verify, with a final polish step only if it genuinely matters.",
    "Do not number checklist items inside the text because the product UI handles the hierarchy.",
    "The done_when criteria must tie directly to the step's validation_check - do not invent abstract completion conditions.",
    "Pitfalls must reference real risks specific to this project and step, not generic advice.",
    positionGuidance,
    VOICE_CLAUSE,
    QUALITY_CLAUSE,
  ].join(" ");
}

export function buildStepGuidanceUserPrompt(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  roadmap: RoadmapOverview;
  step: RoadmapStep;
  previousStep?: RoadmapStep;
  nextStep?: RoadmapStep;
  feedback?: PromptFeedbackItem[];
}) {
  const roadmapContext = [
    `Title: ${input.roadmap.project_title}`,
    `Overview: ${input.roadmap.short_overview}`,
    `Project brief: ${input.roadmap.project_brief}`,
    `Selected option summary: ${input.selectedOption.summary}`,
    `Selected option blueprint: ${JSON.stringify(input.selectedOption.project_blueprint_json)}`,
    `Success criteria: ${input.roadmap.success_criteria.join(" | ")}`,
    `Cut if behind: ${input.roadmap.cut_if_behind.join(" | ")}`,
  ];

  const fullRoadmap = input.roadmap.steps
    .map((step) => `Step ${step.order_index}: ${step.title} -> ${step.deliverable} (${step.rough_time_estimate})`)
    .join("\n");

  const stepContext = [
    `Title: ${input.step.title}`,
    `Objective: ${input.step.objective}`,
    `Deliverable: ${input.step.deliverable}`,
    `Time estimate: ${input.step.rough_time_estimate}`,
    `Validation check: ${input.step.validation_check}`,
    `Scope guardrail: ${input.step.scope_guardrail}`,
  ];

  if (input.previousStep) {
    stepContext.push(`Previous step delivered: ${input.previousStep.deliverable}`);
  }

  if (input.nextStep) {
    stepContext.push(`Next step expects: ${input.nextStep.objective}`);
  }

  return [
    "Student context:",
    formatContext(input.context),
    "Project:",
    roadmapContext.join("\n"),
    "Relevant prior feedback:",
    formatFeedback(input.feedback),
    "Full roadmap:",
    fullRoadmap,
    "Current roadmap step:",
    stepContext.join("\n"),
    "Requirements:",
    "- The checklist should be in a realistic execution order.",
    "- Checklist items should feel like sequential moves, not mini-paragraphs.",
    "- Keep checklist phrasing short and action-first.",
    "- Move from define/prepare into build/verify, and only mention polish if it is necessary for this step.",
    "- Pitfalls should warn about project-specific mistakes and scope drift for THIS step.",
    "- done_when criteria must be tied to the step's validation_check.",
    "- The email_version should be ready for a future coaching email.",
  ].join("\n\n");
}

export function buildWorkEvaluationSystemPrompt() {
  return [
    "You evaluate student work submissions for Sevri projects in any field.",
    "Return only JSON that matches the schema.",
    "Evaluate honestly - mark 'not_yet' when something is genuinely missing, not to encourage where encouragement is not warranted.",
    "For new evaluations, use 'met' when a criterion is satisfied and 'not_yet' when it is not; 'pass' and 'partial' exist only so older stored evaluations remain compatible.",
    "Each criterion_verdict must map to a specific done_when item or the step's validation_check.",
    "Identify whether the submission includes work that is OUTSIDE this step's scope_guardrail.",
    "If it does, set scope_assessment.drifted to true and write one sentence in out_of_scope_note that names the specific out-of-bounds work and tells the student to cut or park it.",
    "Building extra things is drift, not progress - do not praise it.",
    "If there is no scope drift, set scope_assessment.drifted to false and out_of_scope_note to null.",
    "Scope drift and missing criteria are independent: a submission can meet every criterion and still have drifted.",
    "The overall_assessment should synthesize the verdicts into a balanced narrative.",
    "strongest_aspect should name what the student did best - even if the work is incomplete.",
    "clearest_gap should name the most important thing still missing.",
    "next_best_action should give one concrete, actionable step the student can take next.",
    "ready_to_mark_complete should be true only when all criteria are genuinely met.",
    "If you are confident in your assessment, set confidence to 'high'. If parts of the submission are ambiguous, use 'medium' or 'low'.",
    "List exactly what was inspectable in evidence_reviewed and every unsupported file or uninspected external link in evidence_limitations. Never imply evidence was inspected when it was not in the model input.",
    QUALITY_CLAUSE,
  ].join(" ");
}

export function buildWorkEvaluationUserPrompt(input: {
  step: RoadmapStep;
  guidance: StepGuidance;
  submissionText: string;
  submissionFilename?: string;
}) {
  const criteria = [
    ...input.guidance.done_when.map((item) => `- ${item}`),
    `- Validation check: ${input.step.validation_check}`,
  ];

  return [
    "Step context:",
    [
      `Title: ${input.step.title}`,
      `Objective: ${input.step.objective}`,
      `Deliverable: ${input.step.deliverable}`,
      `Validation check: ${input.step.validation_check}`,
      `Scope guardrail: ${input.step.scope_guardrail}`,
    ].join("\n"),
    "Done-when criteria to evaluate against:",
    criteria.join("\n"),
    `Submission${input.submissionFilename ? ` (${input.submissionFilename})` : ""}:`,
    input.submissionText,
  ].join("\n\n");
}
