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
  NormalizedProfileSchema,
  RecommendationBatchSchema,
  RoadmapSchema,
  type NormalizedProfile,
  type RecommendationBatch,
  type Roadmap,
} from "@/lib/ai/schemas";

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
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

function fallbackNormalizedProfile(rawIntake: Record<string, unknown>): NormalizedProfile {
  const interests = [
    ...toStringArray(rawIntake.interests),
    ...toStringArray(rawIntake.favorite_subjects),
    ...toStringArray(rawIntake.preferred_project_style),
  ];

  const interpretedInterests = Array.from(new Set(interests)).slice(0, 8);
  const skill = coerceSkillAssessment(rawIntake.coding_experience);
  const weeklyHours = Number(rawIntake.weekly_time_available ?? 0);
  const preferredDifficulty = String(rawIntake.preferred_difficulty ?? "").toLowerCase();

  const riskFlags = new Set<"too_ambitious" | "too_vague" | "too_advanced" | "too_little_time" | "misaligned_goal">();

  if (interpretedInterests.length === 0) {
    riskFlags.add("too_vague");
  }

  if (weeklyHours > 0 && weeklyHours <= 3) {
    riskFlags.add("too_little_time");
  }

  if (skill === "beginner" && preferredDifficulty.includes("advanced")) {
    riskFlags.add("too_advanced");
  }

  if (weeklyHours > 0 && weeklyHours <= 4 && preferredDifficulty.includes("intermediate")) {
    riskFlags.add("too_ambitious");
  }

  const summary = [
    `Student profile indicates ${skill} coding experience with about ${weeklyHours || "limited"} hours per week available.`,
    `Interests center on ${interpretedInterests.slice(0, 3).join(", ") || "software project exploration"}.`,
    "Scope should prioritize a focused MVP that can be finished and clearly explained for portfolio outcomes.",
  ].join(" ");

  return NormalizedProfileSchema.parse({
    summary,
    interpreted_interests: interpretedInterests.length ? interpretedInterests : ["software engineering", "project-based learning"],
    skill_assessment: skill,
    risk_flags: Array.from(riskFlags),
  });
}

function fallbackRecommendations(normalizedProfile: NormalizedProfile): RecommendationBatch {
  const [interestA = "productivity", interestB = "education", interestC = "analytics"] =
    normalizedProfile.interpreted_interests;

  const templates = [
    {
      id: "project_1",
      title: `${interestA} Progress Dashboard`,
      summary:
        `Build a focused web app that helps users track weekly goals in ${interestA}, visualize progress, and reflect on outcomes with clear metrics and notes.`,
      rationale:
        "This fits because it demonstrates full-stack delivery while keeping feature scope small enough to ship consistently with student time constraints.",
      difficulty: "beginner_intermediate" as const,
      estimated_weeks: 6,
      weekly_hours: 6,
      skills_demonstrated: ["Product scoping", "Frontend development", "API design", "Data modeling"],
      tools_needed: ["Next.js", "TypeScript", "Supabase", "Tailwind CSS"],
      impressiveness_score: 7,
      finishability_score: 9,
      authenticity_note:
        "Use your own habits and constraints as real data so the project narrative is personal and defensible.",
    },
    {
      id: "project_2",
      title: `${interestB} Opportunity Matcher`,
      summary:
        `Create a recommendation tool that matches students to ${interestB}-related opportunities based on interests, schedule, and experience level using transparent scoring rules.`,
      rationale:
        "This aligns with portfolio goals by showcasing practical problem framing, decision logic, and clear user value without requiring heavy infrastructure.",
      difficulty: "beginner_intermediate" as const,
      estimated_weeks: 7,
      weekly_hours: 6,
      skills_demonstrated: ["Business logic modeling", "Form UX", "Ranking systems", "Project communication"],
      tools_needed: ["Next.js", "TypeScript", "PostgreSQL", "Zod"],
      impressiveness_score: 8,
      finishability_score: 8,
      authenticity_note:
        "Anchor the scoring criteria in your own decision process so reviewers can see original thinking instead of generic AI output.",
    },
    {
      id: "project_3",
      title: `${interestC} Study Insight Engine`,
      summary:
        `Develop a lightweight analytics workspace that converts study/session logs into practical insights, weekly plans, and trend summaries students can act on immediately.`,
      rationale:
        "This project shows technical clarity and real-world usefulness while maintaining a realistic MVP boundary centered on one strong workflow.",
      difficulty: "intermediate" as const,
      estimated_weeks: 8,
      weekly_hours: 7,
      skills_demonstrated: ["Data pipelines", "UI state management", "Visualization", "Iteration planning"],
      tools_needed: ["Next.js", "TypeScript", "Supabase", "Chart library"],
      impressiveness_score: 8,
      finishability_score: 7,
      authenticity_note:
        "Use your own historical study patterns for examples and explain tradeoffs in your README for credibility.",
    },
  ];

  return RecommendationBatchSchema.parse({ recommendations: templates });
}

function fallbackRoadmap(input: {
  selectedProject: Record<string, unknown>;
  detailLevel: "limited" | "full";
}): Roadmap {
  const title = String(input.selectedProject.title ?? "Student Project");

  return RoadmapSchema.parse({
    overview:
      `${title} is a scoped portfolio project designed to prove full-stack execution, practical product thinking, and finishability within student time constraints.`,
    mvp_scope:
      "Ship one core workflow end-to-end: user input, persistent data, summary view, and one insight/action output. Exclude advanced integrations until the core loop is stable.",
    feature_ladder: {
      must_have: [
        "Authentication and user-specific data",
        "Core create/read/update flow for the project domain",
        "Dashboard view with actionable summary",
      ],
      should_have: ["Progress tracking and milestone history", "Improved UX states and validation"],
      could_have: ["Export/share view", "Advanced analytics or automation"],
    },
    milestones: [
      {
        order_index: 0,
        title: "Foundation Setup",
        description: "Set up repo, environment variables, auth, base schema, and a deployable app shell.",
      },
      {
        order_index: 1,
        title: "Core Workflow",
        description: "Implement the primary user flow with persistence and end-to-end validation.",
      },
      {
        order_index: 2,
        title: "Insight Layer",
        description: "Add summaries and user-facing output that clearly demonstrates project value.",
      },
      {
        order_index: 3,
        title: "Polish and Packaging",
        description: "Finalize README, screenshots, demo narrative, and application/interview talking points.",
      },
    ],
    repo_structure: [
      { path: "src/app", purpose: "App routes, layouts, and API handlers." },
      { path: "src/components", purpose: "Reusable UI and feature components." },
      { path: "src/lib", purpose: "Domain services, integrations, validation, and utilities." },
      { path: "supabase/migrations", purpose: "Database schema evolution and RLS policies." },
      { path: "README.md", purpose: "Project narrative, setup guide, and architecture decisions." },
    ],
    readme_draft:
      `# ${title}\n\n## Problem\nStudents need a practical way to execute one authentic project with clear scope and outcomes.\n\n## MVP\nThis app delivers a complete core workflow from input to tracked output with persistent data and clear progress visibility.\n\n## Stack\nNext.js, TypeScript, Tailwind, Supabase.\n\n## What I Built\n- Authenticated user workspace\n- Core domain workflow with CRUD\n- Dashboard summary and milestone tracking\n\n## Tradeoffs\nI prioritized finishability and clarity over broad feature expansion.\n\n## Next Steps\nAdd export/share and deeper analytics after stabilizing the core loop.`,
    cut_if_behind: [
      "Delay advanced analytics or recommendation variants",
      "Skip export features until core workflow polish is complete",
    ],
    stretch_goals:
      input.detailLevel === "full"
        ? ["Portfolio one-click export", "Automated weekly status digest", "Interactive project demo mode"]
        : ["One optional export format", "One additional dashboard view"],
    explanation_guide: {
      elevator_pitch:
        `${title} is a focused full-stack project that solves a real student workflow problem with a scoped MVP and measurable progress outcomes.`,
      resume_bullets: [
        "Built and shipped a full-stack web app with authentication, typed APIs, and relational data modeling.",
        "Designed a scoped MVP roadmap and delivered milestone-based execution with clear technical tradeoffs.",
      ],
      interview_talking_points: [
        "How scope boundaries were set to maximize finishability and impact.",
        "How data model and API decisions supported future extensibility.",
        "What was intentionally cut to ship on time and what would be added next.",
      ],
    },
  });
}

export async function runProfileNormalization(rawIntake: Record<string, unknown>) {
  try {
    return await generateStructuredOutput({
      schema: NormalizedProfileSchema,
      systemPrompt: buildNormalizeSystemPrompt(),
      userPrompt: buildNormalizeUserPrompt({ intakeJson: JSON.stringify(rawIntake) }),
      maxRetries: 2,
    });
  } catch (error) {
    const parsed = fallbackNormalizedProfile(rawIntake);
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
      systemPrompt: buildRecommendationsSystemPrompt(),
      userPrompt: buildRecommendationsUserPrompt({ normalizedProfileJson: JSON.stringify(normalizedProfile) }),
      maxRetries: 2,
    });

    const withSafeIds = result.parsed.recommendations.map((item, index) => ({
      ...item,
      id: item.id || `project_${index + 1}`,
    }));

    return {
      parsed: {
        recommendations: withSafeIds,
      },
      raw: result.raw,
    };
  } catch (error) {
    const parsed = fallbackRecommendations(normalizedProfile);
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
  try {
    return await generateStructuredOutput({
      schema: RoadmapSchema,
      systemPrompt: buildRoadmapSystemPrompt(),
      userPrompt: buildRoadmapUserPrompt({
        selectedProjectJson: JSON.stringify(input.selectedProject),
        normalizedProfileJson: JSON.stringify(input.normalizedProfile),
        detailLevel: input.detailLevel,
      }),
      maxRetries: 2,
    });
  } catch (error) {
    const parsed = fallbackRoadmap({
      selectedProject: input.selectedProject,
      detailLevel: input.detailLevel,
    });

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
