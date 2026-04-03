import type { GenerationContext, ProjectOption, ProjectTrack, RoadmapOverview, RoadmapStep, StepGuidance } from "@/lib/ai/schemas";

export interface PromptFeedbackItem {
  signal: "good" | "mixed" | "bad";
  notes: string | null;
  contextLabel?: string | null;
}

function formatFeedback(feedback: PromptFeedbackItem[] | undefined) {
  if (!feedback || feedback.length === 0) {
    return "No prior user feedback is available for this stage.";
  }

  return feedback
    .map((item, index) => {
      const note = item.notes?.trim() ? item.notes.trim() : "No written note.";
      const label = item.contextLabel?.trim() ? ` (${item.contextLabel.trim()})` : "";
      return `${index + 1}. ${item.signal.toUpperCase()}${label}: ${note}`;
    })
    .join("\n");
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

function formatContext(context: GenerationContext) {
  if (context.project_track === "software") {
    const payload = context.track_payload_json;
    return [
      `Track: ${context.project_track}`,
      `Summary: ${context.summary}`,
      `Skill level: ${context.skill_assessment}`,
      `Anchors: ${payload.anchor_interests.join(", ")}`,
      `Domain brief: ${payload.domain_brief}`,
      `Goal: ${payload.goal_signal}`,
      `Target outcome: ${payload.target_outcome}`,
      `Resources: ${payload.resource_snapshot}`,
      `Anti-generic warnings: ${payload.anti_generic_warnings.join(" | ")}`,
      `Weekly hours: ${payload.weekly_hours}`,
      `Constraints: ${payload.constraints_summary}`,
      `Scope guardrails: ${payload.scope_guardrails.join(" | ")}`,
      `Focus: ${payload.focus_signal}`,
      `Project style: ${payload.project_style_fit}`,
      `Problem lenses: ${payload.problem_lenses.join(" | ")}`,
      `Delivery bias: ${payload.delivery_bias}`,
      ...(context.risk_flags.length > 0 ? [`Risk flags: ${context.risk_flags.join(", ")}`] : []),
    ].join("\n");
  }

  const payload = context.track_payload_json;
  return [
    `Track: ${context.project_track}`,
    `Summary: ${context.summary}`,
    `Skill level: ${context.skill_assessment}`,
    `Anchors: ${payload.anchor_interests.join(", ")}`,
    `Domain brief: ${payload.domain_brief}`,
    `Goal: ${payload.goal_signal}`,
    `Target outcome: ${payload.target_outcome}`,
    `Resources: ${payload.resource_snapshot}`,
    `Anti-generic warnings: ${payload.anti_generic_warnings.join(" | ")}`,
    `Weekly hours: ${payload.weekly_hours}`,
    `Constraints: ${payload.constraints_summary}`,
    `Scope guardrails: ${payload.scope_guardrails.join(" | ")}`,
    `Focus: ${payload.focus_signal}`,
    `Readiness: ${payload.research_readiness}`,
    `Method guidance: ${payload.methodology_guidance}`,
    `Methods: ${payload.viable_methodologies.join(" | ")}`,
    ...(context.risk_flags.length > 0 ? [`Risk flags: ${context.risk_flags.join(", ")}`] : []),
  ].join("\n");
}

export function buildOptionsSystemPrompt(projectTrack: ProjectTrack) {
  const seedFields =
    projectTrack === "software"
      ? "target_user, problem_statement, core_workflow, mvp_boundary, validation_plan"
      : "research_question, hypothesis_or_focus, methodology, evidence_plan, scope_boundaries, limitation_note";

  return [
    `You generate concise ${projectTrack} project options for Sevri.`,
    "Return only JSON that matches the schema.",
    "Generate exactly 3 options.",
    "Keep titles specific, summaries to 1-2 sentences, and why_it_fits to one sentence.",
    "Stay grounded in the student's real domain interests and constraints.",
    "Avoid generic student-life, study-habit, or productivity ideas unless the context explicitly supports them.",
    `Each option's track_payload_json must include all seed fields (${seedFields}) with concrete, project-specific values.`,
    "Also return skills_demonstrated, tools_needed, impressiveness_score, and finishability_score for every option.",
    "Make the three options genuinely different in user/problem/workflow shape for software or question/method shape for research.",
    "Scores must reflect the real time budget, skill level, and risk flags rather than generic optimism.",
    "These seed fields become the foundation for roadmap generation - make them specific enough to drive a real execution plan.",
  ].join(" ");
}

export function buildOptionsUserPrompt(context: GenerationContext, feedback?: PromptFeedbackItem[]) {
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
  ].join("\n\n");
}

export function buildRoadmapSystemPrompt(projectTrack: ProjectTrack) {
  return [
    `You create structured execution roadmaps for Sevri ${projectTrack} projects.`,
    "Return only JSON that matches the schema.",
    "Generate 4 to 6 steps.",
    "",
    "project_brief: A 2-4 sentence paragraph that captures WHO the project is for, WHAT problem it solves, HOW the student will approach it, and WHAT a successful outcome looks like. This becomes the single source of truth for the entire project.",
    "",
    "Each step must have: a sequential order_index starting at 0, a project-specific title (never generic), a concrete objective, a tangible deliverable, a rough time estimate, a validation_check (how the student proves this step is done), and a scope_guardrail (what to avoid or cut during this step).",
    "",
    "cut_if_behind: 1-4 items the student can drop if they fall behind schedule. These must be specific to THIS project.",
    "success_criteria: 2-5 concrete conditions that define project success. Tie them to actual deliverables and evidence, not effort.",
    "",
    "Do not use generic titles like 'Foundation Setup', 'Core Workflow', or 'Polish and Packaging'.",
    "Every deliverable must be a concrete artifact, not a phase name.",
    "Do not include long rationale, README text, or extra sections.",
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
    "- The roadmap should feel practical for the student to start immediately.",
    "- Keep each step scoped tightly enough for a synchronous product experience.",
    "- Every step's deliverable must be a concrete artifact the student can point to.",
    "- validation_check for each step must describe observable evidence that the step is complete.",
    "- scope_guardrail for each step must name the most likely scope creep risk for that step.",
    "- cut_if_behind items must be specific features, sections, or sub-tasks from THIS project.",
    "- success_criteria must tie to real deliverables, not effort or process.",
  ].join("\n\n");
}

export function buildStepGuidanceSystemPrompt(projectTrack: ProjectTrack) {
  return [
    `You generate rich per-step guidance for Sevri ${projectTrack} projects.`,
    "Return only JSON that matches the schema.",
    "Be specific, actionable, and encouraging without filler.",
    "Assume the student needs a clear next move, a realistic checklist, and honest pitfalls.",
    "Make the advice detailed enough to feel premium, but keep every bullet practical.",
    "The done_when criteria must tie directly to the step's validation_check - do not invent abstract completion conditions.",
    "Pitfalls must reference real risks specific to this project and step, not generic advice.",
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
