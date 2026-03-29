import { performance } from "node:perf_hooks";
import { buildGenerationContext } from "../src/lib/ai/generation-context";
import {
  getDefaultLegacyTimingSummary,
  runOptionsGeneration,
  runRoadmapGeneration,
  runStepGuidanceGeneration,
} from "../src/lib/ai/pipelines";
import {
  runProfileNormalization as runLegacyProfileNormalization,
  runRecommendationGeneration as runLegacyRecommendationGeneration,
  runRoadmapGeneration as runLegacyRoadmapGeneration,
} from "../src/lib/ai/legacy-pipelines";

type BenchmarkTrack = "software" | "research";

const fixtures: Record<BenchmarkTrack, Record<string, unknown>> = {
  software: {
    project_track: "software",
    student_stage: "high_school_junior",
    target_outcome: "portfolio",
    interests: ["computer architecture", "performance analysis", "systems"],
    favorite_subjects: ["physics", "computer science"],
    weekly_time_available: 6,
    coding_experience: "intermediate",
    preferred_project_style: "analysis tool",
    known_tools: ["TypeScript", "Python", "Next.js"],
    target_schools_or_companies: ["MIT", "NVIDIA"],
    preferred_difficulty: "intermediate",
    constraints: "Only evenings and weekends, no special hardware.",
    additional_context: "I want something technically real, not a generic student app.",
  },
  research: {
    project_track: "research",
    student_stage: "high_school_senior",
    target_outcome: "college_apps",
    interests: ["behavioral economics", "public policy", "education"],
    favorite_subjects: ["economics", "statistics"],
    weekly_time_available: 6,
    preferred_research_domain: "behavioral economics",
    research_experience: "intermediate",
    mentor_access: "limited",
    methodology_preference: "data_analysis",
    research_tools_or_resources: ["Google Scholar", "Excel", "Python"],
    target_research_deliverable: "paper",
    data_or_resource_access: "Public datasets and published papers.",
    constraints: "No lab access and a tight school schedule.",
    additional_context: "I want something credible and narrow enough to finish well.",
  },
};

async function time<T>(label: string, fn: () => Promise<T>) {
  const startedAt = performance.now();
  const result = await fn();
  const elapsedMs = performance.now() - startedAt;
  return { label, result, elapsedMs: Math.round(elapsedMs) };
}

async function benchmarkTrack(track: BenchmarkTrack) {
  const intake = fixtures[track];
  const legacyNormalize = await time(`legacy-${track}-normalize`, () =>
    runLegacyProfileNormalization({
      projectTrack: track,
      rawIntake: intake,
    }),
  );

  const legacyOptions = await time(`legacy-${track}-options`, () =>
    runLegacyRecommendationGeneration(legacyNormalize.result.parsed),
  );

  const context = buildGenerationContext({
    projectTrack: track,
    rawIntake: intake,
  });

  const v2Options = await time(`v2-${track}-options`, () => runOptionsGeneration(context));
  const selectedLegacyProject = legacyOptions.result.parsed.recommendations[0];
  const selectedV2Project = v2Options.result.parsed.recommendations[0];

  const legacyRoadmap = await time(`legacy-${track}-roadmap`, () =>
    runLegacyRoadmapGeneration({
      selectedProject: selectedLegacyProject,
      normalizedProfile: legacyNormalize.result.parsed,
      detailLevel: "full",
    }),
  );

  const v2Roadmap = await time(`v2-${track}-roadmap`, () =>
    runRoadmapGeneration({
      context,
      selectedOption: selectedV2Project,
    }),
  );

  const v2Step = await time(`v2-${track}-step`, () =>
    runStepGuidanceGeneration({
      context,
      selectedOption: selectedV2Project,
      roadmap: v2Roadmap.result.parsed,
      step: v2Roadmap.result.parsed.steps[0],
    }),
  );

  return {
    track,
    legacy: {
      normalizeMs: legacyNormalize.elapsedMs,
      optionsMs: legacyOptions.elapsedMs,
      totalOptionsMs: legacyNormalize.elapsedMs + legacyOptions.elapsedMs,
      roadmapMs: legacyRoadmap.elapsedMs,
      fallbackUsed:
        legacyNormalize.result.raw && typeof legacyNormalize.result.raw === "object" && "source" in legacyNormalize.result.raw
          ? true
          : false,
    },
    v2: {
      optionsMs: v2Options.elapsedMs,
      roadmapMs: v2Roadmap.elapsedMs,
      stepMs: v2Step.elapsedMs,
      optionsFallback: v2Options.result.metrics.fallback_used,
      roadmapFallback: v2Roadmap.result.metrics.fallback_used,
      stepFallback: v2Step.result.metrics.fallback_used,
      optionsFallbackModel: v2Options.result.metrics.fallback_model_used,
      roadmapFallbackModel: v2Roadmap.result.metrics.fallback_model_used,
      stepFallbackModel: v2Step.result.metrics.fallback_model_used,
      optionsWebSearchUsed: v2Options.result.metrics.web_search_used,
      roadmapWebSearchUsed: v2Roadmap.result.metrics.web_search_used,
      stepWebSearchUsed: v2Step.result.metrics.web_search_used,
      optionsCitationCount: v2Options.result.metrics.citation_count,
      roadmapCitationCount: v2Roadmap.result.metrics.citation_count,
      stepCitationCount: v2Step.result.metrics.citation_count,
    },
  };
}

async function main() {
  const observedBaseline = getDefaultLegacyTimingSummary();
  const software = await benchmarkTrack("software");
  const research = await benchmarkTrack("research");

  const rows = [
    {
      stage: "options",
      track: "software",
      observed_legacy_ms: observedBaseline.options_ms,
      measured_legacy_ms: software.legacy.totalOptionsMs,
      measured_v2_ms: software.v2.optionsMs,
      fallback: software.v2.optionsFallback,
      fallback_model: software.v2.optionsFallbackModel,
      web_search_used: software.v2.optionsWebSearchUsed,
      citation_count: software.v2.optionsCitationCount,
    },
    {
      stage: "roadmap",
      track: "software",
      observed_legacy_ms: observedBaseline.roadmap_ms,
      measured_legacy_ms: software.legacy.roadmapMs,
      measured_v2_ms: software.v2.roadmapMs,
      fallback: software.v2.roadmapFallback,
      fallback_model: software.v2.roadmapFallbackModel,
      web_search_used: software.v2.roadmapWebSearchUsed,
      citation_count: software.v2.roadmapCitationCount,
    },
    {
      stage: "step_guidance",
      track: "software",
      observed_legacy_ms: null,
      measured_legacy_ms: null,
      measured_v2_ms: software.v2.stepMs,
      fallback: software.v2.stepFallback,
      fallback_model: software.v2.stepFallbackModel,
      web_search_used: software.v2.stepWebSearchUsed,
      citation_count: software.v2.stepCitationCount,
    },
    {
      stage: "options",
      track: "research",
      observed_legacy_ms: observedBaseline.options_ms,
      measured_legacy_ms: research.legacy.totalOptionsMs,
      measured_v2_ms: research.v2.optionsMs,
      fallback: research.v2.optionsFallback,
      fallback_model: research.v2.optionsFallbackModel,
      web_search_used: research.v2.optionsWebSearchUsed,
      citation_count: research.v2.optionsCitationCount,
    },
    {
      stage: "roadmap",
      track: "research",
      observed_legacy_ms: observedBaseline.roadmap_ms,
      measured_legacy_ms: research.legacy.roadmapMs,
      measured_v2_ms: research.v2.roadmapMs,
      fallback: research.v2.roadmapFallback,
      fallback_model: research.v2.roadmapFallbackModel,
      web_search_used: research.v2.roadmapWebSearchUsed,
      citation_count: research.v2.roadmapCitationCount,
    },
    {
      stage: "step_guidance",
      track: "research",
      observed_legacy_ms: null,
      measured_legacy_ms: null,
      measured_v2_ms: research.v2.stepMs,
      fallback: research.v2.stepFallback,
      fallback_model: research.v2.stepFallbackModel,
      web_search_used: research.v2.stepWebSearchUsed,
      citation_count: research.v2.stepCitationCount,
    },
  ];

  console.table(rows);
}

void main().catch((error) => {
  console.error("Benchmark failed");
  console.error(error);
  process.exitCode = 1;
});
