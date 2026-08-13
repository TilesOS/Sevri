import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { buildGenerationContext } from "../src/lib/ai/generation-context";
import { runOptionsGeneration, runRoadmapGeneration, runStepGuidanceGeneration } from "../src/lib/ai/pipelines";

const fixtures: Record<string, Record<string, unknown>> = {
  "electrical-engineering": {
    student_stage: "high_school_junior", project_goal: "portfolio", success_definition: "A safe low-voltage prototype with measured performance and a clear build log.",
    interests: ["low-voltage electronics", "environmental sensors", "circuit design"], favorite_subjects: ["physics", "engineering"], open_to_anything: false,
    format_preferences: ["physical", "digital"], experience_level: "intermediate", existing_skills: ["breadboarding", "basic Python"], available_resources: "Arduino, multimeter, supervised school electronics bench",
    weekly_time_available: 6, budget_constraints: "$60", preferred_challenge: "intermediate", other_constraints: "No mains electricity; adult supervision for soldering.",
  },
  "visual-arts": {
    student_stage: "high_school_senior", project_goal: "college_applications", success_definition: "A cohesive three-piece series with documented studies and an artist statement.",
    interests: ["portraiture", "memory", "mixed-media collage"], favorite_subjects: ["studio art", "history"], open_to_anything: false,
    format_preferences: ["creative", "physical"], experience_level: "advanced", existing_skills: ["drawing", "photo editing"], available_resources: "Home art supplies, school studio, phone camera",
    weekly_time_available: 7, budget_constraints: "$75", preferred_challenge: "advanced", other_constraints: "Work must fit in a portfolio case.",
  },
  "literature-investigation": {
    student_stage: "college_freshman", project_goal: "class_or_capstone", success_definition: "A defensible close-reading argument paired with a small annotated digital exhibit.",
    interests: ["migration literature", "oral history", "place in contemporary poetry"], favorite_subjects: ["literature", "history"], open_to_anything: false,
    format_preferences: ["investigative", "creative", "digital"], experience_level: "intermediate", existing_skills: ["close reading", "citation"], available_resources: "Library databases and a small course-approved text corpus",
    weekly_time_available: 6, preferred_challenge: "intermediate", other_constraints: "Do not make claims beyond the selected texts.",
  },
  "community-initiative": {
    student_stage: "high_school_sophomore", project_goal: "community_impact", success_definition: "A co-designed pilot used by one neighborhood group, with participant feedback and a handoff guide.",
    interests: ["food access", "community organizing", "multilingual communication"], favorite_subjects: ["civics", "Spanish"], open_to_anything: false,
    format_preferences: ["community", "creative"], experience_level: "beginner", existing_skills: ["facilitation", "translation"], available_resources: "Local pantry coordinator, school printer, two student volunteers",
    weekly_time_available: 4, budget_constraints: "$30", preferred_challenge: "beginner", other_constraints: "Get consent and collect no unnecessary personal data.",
  },
  "entrepreneurship": {
    student_stage: "gap_year", project_goal: "internship_or_job", success_definition: "Evidence from ten customer conversations and a tested concierge pilot with an honest recommendation.",
    interests: ["small business", "bicycle repair", "service design"], favorite_subjects: ["economics", "design"], open_to_anything: false,
    format_preferences: ["venture", "community"], experience_level: "intermediate", existing_skills: ["spreadsheets", "customer interviews"], available_resources: "Local bike co-op, laptop, $100 pilot budget",
    weekly_time_available: 8, budget_constraints: "$100", preferred_challenge: "advanced", other_constraints: "No paid advertising or inventory purchase before demand testing.",
  },
  "environmental-investigation": {
    student_stage: "high_school_junior", project_goal: "competition", success_definition: "A repeatable local heat survey with a transparent dataset, map, and limitations statement.",
    interests: ["urban heat islands", "tree cover", "environmental justice"], favorite_subjects: ["environmental science", "statistics"], open_to_anything: false,
    format_preferences: ["investigative", "community", "digital"], experience_level: "intermediate", existing_skills: ["spreadsheets", "basic mapping"], available_resources: "Two thermometers, public tree-cover data, bicycle access with an adult",
    weekly_time_available: 5, budget_constraints: "$20", preferred_challenge: "intermediate", other_constraints: "No trespassing; record weather and time-of-day confounders.",
  },
  "hybrid-physical-digital": {
    student_stage: "high_school_senior", project_goal: "personal", success_definition: "A playable tabletop prototype plus a lightweight digital companion tested in three sessions.",
    interests: ["tabletop games", "local ecology", "interactive storytelling"], favorite_subjects: ["art", "biology", "computer science"], open_to_anything: false,
    format_preferences: ["physical", "digital", "creative"], experience_level: "intermediate", existing_skills: ["illustration", "JavaScript"], available_resources: "Cardstock, color printer, laptop, four willing playtesters",
    weekly_time_available: 7, budget_constraints: "$50", preferred_challenge: "intermediate", other_constraints: "The physical game must remain usable without the digital companion.",
  },
};

async function benchmark(name: string, rawIntake: Record<string, unknown>) {
  const context = buildGenerationContext({ rawIntake });
  const optionsStarted = performance.now();
  const options = await runOptionsGeneration(context);
  const optionsMs = Math.round(performance.now() - optionsStarted);
  const selectedOption = options.parsed.recommendations[0];
  const roadmapStarted = performance.now();
  const roadmap = await runRoadmapGeneration({ context, selectedOption });
  const roadmapMs = Math.round(performance.now() - roadmapStarted);
  const stepStarted = performance.now();
  const step = await runStepGuidanceGeneration({ context, selectedOption, roadmap: roadmap.parsed, step: roadmap.parsed.steps[0] });
  assert.deepEqual(
    new Set(options.parsed.recommendations.map((option) => option.difficulty)),
    new Set(["beginner", "intermediate", "advanced"]),
    `${name}: recommendations must preserve the three ambition tiers`,
  );
  for (const option of options.parsed.recommendations) {
    assert.ok(option.project_blueprint_json.primary_artifacts.length > 0, `${name}: every direction needs an artifact`);
    assert.ok(option.project_blueprint_json.proof_of_success.length >= 2, `${name}: every direction needs observable proof`);
    assert.ok(option.project_blueprint_json.scope_boundary.trim().length >= 16, `${name}: every direction needs a scope boundary`);
  }
  assert.ok(roadmap.parsed.artifact_plan.length > 0, `${name}: roadmap needs an artifact plan`);
  assert.ok(roadmap.parsed.success_criteria.length >= 2, `${name}: roadmap needs explicit success criteria`);
  if (name === "electrical-engineering") {
    const hardwareText = JSON.stringify(options.parsed.recommendations).toLowerCase();
    assert.match(hardwareText, /low[- ]voltage|breadboard|circuit|sensor/, "electrical fixture must remain hardware-specific");
    assert.match(hardwareText, /supervis|safety|mains/, "electrical fixture must retain its safety boundary");
    assert.ok(!options.parsed.recommendations.every((option) => /\b(app|paper)\b/i.test(option.title)), "electrical directions cannot collapse into apps or papers");
  }
  return { fixture: name, options_ms: optionsMs, roadmap_ms: roadmapMs, step_ms: Math.round(performance.now() - stepStarted), options_fallback: options.metrics.fallback_used, roadmap_fallback: roadmap.metrics.fallback_used, step_fallback: step.metrics.fallback_used, citations: options.metrics.citation_count + roadmap.metrics.citation_count + step.metrics.citation_count };
}

async function main() { console.table(await Promise.all(Object.entries(fixtures).map(([name, intake]) => benchmark(name, intake)))); }
void main().catch((error) => { console.error("Benchmark failed", error); process.exitCode = 1; });
