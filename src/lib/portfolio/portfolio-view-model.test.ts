import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_TIME_CURATION_RETRY_COOLDOWN_MS,
  buildPortfolioEntryDetailViewFromData,
  buildPortfolioViewFromData,
  getPortfolioCurationState,
  isEligibleForFirstTimeCuration,
} from "./portfolio-view-model.ts";
import type {
  PortfolioEntryDetailData,
  PortfolioEntryRow,
  PortfolioMilestoneRow,
  PortfolioProjectRow,
  PortfolioRoadmapRow,
  PortfolioSubmissionRow,
} from "../db/queries/portfolio.ts";

// Fixtures mirror rows backfilled on 2026-04-23: five milestones per project,
// and in most cases no submissions, exports, or public page.
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const ENTRY_ID = "33333333-3333-4333-8333-333333333333";
const RECOMMENDATION_ID = "44444444-4444-4444-8444-444444444444";

function makeProject(overrides: Partial<PortfolioProjectRow> = {}): PortfolioProjectRow {
  return {
    id: PROJECT_ID,
    user_id: USER_ID,
    recommendation_id: RECOMMENDATION_ID,
    title: "Interactive Portfolio Demo",
    status: "active",
    archived_at: null,
    selection_operation_id: "55555555-5555-4555-8555-555555555555",
    project_track: "software",
    selected_at: "2026-04-23T18:12:00.000Z",
    created_at: "2026-04-23T18:12:00.000Z",
    updated_at: "2026-04-23T18:12:00.000Z",
    ...overrides,
  };
}

test("Portfolio keeps archived projects visible as cut without losing lifecycle status", () => {
  const archivedAt = "2026-05-05T12:00:00.000Z";

  for (const status of ["active", "paused", "completed"] as const) {
    const archived = buildPortfolioEntryDetailViewFromData(
      makeDetailData({
        project: makeProject({ status, archived_at: archivedAt }),
      }),
    );
    assert.equal(archived.effectiveStatus, "abandoned");

    const restored = buildPortfolioEntryDetailViewFromData(
      makeDetailData({
        project: makeProject({ status, archived_at: null }),
      }),
    );
    assert.equal(
      restored.effectiveStatus,
      status === "active" ? "in_progress" : status,
    );
  }
});

function makeEntry(overrides: Partial<PortfolioEntryRow> = {}): PortfolioEntryRow {
  return {
    id: ENTRY_ID,
    user_id: USER_ID,
    project_id: PROJECT_ID,
    status_override: null,
    curated_summary: null,
    curation_model: null,
    curation_attempted_at: null,
    curation_generated_at: null,
    curation_claimed_at: null,
    curation_metadata_json: {},
    student_reflection: null,
    featured_submission_id: null,
    featured_evidence_note: null,
    created_at: "2026-04-23T18:12:00.000Z",
    updated_at: "2026-04-23T18:12:00.000Z",
    ...overrides,
  };
}

function makeMilestones(total: number, completed: number): PortfolioMilestoneRow[] {
  return Array.from({ length: total }, (_unused, index) => ({
    id: `milestone-${index + 1}`,
    project_id: PROJECT_ID,
    order_index: index,
    title: `Step ${index + 1}`,
    description: "Do the thing.",
    completed: index < completed,
    completed_at: index < completed ? "2026-05-01T09:00:00.000Z" : null,
    created_at: "2026-04-23T18:12:00.000Z",
    due_date: null,
    schedule_duration_days: null,
    is_user_scheduled_override: false,
  }));
}

function makeRoadmap(overrides: Partial<PortfolioRoadmapRow> = {}): PortfolioRoadmapRow {
  return {
    id: "roadmap-1",
    project_id: PROJECT_ID,
    overview: "A browser demo that lets visitors explore three saved projects.",
    mvp_scope: "One page, three cards, no backend.",
    repo_structure: null,
    readme_draft: "",
    stretch_goals: [],
    explanation_guide: null,
    raw_model_output_json: null,
    project_track: "software",
    track_payload_json: {},
    scheduled_start_date: null,
    scheduled_end_date: null,
    schedule_timezone: null,
    schedule_generation_source: null,
    last_schedule_rebalanced_at: null,
    created_at: "2026-04-23T18:12:00.000Z",
    updated_at: "2026-04-23T18:12:00.000Z",
    ...overrides,
  };
}

function makeSubmission(
  id: string,
  milestoneId: string,
  createdAt: string,
): PortfolioSubmissionRow {
  return {
    id,
    milestone_id: milestoneId,
    user_id: USER_ID,
    submission_kind: "pasted_text",
    submission_text: `Work for ${milestoneId}`,
    submission_filename: null,
    storage_path: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function makeDetailData(overrides: Partial<PortfolioEntryDetailData> = {}): PortfolioEntryDetailData {
  return {
    project: makeProject(),
    entry: makeEntry(),
    roadmap: null,
    recommendation: null,
    milestones: makeMilestones(5, 0),
    latestSubmissions: [],
    latestEvaluations: [],
    reviews: [],
    githubActivity: null,
    exports: [],
    publicPage: null,
    ...overrides,
  };
}

test("builds a detail view for a fully populated entry", () => {
  const submission = makeSubmission("submission-3", "milestone-3", "2026-05-02T09:00:00.000Z");
  const view = buildPortfolioEntryDetailViewFromData(
    makeDetailData({
      entry: makeEntry({
        curated_summary: "Shipped a three-project demo and wrote up what each one proves.",
        curation_attempted_at: "2026-05-03T09:00:00.000Z",
        curation_generated_at: "2026-05-03T09:00:00.000Z",
        curation_metadata_json: { source: "first_time" },
        student_reflection: "I learned to cut scope early.",
        featured_submission_id: "submission-3",
      }),
      project: makeProject({ status: "completed" }),
      roadmap: makeRoadmap(),
      milestones: makeMilestones(5, 3),
      latestSubmissions: [submission],
      latestEvaluations: [
        {
          id: "evaluation-1",
          submission_id: "submission-3",
          user_id: USER_ID,
          evaluation_json: { verdict: "revise" },
          status: "completed",
          failure_message: null,
          created_at: "2026-05-02T09:30:00.000Z",
          updated_at: "2026-05-02T09:30:00.000Z",
        },
      ],
      githubActivity: {
        project_id: PROJECT_ID,
        cached_commits: [
          {
            sha: "abcdef1234567890",
            short_sha: "abcdef1",
            message_title: "Add project cards",
            message_body: "Renders three cards from a static list.",
            author: { name: "Student", date: "2026-05-01T09:00:00.000Z" },
          },
          { message: "no sha, dropped" },
        ],
      },
      publicPage: {
        id: "public-1",
        user_id: USER_ID,
        portfolio_entry_id: ENTRY_ID,
        slug: "interactive-portfolio-demo",
        display_name_choice: "anonymous",
        safety_snapshot_json: {},
        published_at: "2026-05-04T09:00:00.000Z",
        unpublished_at: null,
        public_acknowledged_at: "2026-05-04T09:00:00.000Z",
        created_at: "2026-05-04T09:00:00.000Z",
      },
    }),
  );

  assert.equal(view.curationState, "curated");
  assert.equal(view.hasCuratedSummary, true);
  assert.equal(view.effectiveStatus, "completed");
  assert.equal(view.statusLabel, "Completed");
  assert.equal(view.completedMilestones, 3);
  assert.equal(view.totalMilestones, 5);
  assert.equal(view.completionPercent, 60);
  assert.equal(view.featuredSubmission?.id, "submission-3");
  assert.equal(view.latestEvaluations.length, 1);
  assert.equal(view.cachedCommits.length, 1);
  assert.equal(view.cachedCommits[0]?.shortSha, "abcdef1");
  assert.equal(view.publicPage?.slug, "interactive-portfolio-demo");
});

test("builds a detail view for a minimal entry with no submissions, exports, or public page", () => {
  const view = buildPortfolioEntryDetailViewFromData(makeDetailData());

  assert.equal(view.curationState, "pending");
  assert.equal(view.hasCuratedSummary, false);
  assert.match(view.summary, /curation has not run yet/i);
  assert.equal(view.effectiveStatus, "in_progress");
  assert.equal(view.completedMilestones, 0);
  assert.equal(view.totalMilestones, 5);
  assert.equal(view.completionPercent, 0);
  assert.equal(view.featuredSubmission, null);
  assert.deepEqual(view.latestSubmissions, []);
  assert.deepEqual(view.latestEvaluations, []);
  assert.deepEqual(view.cachedCommits, []);
  assert.deepEqual(view.exports, []);
  assert.equal(view.publicPage, null);
});

test("an entry with no milestones reports zero progress rather than dividing by zero", () => {
  const view = buildPortfolioEntryDetailViewFromData(makeDetailData({ milestones: [] }));

  assert.equal(view.totalMilestones, 0);
  assert.equal(view.completionPercent, 0);
});

test("builds a detail view for an entry whose first-time curation failed", () => {
  const view = buildPortfolioEntryDetailViewFromData(
    makeDetailData({
      entry: makeEntry({
        curation_attempted_at: "2026-04-23T18:13:00.000Z",
        curation_metadata_json: {
          source: "first_time",
          failed: true,
          error: "Failed to load portfolio submissions: column milestone_submissions.is_latest does not exist",
        },
      }),
      roadmap: makeRoadmap(),
    }),
  );

  assert.equal(view.curationState, "failed");
  assert.equal(view.hasCuratedSummary, false);
  // Falls back to the roadmap overview rather than a placeholder.
  assert.match(view.summary, /browser demo/i);
  assert.equal(view.totalMilestones, 5);
});

test("a failed entry with nothing to fall back on says so instead of claiming curation never ran", () => {
  const view = buildPortfolioEntryDetailViewFromData(
    makeDetailData({
      entry: makeEntry({
        curation_attempted_at: "2026-04-23T18:13:00.000Z",
        curation_metadata_json: { source: "first_time", failed: true, error: "boom" },
      }),
    }),
  );

  assert.equal(view.curationState, "failed");
  assert.match(view.summary, /not available/i);
  assert.doesNotMatch(view.summary, /has not run yet/i);
});

test("a safety-blocked entry is reported as blocked", () => {
  const entry = makeEntry({
    curation_attempted_at: "2026-05-01T09:00:00.000Z",
    curation_metadata_json: { source: "first_time", blocked: true, findings: [] },
  });

  assert.equal(getPortfolioCurationState(entry), "blocked");
  assert.match(buildPortfolioEntryDetailViewFromData(makeDetailData({ entry })).summary, /safety check/i);
});

test("a pinned submission that is missing from the evidence list does not break the view", () => {
  const view = buildPortfolioEntryDetailViewFromData(
    makeDetailData({ entry: makeEntry({ featured_submission_id: "deleted-submission" }) }),
  );

  assert.equal(view.featuredSubmission, null);
});

test("cached commit fallback titles stop at the first newline", () => {
  const view = buildPortfolioEntryDetailViewFromData(
    makeDetailData({
      githubActivity: {
        project_id: PROJECT_ID,
        cached_commits: [
          {
            sha: "abcdef1234567890",
            message: "Keep this subject\nDo not merge this body into the title",
          },
        ],
      },
    }),
  );

  assert.equal(view.cachedCommits[0]?.title, "Keep this subject");
});

test("status override wins over project status", () => {
  const view = buildPortfolioEntryDetailViewFromData(
    makeDetailData({
      entry: makeEntry({ status_override: "abandoned" }),
      project: makeProject({ status: "active" }),
    }),
  );

  assert.equal(view.effectiveStatus, "abandoned");
  assert.equal(view.statusLabel, "Cut");
});

test("first-time curation runs for entries that were never attempted", () => {
  assert.equal(isEligibleForFirstTimeCuration(makeEntry()), true);
});

test("listing data reports missing and eligible entries as pending without creating rows", () => {
  const missing = buildPortfolioViewFromData({
    projects: [makeProject()],
    entries: [],
    roadmaps: [],
    recommendations: [],
    milestones: [],
  });
  assert.equal(missing.entries.length, 0);
  assert.equal(missing.pendingCurationCount, 1);

  const pending = buildPortfolioViewFromData({
    projects: [makeProject()],
    entries: [makeEntry()],
    roadmaps: [],
    recommendations: [],
    milestones: [],
  });
  assert.equal(pending.entries.length, 1);
  assert.equal(pending.pendingCurationCount, 1);
});

test("first-time curation does not re-run for curated or safety-blocked entries", () => {
  assert.equal(
    isEligibleForFirstTimeCuration(makeEntry({ curated_summary: "Already written." })),
    false,
  );
  assert.equal(
    isEligibleForFirstTimeCuration(
      makeEntry({
        curation_attempted_at: new Date(Date.now() - FIRST_TIME_CURATION_RETRY_COOLDOWN_MS * 10).toISOString(),
        curation_metadata_json: { blocked: true },
      }),
    ),
    false,
  );
});

test("a failed attempt is retried only after the cooldown", () => {
  const now = Date.parse("2026-07-24T12:00:00.000Z");
  const failed = (attemptedAt: string) =>
    makeEntry({
      curation_attempted_at: attemptedAt,
      curation_metadata_json: { failed: true },
    });

  assert.equal(isEligibleForFirstTimeCuration(failed("2026-07-24T11:30:00.000Z"), now), false);
  assert.equal(isEligibleForFirstTimeCuration(failed("2026-04-23T18:13:00.000Z"), now), true);
});
