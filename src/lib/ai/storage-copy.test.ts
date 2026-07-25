// Acceptance tests for the copy that roadmap selection writes to the database.
//
// `buildRoadmapStorageArtifacts` is the write path for the Scope page, the
// deferral list, and the Pitch Kit. Every string it produces is checked against
// the content lint, over representative contexts for both tracks.

import assert from "node:assert/strict";
import test from "node:test";
import { formatLintIssues, lintProse } from "../text/content-lint.ts";
import { buildRoadmapOverviewFromStorage, buildRoadmapStorageArtifacts } from "./storage.ts";
import type { GenerationContext, ProjectOption, RoadmapOverview } from "./schemas.ts";

function assertClean(label: string, value: string) {
  const issues = lintProse(value);
  assert.deepEqual(
    issues,
    [],
    `${label} should be clean but was: ${formatLintIssues(issues)}\n  → ${value}`,
  );
}

const SOFTWARE_CONTEXT: GenerationContext = {
  project_track: "software",
  summary: "Your strongest anchors are photonics, optics, and signal processing.",
  interpreted_interests: ["photonics", "optics", "signal processing"],
  skill_assessment: "intermediate",
  risk_flags: [],
  track_payload_json: {
    domain_brief: "Photonics and optics are the core domain anchors for this project.",
    anchor_interests: ["photonics", "optics"],
    goal_signal: "Ship a concrete software project that is easy to demo and defend.",
    resource_snapshot: "8h/week; intermediate experience; tools: TypeScript, Python.",
    anti_generic_warnings: [
      "Do not drift into generic productivity apps.",
      "Reuse the real domain language from the intake.",
    ],
    scope_guardrails: ["Center the MVP on one workflow.", "Cut optional integrations."],
    focus_signal: "Aim for a focused tool in photonics with one sharp user workflow.",
    target_outcome: "portfolio",
    constraints_summary: "No major constraints were stated.",
    weekly_hours: 8,
    project_style_fit: "focused analysis tool",
    problem_lenses: ["Turn a sweep workflow into a usable analysis surface."],
    delivery_bias: "Favor a scoped product with one defensible workflow.",
  },
};

const RESEARCH_CONTEXT: GenerationContext = {
  project_track: "research",
  summary: "Your strongest anchors are photonics and materials science.",
  interpreted_interests: ["photonics", "materials science"],
  skill_assessment: "intermediate",
  risk_flags: ["resource_constraint"],
  track_payload_json: {
    domain_brief: "Photonics and materials science are the core domain anchors.",
    anchor_interests: ["photonics", "materials science"],
    goal_signal: "Deliver a credible research artifact with an evidence path you can defend.",
    resource_snapshot: "6h/week; intermediate experience; method preference: data analysis.",
    anti_generic_warnings: [
      "Do not drift into generic student-life research.",
      "Reuse the real domain language from the intake.",
    ],
    scope_guardrails: ["Choose one primary question.", "State the limitation early."],
    focus_signal: "Keep the research question narrow inside photonics.",
    target_outcome: "portfolio",
    constraints_summary: "No major constraints were stated.",
    weekly_hours: 6,
    research_readiness: "You can handle a structured method with a clear procedure.",
    methodology_guidance: "Preferred method is data analysis.",
    viable_methodologies: ["secondary data analysis", "focused literature review"],
  },
};

const SOFTWARE_OPTION: ProjectOption = {
  id: "waveguide-loss-explorer",
  project_track: "software",
  title: "Waveguide Loss Explorer",
  summary:
    "Build a focused tool that compares propagation loss across waveguide sweeps and highlights the dominant driver.",
  why_it_fits:
    "The student's photonics coursework gives them the vocabulary to defend every design decision here.",
  difficulty: "intermediate",
  estimated_weeks: 8,
  skills_demonstrated: ["data modeling", "technical communication"],
  tools_needed: ["TypeScript", "React"],
  impressiveness_score: 8,
  finishability_score: 7,
  track_payload_json: {
    target_user: "Students validating photonics experiments",
    problem_statement: "Loss measurements are scattered across notebooks and are hard to compare.",
    core_workflow:
      "The app walks the user through loading a sweep, comparing runs, and saving the result.",
    mvp_boundary: "One sweep type and one comparison view are in scope; batch imports are out.",
    validation_plan: "Run the tool on three real sweeps and confirm a peer can read the output.",
  },
};

const RESEARCH_OPTION: ProjectOption = {
  id: "silicon-waveguide-loss-study",
  project_track: "research",
  title: "Silicon Waveguide Loss Study",
  summary:
    "Design a student-scale study that isolates the strongest driver of propagation loss in silicon waveguides.",
  why_it_fits:
    "It gives the student a believable question they can defend with evidence they can actually reach.",
  difficulty: "intermediate",
  estimated_weeks: 9,
  skills_demonstrated: ["evidence framing", "data interpretation"],
  tools_needed: ["spreadsheet", "public dataset"],
  impressiveness_score: 8,
  finishability_score: 8,
  track_payload_json: {
    research_question: "What most strongly drives propagation loss in silicon waveguides?",
    hypothesis_or_focus: "Sidewall roughness dominates loss more than doping level does.",
    methodology: "Secondary data analysis.",
    evidence_plan: "Use one published waveguide dataset with reported loss and geometry.",
    scope_boundaries: "One factor, one dataset, and one outcome measure are in scope.",
    limitation_note: "Findings are correlational within a single dataset.",
  },
};

function buildRoadmap(overrides: Partial<RoadmapOverview> = {}): RoadmapOverview {
  return {
    project_title: "Waveguide Loss Explorer",
    short_overview:
      "A focused tool that compares waveguide sweeps and names the dominant loss driver.",
    project_brief:
      "This project builds a comparison surface for waveguide loss measurements so a single sweep can be read at a glance and defended in an interview.",
    steps: [
      {
        order_index: 0,
        title: "Lock the comparison scope",
        objective: "Name the user, the sweep format, and the exact comparison before building.",
        deliverable: "A product scope brief with a success rubric.",
        rough_time_estimate: "3-4 days",
        validation_check: "The brief names the user, the format, and two success criteria.",
        scope_guardrail: "Do not start building until the brief is written.",
      },
      {
        order_index: 1,
        title: "Wire the sweep parser",
        objective: "Turn a raw sweep file into a structured record the comparison can read.",
        deliverable: "A working parser with three fixture files.",
        rough_time_estimate: "1 week",
        validation_check: "Three real sweeps parse without manual cleanup.",
        scope_guardrail: "Support one sweep format only.",
      },
      {
        order_index: 2,
        title: "Ship the comparison view",
        objective: "Render two parsed sweeps side by side with the dominant driver called out.",
        deliverable: "A comparison screen with one annotated result.",
        rough_time_estimate: "1-2 weeks",
        validation_check: "A peer can name the dominant driver from the screen alone.",
        scope_guardrail: "One comparison view, no export or sharing.",
      },
      {
        order_index: 3,
        title: "Package the demo",
        objective: "Tighten the demo path and write the walkthrough.",
        deliverable: "A demo-ready build and walkthrough notes.",
        rough_time_estimate: "4-5 days",
        validation_check: "Someone unfamiliar can follow the walkthrough end to end.",
        scope_guardrail: "Polish only the demo path.",
      },
    ],
    cut_if_behind: [
      "Drop the annotation layer and keep the raw comparison table.",
      "Visual polish beyond basic usability",
    ],
    success_criteria: [
      "Three real sweeps parse and compare without manual cleanup.",
      "You can explain why the dominant driver is what the tool says it is.",
    ],
    pitch_kit: null,
    ...overrides,
  };
}

function allStrings(artifacts: ReturnType<typeof buildRoadmapStorageArtifacts>) {
  const guide = artifacts.explanationGuide;
  return [
    ["mvpScope", artifacts.mvpScope] as const,
    ...artifacts.stretchGoals.map((goal, index) => [`stretchGoals[${index}]`, goal] as const),
    ["elevator_pitch", guide.elevator_pitch] as const,
    ...guide.resume_bullets.map((bullet, index) => [`resume_bullets[${index}]`, bullet] as const),
    ...guide.interview_talking_points.map(
      (point, index) => [`talking_points[${index}]`, point] as const,
    ),
  ];
}

test("software roadmap artifacts are clean prose", () => {
  const artifacts = buildRoadmapStorageArtifacts({
    context: SOFTWARE_CONTEXT,
    selectedOption: SOFTWARE_OPTION,
    roadmap: buildRoadmap(),
  });

  for (const [label, value] of allStrings(artifacts)) {
    assertClean(label, value);
  }
});

test("research roadmap artifacts are clean prose", () => {
  const artifacts = buildRoadmapStorageArtifacts({
    context: RESEARCH_CONTEXT,
    selectedOption: RESEARCH_OPTION,
    roadmap: buildRoadmap({
      project_title: "Silicon Waveguide Loss Study",
      short_overview:
        "A student-scale study isolating the strongest driver of loss in silicon waveguides.",
    }),
  });

  for (const [label, value] of allStrings(artifacts)) {
    assertClean(label, value);
  }
});

test("the scope statement no longer stitches a sentence into a clause", () => {
  const artifacts = buildRoadmapStorageArtifacts({
    context: SOFTWARE_CONTEXT,
    selectedOption: SOFTWARE_OPTION,
    roadmap: buildRoadmap(),
  });

  // The old template produced "Keep the MVP centered on <sentence>. and avoid ...".
  assert.ok(!artifacts.mvpScope.includes("centered on the app walks"));
  assert.ok(!/\.\s+and\b/u.test(artifacts.mvpScope));
  assert.ok(artifacts.mvpScope.includes("The app walks the user through"));
});

test("deferrals are phrased as deferrals, not as cut-now instructions", () => {
  const artifacts = buildRoadmapStorageArtifacts({
    context: SOFTWARE_CONTEXT,
    selectedOption: SOFTWARE_OPTION,
    roadmap: buildRoadmap(),
  });

  assert.ok(artifacts.stretchGoals.every((goal) => goal.startsWith("Later: ")));
  assert.ok(artifacts.stretchGoals.every((goal) => !goal.includes("Stretch later:")));
  assert.ok(artifacts.stretchGoals.every((goal) => !/^Later:\s+(Drop|Remove|Cut|Skip)\b/u.test(goal)));
});

test("no stored artifact refers to the student in the third person", () => {
  const artifacts = buildRoadmapStorageArtifacts({
    context: SOFTWARE_CONTEXT,
    selectedOption: SOFTWARE_OPTION,
    roadmap: buildRoadmap(),
  });

  for (const [label, value] of allStrings(artifacts)) {
    assert.ok(!/the student/iu.test(value), `${label} refers to "the student": ${value}`);
    assert.ok(!/Sevri's/u.test(value), `${label} names Sevri: ${value}`);
  }
});

test("a model-written pitch kit is stored verbatim and not marked as a draft", () => {
  const pitchKit = {
    elevator_pitch:
      "Waveguide Loss Explorer turns a pile of sweep files into one readable comparison. You load two runs, and it names the dominant loss driver with the evidence beside it.",
    resume_bullets: [
      "Built Waveguide Loss Explorer, a comparison tool that parses raw photonics sweeps and surfaces the dominant loss driver.",
      "Scoped the MVP to a single sweep format and validated the parser against three real measurement files.",
    ],
    talking_points: [
      {
        label: "Why this project",
        body: "You already read sweep data by hand, so you know exactly where the comparison breaks down.",
      },
      {
        label: "What it does",
        body: "It parses two sweeps, lines them up, and names the dominant loss driver in one screen.",
      },
      {
        label: "Why it matters",
        body: "Comparing runs by hand is slow and error-prone, and one readable view removes both problems.",
      },
    ],
  };

  const artifacts = buildRoadmapStorageArtifacts({
    context: SOFTWARE_CONTEXT,
    selectedOption: SOFTWARE_OPTION,
    roadmap: buildRoadmap({ pitch_kit: pitchKit }),
  });

  assert.equal(artifacts.explanationGuide.source, "model");
  assert.equal(artifacts.explanationGuide.elevator_pitch, pitchKit.elevator_pitch);
  assert.deepEqual(artifacts.explanationGuide.resume_bullets, pitchKit.resume_bullets);
  for (const [label, value] of allStrings(artifacts)) {
    assertClean(label, value);
  }
});

test("a generated pitch kit that still reads badly is replaced by a clean draft", () => {
  const artifacts = buildRoadmapStorageArtifacts({
    context: SOFTWARE_CONTEXT,
    selectedOption: SOFTWARE_OPTION,
    roadmap: buildRoadmap({
      pitch_kit: {
        elevator_pitch:
          "Waveguide Loss Explorer was built for the student to compare sweeps. and it names the dominant loss driver in one screen.",
        resume_bullets: [
          "Built Waveguide Loss Explorer, a comparison tool that parses raw photonics sweeps and surfaces the loss driver.",
          "Scoped the MVP to a single sweep format and validated the parser against three real measurement files.",
        ],
        talking_points: [
          {
            label: "Why this project",
            body: "The student already reads sweep data by hand, so they know where the comparison breaks down.",
          },
          {
            label: "What it does",
            body: "It parses two sweeps, lines them up, and names the dominant loss driver in one screen.",
          },
          {
            label: "Why it matters",
            body: "Comparing runs by hand is slow and error-prone, and one readable view removes both problems.",
          },
        ],
      },
    }),
  });

  assert.equal(artifacts.explanationGuide.source, "draft");
  for (const [label, value] of allStrings(artifacts)) {
    assertClean(label, value);
  }
});

test("a roadmap with no pitch kit produces a labeled draft", () => {
  const artifacts = buildRoadmapStorageArtifacts({
    context: SOFTWARE_CONTEXT,
    selectedOption: SOFTWARE_OPTION,
    roadmap: buildRoadmap(),
  });

  assert.equal(artifacts.explanationGuide.source, "draft");
});

test("roadmaps stored without a pitch kit rehydrate without one", () => {
  const roadmap = buildRoadmapOverviewFromStorage({
    projectTitle: "Waveguide Loss Explorer",
    roadmapOverview: "A focused tool that compares waveguide sweeps and names the loss driver.",
    trackPayloadJson: {
      project_brief: "A brief that is long enough to satisfy the schema minimum for this field.",
    },
    milestones: [
      { order_index: 0, title: "Lock the comparison scope", objective: "Name the user and format." },
      { order_index: 1, title: "Wire the sweep parser", objective: "Parse one sweep format." },
      { order_index: 2, title: "Ship the comparison view", objective: "Render two sweeps." },
      { order_index: 3, title: "Package the demo", objective: "Tighten the demo path." },
    ],
  });

  assert.equal(roadmap.pitch_kit ?? null, null);
});

test("a malformed stored pitch kit is dropped rather than breaking rehydration", () => {
  const roadmap = buildRoadmapOverviewFromStorage({
    projectTitle: "Waveguide Loss Explorer",
    roadmapOverview: "A focused tool that compares waveguide sweeps and names the loss driver.",
    trackPayloadJson: {
      project_brief: "A brief that is long enough to satisfy the schema minimum for this field.",
      pitch_kit: { elevator_pitch: "too short", resume_bullets: [], talking_points: [] },
    },
    milestones: [
      { order_index: 0, title: "Lock the comparison scope", objective: "Name the user and format." },
      { order_index: 1, title: "Wire the sweep parser", objective: "Parse one sweep format." },
      { order_index: 2, title: "Ship the comparison view", objective: "Render two sweeps." },
      { order_index: 3, title: "Package the demo", objective: "Tighten the demo path." },
    ],
  });

  assert.equal(roadmap.pitch_kit ?? null, null);
});
