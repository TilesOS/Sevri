import type { GenerationContext, ProjectTrack, ProjectOption, RoadmapOverview, RoadmapStep } from "@/lib/ai/schemas";

function formatContext(context: GenerationContext) {
  if (context.project_track === "software") {
    const payload = context.track_payload_json;
    const lines = [
      `Track: ${context.project_track}`,
      `Summary: ${context.summary}`,
      `Anchors: ${payload.anchor_interests.join(", ")}`,
      `Goal: ${payload.goal_signal}`,
      `Resources: ${payload.resource_snapshot}`,
      `Weekly hours: ${payload.weekly_hours}`,
      `Constraints: ${payload.constraints_summary}`,
      `Focus: ${payload.focus_signal}`,
    ];
    lines.push(`Project style: ${payload.project_style_fit}`);
    lines.push(`Problem lenses: ${payload.problem_lenses.join(" | ")}`);
    return lines.join("\n");
  }

  const payload = context.track_payload_json;
  const lines = [
    `Track: ${context.project_track}`,
    `Summary: ${context.summary}`,
    `Anchors: ${payload.anchor_interests.join(", ")}`,
    `Goal: ${payload.goal_signal}`,
    `Resources: ${payload.resource_snapshot}`,
    `Weekly hours: ${payload.weekly_hours}`,
    `Constraints: ${payload.constraints_summary}`,
    `Focus: ${payload.focus_signal}`,
  ];
  lines.push(`Readiness: ${payload.research_readiness}`);
  lines.push(`Methods: ${payload.viable_methodologies.join(" | ")}`);
  return lines.join("\n");
}

export function buildOptionsSystemPrompt(projectTrack: ProjectTrack) {
  return [
    `You generate concise ${projectTrack} project options for Sevri.`,
    "Return only JSON that matches the schema.",
    "Generate exactly 3 options.",
    "Keep titles specific, summaries to 1-2 sentences, and why_it_fits to one sentence.",
    "Stay grounded in the student's real domain interests and constraints.",
    "Avoid generic student-life, study-habit, or productivity ideas unless the context explicitly supports them.",
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
  ].join("\n\n");
}

export function buildRoadmapSystemPrompt(projectTrack: ProjectTrack) {
  return [
    `You create fast roadmap overviews for Sevri ${projectTrack} projects.`,
    "Return only JSON that matches the schema.",
    "Keep the overview short and concrete.",
    "Generate 4 to 6 steps.",
    "Each step must have a sequential order_index starting at 0, a project-specific title, a concrete objective, a deliverable, and a rough time estimate.",
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
    "- The roadmap should feel practical for the student to start immediately.",
    "- Keep each step scoped tightly enough for a synchronous product experience.",
    "- Mention concrete deliverables instead of vague phase names.",
  ].join("\n\n");
}

export function buildStepGuidanceSystemPrompt(projectTrack: ProjectTrack) {
  return [
    `You generate rich per-step guidance for Sevri ${projectTrack} projects.`,
    "Return only JSON that matches the schema.",
    "Be specific, actionable, and encouraging without filler.",
    "Assume the student needs a clear next move, a realistic checklist, and honest pitfalls.",
    "Make the advice detailed enough to feel premium, but keep every bullet practical.",
  ].join(" ");
}

export function buildStepGuidanceUserPrompt(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  roadmap: RoadmapOverview;
  step: RoadmapStep;
}) {
  return [
    "Student context:",
    formatContext(input.context),
    "Project:",
    [
      `Title: ${input.roadmap.project_title}`,
      `Overview: ${input.roadmap.short_overview}`,
      `Selected option summary: ${input.selectedOption.summary}`,
      `Selected option seed: ${JSON.stringify(input.selectedOption.track_payload_json)}`,
    ].join("\n"),
    "Current roadmap step:",
    [
      `Title: ${input.step.title}`,
      `Objective: ${input.step.objective}`,
      `Deliverable: ${input.step.deliverable}`,
      `Time estimate: ${input.step.rough_time_estimate}`,
    ].join("\n"),
    "Requirements:",
    "- The checklist should be in a realistic execution order.",
    "- Deliverables should match the current step, not the whole project.",
    "- Pitfalls should warn about common student mistakes and scope drift.",
    "- The email_version should be ready for a future coaching email.",
  ].join("\n\n");
}
