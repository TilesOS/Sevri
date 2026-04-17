import type { GenerationContext, ProjectOption, ProjectTrack, RoadmapOverview, RoadmapStep, StepGuidance } from "@/lib/ai/schemas";

export interface PromptFeedbackItem {
  signal: "good" | "mixed" | "bad";
  notes: string | null;
  contextLabel?: string | null;
}

const QUALITY_CLAUSE = "Every field must be a complete thought ending in terminal punctuation (. ! ?). Never truncate mid-word. Keep titles under 100 characters and end them on a noun phrase, not a preposition or conjunction. Write in English only; use foreign words only for proper nouns or standard technical terms. Do not use placeholder text, ellipses to indicate cut-off content, or bracketed notes.";

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

export function buildNormalizeSystemPrompt(projectTrack: ProjectTrack) {
  const trackSpecific =
    projectTrack === "research"
      ? "Extract a concrete student research planning brief from the onboarding answers. Keep the question ambitious but believable, and do not invent mentor or lab access."
      : "Extract a concrete software project planning brief from the onboarding answers. Keep the recommendation domain-specific, demoable, and free from generic productivity defaults.";

  return [
    `You are Sevri's ${projectTrack} profile normalizer.`,
    "Return only JSON that matches the schema.",
    trackSpecific,
    "Anchor the profile to the user's real domain language, constraints, time budget, and desired proof.",
    "Infer at most one careful step beyond what the user explicitly signals.",
    "Populate anti_generic_warnings, scope_guardrails, and goal/resource summaries with concrete, useful language.",
    "If the intake is specific, the normalized profile must stay specific.",
    QUALITY_CLAUSE,
  ].join(" ");
}

export function buildNormalizeUserPrompt(input: {
  projectTrack: ProjectTrack;
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
    "- Do not introduce removed concepts like mentor access, school/company targeting, or tool access assumptions unless the raw intake explicitly names them in free text.",
  ].join("\n\n");
}

function contextEmphasisSeed(context: GenerationContext): number {
  const str = context.summary + context.track_payload_json.domain_brief;
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
  ["target_outcome", "focus_signal"],
] as const;

function formatContext(context: GenerationContext) {
  const seed = contextEmphasisSeed(context);
  const emphasizedKeys = new Set<string>(EMPHASIS_KEYS[seed % EMPHASIS_KEYS.length]);

  const payload = context.track_payload_json;

  const fields: Array<[string, string, string]> = [
    ["summary", "Summary", context.summary],
    ["skill_assessment", "Skill level", context.skill_assessment],
    ["anchor_interests", "Anchors", payload.anchor_interests.join(", ")],
    ["domain_brief", "Domain brief", payload.domain_brief],
    ["goal_signal", "Goal", payload.goal_signal],
    ["target_outcome", "Target outcome", payload.target_outcome],
    ["resource_snapshot", "Resources", payload.resource_snapshot],
    ["anti_generic_warnings", "Anti-generic warnings", payload.anti_generic_warnings.join(" | ")],
    ["weekly_hours", "Weekly hours", String(payload.weekly_hours)],
    ["constraints_summary", "Constraints", payload.constraints_summary],
    ["scope_guardrails", "Scope guardrails", payload.scope_guardrails.join(" | ")],
    ["focus_signal", "Focus", payload.focus_signal],
  ];

  if (context.project_track === "software") {
    const sw = context.track_payload_json;
    fields.push(
      ["project_style_fit", "Project style", sw.project_style_fit],
      ["problem_lenses", "Problem lenses", sw.problem_lenses.join(" | ")],
      ["delivery_bias", "Delivery bias", sw.delivery_bias],
    );
  } else {
    const rs = context.track_payload_json;
    fields.push(
      ["research_readiness", "Readiness", rs.research_readiness],
      ["methodology_guidance", "Method guidance", rs.methodology_guidance],
      ["viable_methodologies", "Methods", rs.viable_methodologies.join(" | ")],
    );
  }

  const emphasized: string[] = [];
  const standard: string[] = [`Track: ${context.project_track}`];

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

export function buildOptionsSystemPrompt(projectTrack: ProjectTrack) {
  const seedFields =
    projectTrack === "software"
      ? "target_user, problem_statement, core_workflow, mvp_boundary, validation_plan"
      : "research_question, hypothesis_or_focus, methodology, evidence_plan, scope_boundaries, limitation_note";

  const diversityGuidance =
    projectTrack === "software"
      ? [
          "The three options MUST differ along at least two of these axes: (1) target user persona, (2) problem domain angle, (3) technical approach or core technology, (4) project scope/ambition level, (5) output artifact type (tool vs dashboard vs API vs CLI vs data pipeline).",
          "Option 1 should be the most focused and finishable. Option 2 should be the most technically interesting. Option 3 should target the most impressive portfolio outcome.",
        ]
      : [
          "The three options MUST differ along at least two of these axes: (1) research question angle, (2) methodology, (3) evidence type (qualitative vs quantitative vs mixed), (4) scope/ambition level, (5) target deliverable format (paper vs poster vs dataset vs benchmark).",
          "Option 1 should be the most tightly scoped and finishable. Option 2 should be the most methodologically rigorous. Option 3 should aim for the most impressive findings.",
        ];

  return [
    `You generate concise ${projectTrack} project options for Sevri.`,
    "Return only JSON that matches the schema.",
    "Generate exactly 3 options.",
    "Keep titles specific and summaries to 1-2 sentences. Use why_it_fits to explain the connection between this student's specific background and the project — reference their domain anchors, constraints, or goals by name.",
    "Stay grounded in the student's real domain interests and constraints.",
    "Avoid generic student-life, study-habit, or productivity ideas unless the context explicitly supports them.",
    `Each option's track_payload_json must include all seed fields (${seedFields}) with concrete, project-specific values.`,
    "Also return skills_demonstrated, tools_needed, impressiveness_score, and finishability_score for every option.",
    ...diversityGuidance,
    "Scores must reflect the real time budget, skill level, and risk flags rather than generic optimism.",
    "These seed fields become the foundation for roadmap generation - make them specific enough to drive a real execution plan.",
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
    "- Keep the seed payload concrete and useful for later roadmap generation.",
    "- mvp_boundary (or scope_boundaries for research) must define what is IN vs OUT of the first version.",
    "- validation_plan (or limitation_note for research) must describe how the student proves the work succeeded.",
    "- Skills demonstrated should feel resume-relevant and specific to the option.",
    "- Tools needed should be realistic for the student's context, not an aspirational stack dump.",
    "",
    `Creative direction for this student: ${angle}`,
  ].join("\n\n");
}

export function buildRoadmapSystemPrompt(projectTrack: ProjectTrack) {
  return [
    `You create structured execution roadmaps for Sevri ${projectTrack} projects.`,
    "Return only JSON that matches the schema.",
    "Generate 4 to 6 steps.",
    "",
    "project_brief: A 2-4 sentence paragraph that captures WHO the project is for, WHAT problem it solves, HOW the student will approach it, WHY it matters in practice, and WHAT a successful outcome looks like. This becomes the single source of truth for the entire project.",
    "",
    "Each step must have: a sequential order_index starting at 0, a project-specific title (never generic), a concrete objective, a tangible deliverable, a rough time estimate, a validation_check (how the student proves this step is done), and a scope_guardrail (what to avoid or cut during this step).",
    "",
    "cut_if_behind: 1-4 items the student can drop if they fall behind schedule. These must be specific to THIS project.",
    "success_criteria: 2-5 concrete conditions that define project success. Tie them to actual deliverables and evidence, not effort.",
    "",
    "Do not use generic titles like 'Foundation Setup', 'Core Workflow', or 'Polish and Packaging'. Instead, use titles that name a specific project artifact, domain concept, or user-facing feature (e.g., 'Wire the Trace Parser', 'Score the Rubric Matrix', 'Ship the Comparison View'). The title should tell the student exactly WHAT they are building in this step.",
    "Every deliverable must be a concrete artifact, not a phase name.",
    "Do not include long rationale, README text, or extra sections.",
    QUALITY_CLAUSE,
  ].join(" ");
}

export function buildRoadmapUserPrompt(input: {
  projectTrack: ProjectTrack;
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
      `Seed payload: ${JSON.stringify(input.selectedOption.track_payload_json)}`,
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
    "- success_criteria must tie to real deliverables, not effort or process.",
  ].join("\n\n");
}

export function buildStepGuidanceSystemPrompt(projectTrack: ProjectTrack, stepIndex: number, totalSteps: number) {
  const positionGuidance =
    stepIndex === 0
      ? "This is the FIRST step. Focus the guidance on getting started with confidence. Emphasize clarity of setup, early decision-making about tools and scope, and the psychological momentum of producing the first small artifact."
      : stepIndex >= totalSteps - 1
        ? "This is the FINAL step. Focus the guidance on finishing strong. Emphasize packaging the work for its intended audience, honest quality assessment, and creating a narrative about what was accomplished and why."
        : "This is a MIDDLE step. Focus the guidance on maintaining momentum and quality. Emphasize connection to the previous deliverable, concrete progress markers, and scope discipline.";

  return [
    `You generate rich per-step guidance for Sevri ${projectTrack} projects.`,
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
    `Selected option seed: ${JSON.stringify(input.selectedOption.track_payload_json)}`,
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

export function buildWorkEvaluationSystemPrompt(projectTrack: ProjectTrack) {
  return [
    `You evaluate student work submissions for Sevri ${projectTrack} projects.`,
    "Return only JSON that matches the schema.",
    "Evaluate honestly - mark 'not_yet' when something is genuinely missing, not to encourage where encouragement is not warranted.",
    "Each criterion_verdict must map to a specific done_when item or the step's validation_check.",
    "The overall_assessment should synthesize the verdicts into a balanced narrative.",
    "strongest_aspect should name what the student did best - even if the work is incomplete.",
    "clearest_gap should name the most important thing still missing.",
    "next_best_action should give one concrete, actionable step the student can take next.",
    "ready_to_mark_complete should be true only when all criteria genuinely pass.",
    "If you are confident in your assessment, set confidence to 'high'. If parts of the submission are ambiguous, use 'medium' or 'low'.",
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
    ].join("\n"),
    "Done-when criteria to evaluate against:",
    criteria.join("\n"),
    `Submission${input.submissionFilename ? ` (${input.submissionFilename})` : ""}:`,
    input.submissionText,
  ].join("\n\n");
}
