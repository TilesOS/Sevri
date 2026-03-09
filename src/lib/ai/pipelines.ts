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

function fallbackSoftwareNormalizedProfile(rawIntake: Record<string, unknown>): NormalizedProfile {
  const interests = [
    ...toStringArray(rawIntake.interests),
    ...toStringArray(rawIntake.favorite_subjects),
    ...toStringArray(rawIntake.preferred_project_style),
  ];

  const interpretedInterests = Array.from(new Set(interests)).slice(0, 8);
  const skill = coerceSkillAssessment(rawIntake.coding_experience);
  const weeklyHours = Number(rawIntake.weekly_time_available ?? 0);
  const preferredDifficulty = String(rawIntake.preferred_difficulty ?? "").toLowerCase();

  const riskFlags = new Set<
    "too_ambitious" | "too_vague" | "too_advanced" | "too_little_time" | "misaligned_goal"
  >();

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

  return SoftwareNormalizedProfileSchema.parse({
    project_track: "software",
    summary,
    interpreted_interests: interpretedInterests.length
      ? interpretedInterests
      : ["software engineering", "project-based learning"],
    skill_assessment: skill,
    risk_flags: Array.from(riskFlags),
    track_payload_json: {
      project_style_fit: "Strong fit for a scoped software project with one clear end-to-end workflow.",
      scope_guardrails: ["Keep MVP narrow", "Cut optional integrations if timeline slips"],
    },
  });
}

function fallbackResearchNormalizedProfile(rawIntake: Record<string, unknown>): NormalizedProfile {
  const interests = [
    ...toStringArray(rawIntake.interests),
    ...toStringArray(rawIntake.favorite_subjects),
    ...toStringArray(rawIntake.preferred_research_domain),
  ];

  const interpretedInterests = Array.from(new Set(interests)).slice(0, 8);
  const skill = coerceSkillAssessment(rawIntake.research_experience);
  const weeklyHours = Number(rawIntake.weekly_time_available ?? 0);
  const mentorAccess = String(rawIntake.mentor_access ?? "limited").toLowerCase();

  const riskFlags = new Set<
    "too_ambitious" | "too_vague" | "too_little_time" | "insufficient_guidance" | "resource_constraint"
  >();

  if (interpretedInterests.length === 0) {
    riskFlags.add("too_vague");
  }

  if (weeklyHours > 0 && weeklyHours <= 3) {
    riskFlags.add("too_little_time");
  }

  if (mentorAccess === "none") {
    riskFlags.add("insufficient_guidance");
  }

  if (String(rawIntake.data_or_resource_access ?? "").trim().length === 0) {
    riskFlags.add("resource_constraint");
  }

  const summary = [
    `Student profile indicates ${skill} research readiness with about ${weeklyHours || "limited"} hours per week available.`,
    `Interests center on ${interpretedInterests.slice(0, 3).join(", ") || "applied student research"}.`,
    "Scope should prioritize a feasible, ethical research design with clear deliverables instead of publication-level ambition.",
  ].join(" ");

  return ResearchNormalizedProfileSchema.parse({
    project_track: "research",
    summary,
    interpreted_interests: interpretedInterests.length ? interpretedInterests : ["applied research", "student inquiry"],
    skill_assessment: skill,
    risk_flags: Array.from(riskFlags),
    track_payload_json: {
      research_readiness:
        mentorAccess === "strong"
          ? "Student has enough support for moderate research complexity if scope stays disciplined."
          : "Student should prioritize methods that can be executed independently with light supervision.",
      scope_guardrails: [
        "Choose one question and one primary method",
        "Use accessible datasets/resources before designing complex data collection",
      ],
      mentor_resource_notes:
        mentorAccess === "strong"
          ? "Mentor access can be used for method feedback and quality checks."
          : "Plan around limited mentorship and prioritize low-barrier methods.",
    },
  });
}

function fallbackSoftwareRecommendations(normalizedProfile: NormalizedProfile): RecommendationBatch {
  const [interestA = "productivity", interestB = "education", interestC = "analytics"] =
    normalizedProfile.interpreted_interests;

  const templates = [
    {
      id: "project_1",
      project_track: "software" as const,
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
      track_payload_json: {
        project_angle: "A personal workflow product with measurable student value.",
        portfolio_focus: "Highlight scoped MVP execution and clear technical tradeoffs.",
      },
    },
    {
      id: "project_2",
      project_track: "software" as const,
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
      track_payload_json: {
        project_angle: "A practical recommendation product with transparent ranking logic.",
        portfolio_focus: "Show product reasoning and end-to-end implementation discipline.",
      },
    },
    {
      id: "project_3",
      project_track: "software" as const,
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
      track_payload_json: {
        project_angle: "A student analytics product focused on insight quality.",
        portfolio_focus: "Demonstrate data modeling and dashboard UX decisions.",
      },
    },
  ];

  return RecommendationBatchSchema.parse({ recommendations: templates });
}

function fallbackResearchRecommendations(normalizedProfile: NormalizedProfile): RecommendationBatch {
  const [interestA = "learning behavior", interestB = "public health", interestC = "digital communities"] =
    normalizedProfile.interpreted_interests;

  const templates = [
    {
      id: "research_1",
      project_track: "research" as const,
      title: `What Study Habits Predict Better Weekly Outcomes in ${interestA}?`,
      summary:
        "Design a student-scale mixed-method research project to test which specific habits correlate with stronger weekly outcomes, using survey data plus lightweight logs.",
      rationale:
        "This fits because it is credible without requiring lab access, and it produces a strong narrative around method design, analysis discipline, and practical insight generation.",
      difficulty: "beginner_intermediate" as const,
      estimated_weeks: 8,
      weekly_hours: 6,
      skills_demonstrated: ["Question framing", "Survey design", "Basic statistics", "Research communication"],
      tools_needed: ["Google Forms", "Sheets/Excel", "Public literature sources", "Presentation tools"],
      impressiveness_score: 8,
      finishability_score: 9,
      authenticity_note:
        "Use your own school context and constraints transparently so the project reads as authentic, grounded student work.",
      track_payload_json: {
        project_title_or_direction: "Student study-habit outcome analysis",
        research_question_or_hypothesis:
          "Which two to three study habits are most associated with improved weekly academic outcomes for students in my peer context?",
        methodology:
          "Survey plus optional study-log analysis with descriptive stats and simple correlation checks.",
        scope_boundaries:
          "Limit to one student population and one school term, avoid causal claims, and report only supported patterns.",
        final_deliverables: ["Short paper", "Poster", "Portfolio case study"],
        portfolio_or_application_positioning:
          "Position this as a self-directed evidence project showing analytical rigor and practical decision-making.",
        key_risks: ["Low response quality", "Small sample size", "Timeline slippage during data cleaning"],
      },
    },
    {
      id: "research_2",
      project_track: "research" as const,
      title: `Accessible Data Analysis in ${interestB} Using Public Datasets`,
      summary:
        "Run a focused student research analysis on one public dataset, testing a clear hypothesis and translating findings into practical implications with responsible caveats.",
      rationale:
        "This path is impressive and feasible because it avoids expensive data collection while still showing strong analytical method, interpretation discipline, and communication quality.",
      difficulty: "intermediate" as const,
      estimated_weeks: 9,
      weekly_hours: 7,
      skills_demonstrated: ["Hypothesis design", "Data cleaning", "Statistical interpretation", "Scientific writing"],
      tools_needed: ["Public dataset portals", "Python or Excel", "Google Scholar", "Slides"],
      impressiveness_score: 9,
      finishability_score: 8,
      authenticity_note:
        "Document every assumption and limitation explicitly so your credibility stays high even with modest methods.",
      track_payload_json: {
        project_title_or_direction: "Public-health student data investigation",
        research_question_or_hypothesis:
          "In the selected dataset, which measurable factor is most strongly associated with the target student-relevant outcome?",
        methodology:
          "Secondary data analysis using descriptive statistics and one focused inferential check with clear assumptions.",
        scope_boundaries:
          "One dataset, one primary question, and one comparison framework to keep execution realistic.",
        final_deliverables: ["Research brief", "Presentation", "Portfolio analysis write-up"],
        portfolio_or_application_positioning:
          "Frame this as evidence of quantitative reasoning and responsible interpretation under real constraints.",
        key_risks: ["Data quality issues", "Overfitting interpretation", "Tooling overhead"],
      },
    },
    {
      id: "research_3",
      project_track: "research" as const,
      title: `Digital Behavior and Well-Being Patterns in ${interestC}`,
      summary:
        "Conduct a student-appropriate survey-based project exploring how specific digital habits relate to self-reported well-being, with a methodology section that emphasizes ethics and limits.",
      rationale:
        "This recommendation balances ambition with feasibility, making it suitable for independent execution while still producing strong deliverables for applications or portfolios.",
      difficulty: "beginner_intermediate" as const,
      estimated_weeks: 7,
      weekly_hours: 6,
      skills_demonstrated: ["Research ethics", "Survey methodology", "Pattern analysis", "Narrative synthesis"],
      tools_needed: ["Survey platform", "Spreadsheet analysis", "Consent scripts", "Poster tools"],
      impressiveness_score: 8,
      finishability_score: 8,
      authenticity_note:
        "Keep claims conservative and emphasize your process quality, limitations, and what you would test next.",
      track_payload_json: {
        project_title_or_direction: "Student digital-well-being survey study",
        research_question_or_hypothesis:
          "How are specific digital behavior patterns associated with student self-reported well-being in a defined peer group?",
        methodology: "Anonymous survey with descriptive statistics and subgroup comparison.",
        scope_boundaries:
          "Single school/community sample, no medical claims, and no sensitive data beyond minimal self-report measures.",
        final_deliverables: ["Poster", "Slide presentation", "Application narrative excerpt"],
        portfolio_or_application_positioning:
          "Present this as a disciplined, ethical inquiry project with actionable interpretation and clear limits.",
        key_risks: ["Response bias", "Recruitment limitations", "Overstating conclusions"],
      },
    },
  ];

  return RecommendationBatchSchema.parse({ recommendations: templates });
}

function fallbackSoftwareRoadmap(input: {
  selectedProject: Record<string, unknown>;
  detailLevel: "limited" | "full";
}): Roadmap {
  const title = String(input.selectedProject.title ?? "Student Project");

  return SoftwareRoadmapSchema.parse({
    project_track: "software",
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
    track_payload_json: {},
  });
}

function fallbackResearchRoadmap(input: {
  selectedProject: Record<string, unknown>;
  detailLevel: "limited" | "full";
}): Roadmap {
  const title = String(input.selectedProject.title ?? "Student Research Project");

  const timelineAndMilestones = [
    "Week 1: finalize question, constraints, and data/resource plan",
    "Weeks 2-3: method design and source/data preparation",
    "Weeks 4-6: execute analysis/collection and document decisions",
    "Weeks 7-8: synthesize findings, limitations, and final deliverables",
  ];

  return ResearchRoadmapSchema.parse({
    project_track: "research",
    overview:
      `${title} is a student-scale research project focused on credible methodology, practical execution, and strong application-ready storytelling.`,
    mvp_scope:
      "Complete one focused research question with one primary methodology, transparent assumptions, and a polished final deliverable set.",
    feature_ladder: {
      must_have: [
        "One focused research question or hypothesis",
        "Method section with realistic data/resource plan",
        "Findings summary with explicit limitations",
      ],
      should_have: ["Visuals/charts to support interpretation", "Mentor feedback checkpoint"],
      could_have: ["Optional secondary analysis", "Optional competition submission variant"],
    },
    milestones: [
      {
        order_index: 0,
        title: "Question + Scope Lock",
        description: "Finalize the specific question, boundaries, and ethics-aware execution constraints.",
      },
      {
        order_index: 1,
        title: "Method Design",
        description: "Choose methodology, gather resources, and define the analysis or collection process.",
      },
      {
        order_index: 2,
        title: "Execution + Analysis",
        description: "Run the planned method, record observations, and synthesize findings conservatively.",
      },
      {
        order_index: 3,
        title: "Deliverables + Positioning",
        description: "Package the paper/poster/presentation and write the application/portfolio narrative.",
      },
    ],
    repo_structure: [
      { path: "research/proposal.md", purpose: "Question statement, scope boundaries, and method rationale." },
      { path: "research/data", purpose: "Collected or downloaded data and cleaning notes." },
      { path: "research/analysis", purpose: "Analysis scripts or spreadsheets with reproducible steps." },
      { path: "research/final", purpose: "Final paper, poster, or presentation artifacts." },
    ],
    readme_draft:
      `# ${title}\n\n## Research Focus\nThis project investigates one focused student-relevant question using practical, feasible methods.\n\n## Question/Hypothesis\nState one testable question and avoid broad claims that exceed available evidence.\n\n## Method\nUse one primary method (literature review, data analysis, survey, or experiment) with clear assumptions and constraints.\n\n## Findings\nReport patterns conservatively and include limitations.\n\n## Deliverables\n- Paper or brief\n- Poster or slides\n- Portfolio narrative\n\n## Reflection\nExplain what worked, what was limited, and what a next iteration would test.`,
    cut_if_behind: [
      "Drop secondary analyses and focus on one strong finding",
      "Prioritize the final paper/brief before optional poster polish",
    ],
    stretch_goals:
      input.detailLevel === "full"
        ? ["Submit to one student competition", "Create a short public presentation recording"]
        : ["One optional visual appendix", "One optional mentor review cycle"],
    explanation_guide: {
      elevator_pitch:
        `${title} is a scoped, evidence-driven student research project designed for credible execution and clear communication under real constraints.`,
      resume_bullets: [
        "Designed and executed a student-scale research project with a defined question, methodology, and limitations.",
        "Synthesized findings into polished deliverables for applications, interviews, and portfolio presentation.",
      ],
      interview_talking_points: [
        "How I selected a feasible question and constrained the scope.",
        "How I handled data/method limits without overclaiming.",
        "How I translated findings into practical final deliverables.",
      ],
    },
    track_payload_json: {
      project_title_or_direction: title,
      why_this_fits:
        "This project fits the student profile by balancing ambition with realistic methodology, available time, and accessible resources.",
      research_question_or_hypothesis:
        "Define one focused question/hypothesis tied to a student-relevant domain and measurable evidence.",
      methodology:
        "Use one primary method with transparent assumptions, ethics-aware guardrails, and practical execution steps.",
      scope_boundaries:
        "Limit to one question, one primary dataset/sample context, and one main analysis pathway.",
      step_by_step_plan: [
        "Finalize question and constraints in writing",
        "Collect literature/resources and draft method",
        "Execute method and log decisions",
        "Analyze findings with conservative claims",
        "Package deliverables and positioning narrative",
      ],
      timeline_and_milestones: timelineAndMilestones,
      risks_and_blockers: [
        "Data or response availability may be lower than expected",
        "Method may be too broad for available weekly hours",
        "Interpretation quality can drop without explicit limitation framing",
      ],
      final_deliverables: ["Research paper or brief", "Poster or presentation", "Portfolio/application narrative"],
      portfolio_or_application_positioning:
        "Frame this as evidence of structured inquiry, disciplined scope management, and clear communication of limitations and impact.",
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
    });

    const withSafeIds = result.parsed.recommendations.map((item, index) => ({
      ...item,
      id: item.id || `${normalizedProfile.project_track}_${index + 1}`,
      project_track: normalizedProfile.project_track,
    }));

    return {
      parsed: {
        recommendations: withSafeIds,
      },
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



