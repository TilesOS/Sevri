function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoInterviewOrPrimaryCollection(text: string, label: string) {
  const normalized = text
    .toLowerCase()
    .replace(/\bwithout assuming the student can recruit respondents from scratch\b/g, "")
    .replace(/\bno new participant recruitment\b/g, "")
    .replace(/\bno new data collection\b/g, "")
    .replace(/\bno interviews?\b/g, "");

  assert(!/\binterview\b/i.test(text), `${label} should not include interview wording.`);
  assert(
    !/\b(recruit respondents|recruit participants|fieldwork|collect responses|new survey responses)\b/i.test(normalized),
    `${label} should not require new primary data collection.`,
  );
}

process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon";
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??= "pk_test";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service";
process.env.OPENAI_API_KEY ??= "key";
process.env.OPENAI_MODEL ??= "gpt-5.4-mini";
process.env.OPENAI_FALLBACK_MODEL ??= "gpt-5.4-mini";
process.env.STRIPE_SECRET_KEY ??= "sk_test";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec";
process.env.STRIPE_PRICE_PRO_MONTHLY ??= "price_xxx";
process.env.RESEND_API_KEY ??= "re_xxx";

async function main() {
  const { buildStructuredGenerationRequest } = await import("../src/lib/ai/client");
  const { buildGenerationContext } = await import("../src/lib/ai/generation-context");
  const { buildDeterministicFallbackOptions, optionIssues } = await import("../src/lib/ai/pipelines");
  const { RecommendationBatchSchema } = await import("../src/lib/ai/schemas");

  const scienceSurveyContext = buildGenerationContext({
    projectTrack: "research",
    rawIntake: {
      target_outcome: "college_apps",
      interests: ["public health", "epidemiology", "science fairs"],
      favorite_subjects: ["biology", "statistics"],
      weekly_time_available: 5,
      preferred_research_domain: "public health",
      research_experience: "intermediate",
      methodology_preference: "survey_based",
      data_or_resource_access: "Published survey instruments and public datasets only.",
      target_research_deliverable: "paper",
      constraints: "No lab access and no participant recruitment.",
    },
  });

  assert(scienceSurveyContext.project_track === "research", "Science survey fixture should build a research context.");
  assert(
    scienceSurveyContext.track_payload_json.viable_methodologies.every((method) => /\b(survey|questionnaire)\b/i.test(method)),
    "Survey-based science intake should normalize to survey or questionnaire methodologies only.",
  );
  assert(
    scienceSurveyContext.track_payload_json.viable_methodologies.every((method) => !/\binterview\b/i.test(method)),
    "Survey-based science intake should not normalize to interview methodologies.",
  );

  const restrictedResearchContext = buildGenerationContext({
    projectTrack: "research",
    rawIntake: {
      target_outcome: "portfolio",
      interests: ["public health", "questionnaire design", "science communication"],
      favorite_subjects: ["biology", "statistics"],
      weekly_time_available: 6,
      preferred_research_domain: "public health",
      research_experience: "intermediate",
      methodology_preference: "survey_based",
      data_or_resource_access: "Public datasets only and published papers.",
      target_research_deliverable: "paper",
      constraints: "Use public datasets only. No participant recruitment.",
    },
  });

  assert(restrictedResearchContext.project_track === "research", "Restricted fixture should build a research context.");
  const restrictedFallback = buildDeterministicFallbackOptions(restrictedResearchContext);
  assert(restrictedFallback.recommendations.length === 3, "Restricted research fallback should still return 3 options.");
  assert(
    optionIssues(restrictedFallback, restrictedResearchContext).length === 0,
    "Restricted research fallback batch should pass optionIssues().",
  );

  restrictedFallback.recommendations.forEach((recommendation, index) => {
    assert(recommendation.project_track === "research", `Restricted research option ${index + 1} should be a research option.`);
    assertNoInterviewOrPrimaryCollection(
      `${recommendation.summary} ${recommendation.why_it_fits} ${JSON.stringify(recommendation.track_payload_json)}`,
      `Restricted research option ${index + 1}`,
    );
  });

  const softwareContext = buildGenerationContext({
    projectTrack: "software",
    rawIntake: {
      target_outcome: "portfolio",
      interests: ["computer architecture", "performance analysis", "systems"],
      favorite_subjects: ["physics", "computer science"],
      weekly_time_available: 6,
      coding_experience: "intermediate",
      preferred_project_style: "analysis tool",
      known_tools: ["TypeScript", "Python", "Next.js"],
      constraints: "Only evenings and weekends, no special hardware.",
      additional_context: "I want something technically real, not a generic student app.",
    },
  });

  const softwareFallback = buildDeterministicFallbackOptions(softwareContext);
  assert(softwareFallback.recommendations.length === 3, "Software fallback should return 3 options.");
  assert(optionIssues(softwareFallback, softwareContext).length === 0, "Software fallback batch should pass optionIssues().");
  assert(
    new Set(softwareFallback.recommendations.map((recommendation) => recommendation.title)).size === 3,
    "Software fallback should keep 3 distinct titles.",
  );
  assert(
    new Set(softwareFallback.recommendations.map((recommendation) => recommendation.difficulty)).size >= 2,
    "Software fallback should keep differentiated difficulty levels.",
  );
  assert(
    new Set(softwareFallback.recommendations.map((recommendation) => recommendation.estimated_weeks)).size >= 2,
    "Software fallback should keep differentiated timelines.",
  );

  const request = buildStructuredGenerationRequest({
    generationInput: {
      schema: RecommendationBatchSchema,
      stage: "options",
      systemPrompt: "system",
      userPrompt: "user",
    },
    modelName: "gpt-5.4-mini",
    maxCompletionTokens: 1600,
    defaults: {
      maxRetries: 1,
      maxCompletionTokens: 1600,
      reasoningEffort: "medium" as const,
    },
  });

  assert(!("temperature" in request), "Structured generation request should not include temperature.");

  console.log("AI safety verification passed.");
}

void main().catch((error) => {
  console.error("AI safety verification failed.");
  throw error;
});
