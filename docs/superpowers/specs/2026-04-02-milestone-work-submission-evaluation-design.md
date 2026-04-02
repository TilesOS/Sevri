# Milestone Work Submission + AI Evaluation

**Date:** 2026-04-02
**Status:** Approved — pending implementation plan

## Overview

Users can submit their completed work (code files or pasted text) against an open milestone step. The AI evaluates the submission honestly against the step's done-when criteria and validation check, returning a structured verdict and narrative. Submissions and evaluations are stored persistently and can be revisited. Users may re-submit any number of times; only the latest submission is surfaced in the UI.

---

## Section 1: Database

Migration: `supabase/migrations/0004_work_submissions.sql` — already applied.

### `milestone_submissions`

Append-only. Multiple rows per milestone are allowed. `is_latest = true` marks the current submission for UI reads.

```sql
create table public.milestone_submissions (
  id                  uuid primary key default gen_random_uuid(),
  milestone_id        uuid not null references public.milestones(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  submission_kind     text not null check (submission_kind in ('pasted_text', 'file_upload')),
  submission_text     text,
  submission_filename text,
  storage_path        text,           -- unused in phase 1, reserved for future file storage
  is_latest           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (submission_text is not null or storage_path is not null)
);
```

- `is_latest` is managed by the `set_milestone_submission_latest` trigger: inserting a new row with `is_latest = true` atomically sets all prior rows for the same `milestone_id` to `false`.
- RLS: indirect via `milestones → projects → user_id`, matching `milestone_guidance`.
- Indexes: `(milestone_id, is_latest)`, `(user_id, created_at desc)`.

### `milestone_submission_evaluations`

Append-only. One evaluation per submission in practice, but the schema allows re-evaluation if needed.

```sql
create table public.milestone_submission_evaluations (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.milestone_submissions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  evaluation_json jsonb not null,
  status          text not null default 'completed',
  created_at      timestamptz not null default now()
);
```

- RLS: direct `user_id = auth.uid()` — avoids a 3-level join through submissions.
- Indexes: `(submission_id, created_at desc)`, `(user_id, created_at desc)`.

---

## Section 2: AI Schema + Pipeline

### `WorkEvaluationSchema` (added to `src/lib/ai/schemas.ts`)

```typescript
const CriterionVerdictSchema = z.object({
  criterion: z.string().min(5).max(240),
  verdict:   z.enum(["pass", "partial", "not_yet"]),
  note:      z.string().min(10).max(300),
});

export const WorkEvaluationSchema = z.object({
  criterion_verdicts:     z.array(CriterionVerdictSchema).min(1).max(6),
  overall_assessment:     z.string().min(40).max(500),
  strongest_aspect:       z.string().min(10).max(200),
  clearest_gap:           z.string().min(10).max(200),
  next_best_action:       z.string().min(10).max(300),
  ready_to_mark_complete: z.boolean(),
  confidence:             z.enum(["high", "medium", "low"]).optional(),
});

export type WorkEvaluation = z.infer<typeof WorkEvaluationSchema>;
```

`criterion_verdicts` covers each `done_when` item from the stored guidance plus the step's `validation_check` — typically 3–5 entries.

`confidence` is optional: the model emits it when it has a strong signal. The UI surfaces it only when present.

### `runWorkEvaluation` (added to `src/lib/ai/pipelines.ts`)

```typescript
runWorkEvaluation(input: {
  context:            GenerationContext;
  step:               RoadmapStep;
  guidance:           StepGuidance;       // source of done_when criteria
  submissionText:     string;             // combined content, ≤20k chars
  submissionFilename?: string;
}): Promise<PipelineResult<WorkEvaluation>>
```

Stage defaults: `stage: "work_evaluation"`, `maxCompletionTokens: 900`, `maxRetries: 1`. Uses `OPENAI_MODEL` (no per-stage override).

The system prompt instructs the model to evaluate honestly — mark `not_yet` when something is genuinely missing, not to encourage where encouragement is not warranted.

The user prompt includes: step `title`, `objective`, `deliverable`, `validation_check`, the `done_when` list from guidance, and the full submission text.

### Fallback (shape-complete)

If the AI call fails entirely, `runWorkEvaluation` returns this rather than throwing:

```typescript
{
  criterion_verdicts: [{
    criterion: step.validation_check,
    verdict:   "not_yet",
    note:      "Evaluation could not be completed. Please resubmit to try again.",
  }],
  overall_assessment:     "The evaluation failed due to a technical issue. Your submission was saved — resubmit to get a full evaluation.",
  strongest_aspect:       "Unable to assess at this time.",
  clearest_gap:           "Unable to assess at this time.",
  next_best_action:       "Resubmit your work to get a complete evaluation.",
  ready_to_mark_complete: false,
  // confidence omitted
}
```

The UI always receives a valid `WorkEvaluation` and can render normally regardless of AI failure.

---

## Section 3: API Route

New file: `src/app/api/ai/milestones/[id]/evaluate/route.ts`

### `POST /api/ai/milestones/[id]/evaluate`

**Request body schema:**

```typescript
const bodySchema = z.object({
  submission_text:     z.string().min(1).max(20_000),
  submission_kind:     z.enum(["pasted_text", "file_upload"]),
  submission_filename: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.submission_kind === "file_upload" && !data.submission_filename) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["submission_filename"],
      message: "submission_filename is required when submission_kind is file_upload",
    });
  }
});
```

**Route sequence:**

1. Auth → fetch milestone → verify ownership via project
2. Fetch roadmap + all milestones → build `RoadmapOverview`, locate `currentStep`
3. Fetch recommendation + normalized profile → build `GenerationContext` + `ProjectOption`
4. Fetch guidance from `milestone_guidance` — if not found, return `400: "Open the step guidance before submitting work"`. Guidance is the source of `done_when` criteria; evaluating without it silently degrades output.
5. **Insert** `milestone_submissions` row with `is_latest = true` (persist before evaluate — submission is never orphaned even if AI fails)
6. Run `runWorkEvaluation`
7. **Insert** `milestone_submission_evaluations` row
8. Track event with `fallback_used` explicitly in metadata alongside standard timing fields
9. Return response

**Response shape:**

```typescript
{
  submission: {
    id:                  string,
    submission_kind:     "pasted_text" | "file_upload",
    submission_filename: string | null,
    created_at:          string,
    updated_at:          string,
  },
  evaluation:    WorkEvaluation,
  evaluation_id: string,
}
```

Submission text is not echoed back — the client already has it.

### `GET /api/ai/milestones/[id]/evaluate`

Two explicit queries:

```
Step 1: SELECT * FROM milestone_submissions
        WHERE milestone_id = ? AND is_latest = true
        LIMIT 1

Step 2: SELECT * FROM milestone_submission_evaluations
        WHERE submission_id = <step1.id>
        ORDER BY created_at DESC
        LIMIT 1
```

If step 1 returns nothing, respond `200` with `{ "submission": null, "evaluation": null }`. The client checks `submission === null` to decide whether to show the form or the existing result. No 204.

Same response shape as POST when data exists.

---

## Section 4: UI

All changes are in `src/components/project/milestone-checklist.tsx`. The evaluation surface lives inside the existing expanded guidance panel, appended after the final "Done when / Coaching note" row, separated by a `border-t border-line pt-5` divider.

### Submission slot state

Four explicit states — `null` is never used for both "not loaded" and "nothing exists":

```typescript
type SubmissionSlot =
  | { status: "unloaded" }   // panel never opened, GET not yet called
  | { status: "loading" }    // GET in flight
  | { status: "empty" }      // GET returned no prior submission
  | { status: "loaded"; submission: StoredSubmission; result: StoredEvaluation };

const [submissionById, setSubmissionById] =
  useState<Record<string, SubmissionSlot>>({});
const [evaluationPendingId, setEvaluationPendingId] = useState<string | null>(null);
const [evaluationErrorById, setEvaluationErrorById] = useState<Record<string, string>>({});
const [resubmitModeById, setResubmitModeById] = useState<Record<string, boolean>>({});
```

A missing key is equivalent to `"unloaded"`. When the panel opens, the slot transitions `"unloaded" → "loading"` immediately before the GET fires. `fetchGuidance` and `loadSubmission` fire in parallel on panel open.

### Per-slot rendering

| Slot status | Renders |
|---|---|
| `"unloaded"` | Nothing (panel not open) |
| `"loading"` | "Loading your submission…" skeleton |
| `"empty"` | Submission form |
| `"loaded"` + not resubmit mode | Evaluation result + "Submit new version" button |
| `"loaded"` + resubmit mode | Prior result summary bar + submission form |
| `evaluationPendingId === id` | Form with "Evaluating…" state, inputs disabled (applies whether reached from `"empty"` or resubmit mode) |

### Sub-component: `MilestoneSubmissionForm`

Manages its own textarea value and file state. Calls `onSubmit(text, kind, filename?)` upward.

**Combined file + pasted text behavior:**

| File selected | Textarea filled | submission_kind | content sent |
|---|---|---|---|
| No | Yes | `"pasted_text"` | textarea value |
| Yes | No | `"file_upload"` | file content |
| Yes | Yes | `"file_upload"` | `${fileContent}\n\n--- Notes ---\n\n${pastedText}` |

When both are present, the form shows: _"File content and notes will be sent together."_

Accepted file extensions: `.py .js .ts .jsx .tsx .html .css .md .txt .json .csv .sql`

Character counter reflects combined length. "Get evaluation" disabled if length is 0 or POST is pending.

### User-friendly labels (no raw enum text)

| Raw value | Display |
|---|---|
| `"pasted_text"` | Pasted text |
| `"file_upload"` + filename | File: report.py |
| `"file_upload"` + combined | File: report.py + notes |
| verdict `"pass"` | Pass (success tone) |
| verdict `"partial"` | Partial (warning tone) |
| verdict `"not_yet"` | Not yet (danger tone) |
| confidence `"high"` | High confidence |
| confidence `"medium"` | Medium confidence |
| confidence `"low"` | Low confidence |

### Re-submit — preserving the sense of prior work

"Re-submit" is labeled **"Submit new version"**. When clicked, the prior evaluation collapses and a summary bar persists above the form:

```
┌─ Last evaluation · Apr 2 ──────────────────────────────┐
│  2 of 3 criteria passed · Not ready to mark complete   │
│  Your previous evaluation is saved.                    │
└────────────────────────────────────────────────────────┘
```

When the new POST resolves, `resubmitModeById` clears and the full result re-renders with the new data.

### Evaluation result layout

```
┌─ Your evaluation ─────────────── [Submit new version] ─┐
│  Pasted text · Apr 2                       [Medium conf]│
│                                                         │
│  Criterion verdicts                                     │
│  [Pass]    criterion text — note text                   │
│  [Partial] criterion text — note text                   │
│  [Not yet] criterion text — note text                   │
│                                                         │
│  Overall assessment                                     │
│  <overall_assessment>                                   │
│                                                         │
│  ┌─ Strongest aspect ─┐  ┌─ Clearest gap ─────────┐   │
│  │ <strongest_aspect> │  │ <clearest_gap>          │   │
│  └────────────────────┘  └─────────────────────────┘   │
│                                                         │
│  Next best action                                       │
│  <next_best_action>                                     │
│                                                         │
│  ┌─ Ready to mark complete? ──────────────────────┐    │
│  │  Yes — this step looks done.       (success)   │    │
│  │  — or —                                         │    │
│  │  Not quite — address the gaps above first.(muted│    │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

`confidence` badge renders next to submission metadata only when present. `ready_to_mark_complete: true` renders a success-tone callout. `false` renders a muted note — does not block the milestone checkbox.
