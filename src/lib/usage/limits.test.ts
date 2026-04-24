import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAN_LIMITS,
  canGenerateExports,
  canGenerateRecommendations,
  canPublishPortfolio,
  canRegeneratePortfolioCuration,
  hasCalendarExportAccess,
  getGenerationLimit,
  hasPortfolioPackagingAccess,
  hasReadmeExportAccess,
  hasStepGuidanceAccess,
  hasUnlimitedGenerations,
} from "./limits.ts";
import { countRecommendationBatches } from "./recommendation-batches.ts";

test("free plan allows exactly four recommendation batches", () => {
  assert.equal(PLAN_LIMITS.free.generation_limit, 4);
  assert.equal(getGenerationLimit("free"), 4);

  [0, 1, 2, 3].forEach((generationsUsed) => {
    assert.equal(canGenerateRecommendations("free", generationsUsed), true);
  });

  assert.equal(canGenerateRecommendations("free", 4), false);
});

test("pro plan remains unlimited and non-generation entitlements stay unchanged", () => {
  assert.equal(hasUnlimitedGenerations("pro_monthly"), true);
  assert.equal(canGenerateRecommendations("pro_monthly", 999), true);

  assert.equal(hasStepGuidanceAccess("free"), false);
  assert.equal(hasReadmeExportAccess("free"), false);
  assert.equal(hasCalendarExportAccess("free"), false);
  assert.equal(hasPortfolioPackagingAccess("free"), false);
  assert.equal(canGenerateExports("free"), false);
  assert.equal(canPublishPortfolio("free"), false);
  assert.equal(canRegeneratePortfolioCuration("free"), false);

  assert.equal(hasStepGuidanceAccess("pro_monthly"), true);
  assert.equal(hasReadmeExportAccess("pro_monthly"), true);
  assert.equal(hasCalendarExportAccess("pro_monthly"), true);
  assert.equal(hasPortfolioPackagingAccess("pro_monthly"), true);
  assert.equal(canGenerateExports("pro_monthly"), true);
  assert.equal(canPublishPortfolio("pro_monthly"), true);
  assert.equal(canRegeneratePortfolioCuration("pro_monthly"), true);
});

test("countRecommendationBatches dedupes recommendation rows by normalized profile", () => {
  const count = countRecommendationBatches([
    { normalized_profile_id: "batch-1" },
    { normalized_profile_id: "batch-1" },
    { normalized_profile_id: "batch-2" },
    { normalized_profile_id: null },
    { normalized_profile_id: "batch-2" },
  ]);

  assert.equal(count, 2);
});
