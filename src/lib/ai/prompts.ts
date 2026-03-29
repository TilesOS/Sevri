import type { GenerationContext, ProjectTrack, ProjectOption, RoadmapOverview, RoadmapStep } from "@/lib/ai/schemas";

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
    `Weekly hours: ${payload.weekly_hours}`,
    `Constraints: ${payload.constraints_summary}`,
    `Scope guardrails: ${payload.scope_guardrails.join(" | ")}`,
    `Focus: ${payload.focus_signal}`,
    `Readiness: ${payload.research_readiness}`,
    `Mentor notes: ${payload.mentor_resource_notes}`,
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
    "These seed fields become the foundation for roadmap generation — make them specific enough to drive a real execution plan.",
  ].join(" ");
}

export function buildOptionsUserPrompt(context: GenerationContext) {
  return [
    "Student context:",
    formatContext(context),
    "Requirements:",
    "- Make the three options clearly different from each other.",
    "- Each option should feel finishable for the stated time budget.",
    "- Keep the seed payload concrete and useful for later roadmap generation.",
    "- mvp_boundary (or scope_boundaries for research) must define what is IN vs OUT of the first version.",
    "- validation_plan (or limitation_note for research) must describe how the student proves the work succeeded.",
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
    "Do not use generic titles like 'Foundation Setup', 'Core Workflow', 'Polish and Packaging'.",
    "Every deliverable must be a concrete artifact, not a phase name.",
    "Do not include long rationale, README text, or extra sections.",
  ].join(" ");
}

export function buildRoadmapUserPrompt(input: {
  projectTrack: ProjectTrack;
  context: GenerationContext;
  selectedOption: ProjectOption;
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
    "The done_when criteria must tie directly to the step's validation_check — do not invent abstract completion conditions.",
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
    .map(
      (s) =>
        `Step ${s.order_index}: ${s.title} → ${s.deliverable} (${s.rough_time_estimate})`,
    )
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
    "Full roadmap:",
    fullRoadmap,
    "Current roadmap step:",
    stepContext.join("\n"),
    "Requirements:",
    "- The checklist should be in a realistic execution order.",
    "- Deliverables should match the current step, not the whole project.",
    "- Pitfalls should warn about project-specific mistakes and scope drift for THIS step.",
    "- done_when criteria must be tied to the step's validation_check.",
    "- The email_version should be ready for a future coaching email.",
  ].join("\n\n");
}
