"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { PortfolioCurationTrigger } from "@/components/portfolio/portfolio-curation-trigger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getPlanLabel, getTrackLabel } from "@/components/theme/theme-utils";
import { trackClientEvent } from "@/lib/analytics/events";
import { RATE_LIMITED_MESSAGE, toUserFacingError } from "@/lib/errors/user-messages";
import {
  getPortfolioCurationState,
  isEligibleForFirstTimeCuration,
  type PortfolioCurationState,
  type PortfolioEntryDetailView,
  type PortfolioStatus,
} from "@/lib/portfolio/portfolio-view-model";
import { cn } from "@/lib/utils";
import {
  canGenerateExports,
  canPublishPortfolio,
  canRegeneratePortfolioCuration,
} from "@/lib/usage/limits";
import type { PortfolioExportFormat } from "@/lib/db/queries/portfolio";
import type { Plan } from "@/types/domain";

type PortfolioEntry = PortfolioEntryDetailView["entry"];
type PortfolioExport = PortfolioEntryDetailView["exports"][number];
type PortfolioPublicPage = NonNullable<PortfolioEntryDetailView["publicPage"]>;
type UpgradeFeature = "portfolio_export" | "portfolio_publish" | "portfolio_regenerate_curation";

interface ApiErrorBody {
  error?: string;
  code?: string;
  resetAt?: string;
  findings?: Array<{ message?: string; field?: string; kind?: string; excerpt?: string }>;
}

const statusOptions: Array<{ value: PortfolioStatus; label: string }> = [
  { value: "in_progress", label: "In Progress" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Cut" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved yet";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function exportLabel(format: PortfolioExportFormat) {
  return format === "common_app_activity" ? "Common App activity" : "Resume bullets";
}

function upgradeCopy(feature: UpgradeFeature) {
  if (feature === "portfolio_export") {
    return "Upgrade to Pro to generate Portfolio exports.";
  }
  if (feature === "portfolio_publish") {
    return "Upgrade to Pro to publish a Portfolio page.";
  }
  return "Upgrade to Pro to regenerate Portfolio curation.";
}

function responseMessage(body: ApiErrorBody | null, fallback: string) {
  if (body?.code === "safety_check_failed" && body.findings?.length) {
    return `Safety check failed: ${body.findings
      .slice(0, 3)
      .map((finding) => finding.message ?? finding.kind ?? "Review the public text.")
      .join(" ")}`;
  }
  if (body?.code === "rate_limited") {
    return RATE_LIMITED_MESSAGE;
  }
  return toUserFacingError(body?.error, fallback);
}

function isLivePublicPage(publicPage: PortfolioEntryDetailView["publicPage"]) {
  return Boolean(publicPage?.published_at && !publicPage.unpublished_at);
}

function missingCurationCopy(state: PortfolioCurationState, canRegenerate: boolean) {
  if (state === "blocked") {
    return "This summary is on hold until its text passes the publishing safety check. Everything else on this entry stays available.";
  }

  if (state === "failed") {
    return canRegenerate
      ? "This summary could not be generated. Your work is saved — regenerate it now, or wait for the next automatic attempt."
      : "This summary could not be generated. Your work is saved, and Sevri will try again automatically.";
  }

  return "Curation has not run yet. The entry stays usable while the first summary is pending.";
}

export function PortfolioDetailClient({
  view,
  plan,
}: {
  view: PortfolioEntryDetailView;
  plan: Plan;
}) {
  const router = useRouter();
  const [entry, setEntry] = useState(view.entry);
  const [exports, setExports] = useState(view.exports);
  const [publicPage, setPublicPage] = useState(view.publicPage);
  const [reflection, setReflection] = useState(entry.student_reflection ?? "");
  const [featuredEvidenceNote, setFeaturedEvidenceNote] = useState(entry.featured_evidence_note ?? "");
  const [statusOverride, setStatusOverride] = useState(entry.status_override ?? "");
  const [featuredSubmissionId, setFeaturedSubmissionId] = useState(entry.featured_submission_id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [displayNameChoice, setDisplayNameChoice] = useState<"anonymous" | "real">(
    publicPage?.display_name_choice ?? "anonymous",
  );
  const [ageAttested, setAgeAttested] = useState(false);
  const [publicAcknowledged, setPublicAcknowledged] = useState(false);

  const canRegenerate = canRegeneratePortfolioCuration(plan);
  const curationState = getPortfolioCurationState(entry);
  const canExport = canGenerateExports(plan);
  const canPublish = canPublishPortfolio(plan);
  const livePublicPage = isLivePublicPage(publicPage);
  const publicUrl = publicPage?.slug ? `/p/${publicPage.slug}` : null;

  useEffect(() => {
    void trackClientEvent("portfolio_project_opened", {
      project_id: view.project.id,
      portfolio_entry_id: view.entry.id,
    }).catch((error) => {
      console.error("portfolio_project_opened tracking failed", error);
    });
  }, [view.entry.id, view.project.id]);

  const milestoneById = useMemo(() => {
    return new Map(view.milestones.map((milestone) => [milestone.id, milestone]));
  }, [view.milestones]);

  const selectedSubmission = useMemo(() => {
    if (featuredSubmissionId) {
      return view.latestSubmissions.find((submission) => submission.id === featuredSubmissionId) ?? null;
    }
    return view.latestSubmissions[0] ?? null;
  }, [featuredSubmissionId, view.latestSubmissions]);

  const exportsByFormat = useMemo(() => {
    return new Map(exports.map((item) => [item.export_format, item]));
  }, [exports]);

  async function trackUpgradeClick(feature: UpgradeFeature) {
    setMessage(upgradeCopy(feature));
    await trackClientEvent("upgrade_clicked", {
      source: "portfolio",
      feature,
    }).catch((trackError) => {
      console.error("portfolio upgrade_clicked tracking failed", trackError);
    });
  }

  async function patchEntry(patch: Record<string, unknown>, successMessage: string) {
    setPendingAction("patch");
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/portfolio/${view.project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await response.json().catch(() => null)) as { entry?: PortfolioEntry } & ApiErrorBody | null;

    if (!response.ok || !body?.entry) {
      setError(responseMessage(body, "Failed to save Portfolio entry."));
      setPendingAction(null);
      return null;
    }

    setEntry(body.entry);
    setMessage(successMessage);
    setPendingAction(null);
    router.refresh();
    return body.entry;
  }

  async function saveReflection() {
    if (reflection === (entry.student_reflection ?? "")) return;
    await patchEntry({ student_reflection: reflection }, "Reflection saved.");
  }

  async function saveFeaturedEvidenceNote() {
    if (featuredEvidenceNote === (entry.featured_evidence_note ?? "")) return;
    await patchEntry({ featured_evidence_note: featuredEvidenceNote }, "Evidence note saved.");
  }

  async function updateStatusOverride(value: string) {
    setStatusOverride(value);
    await patchEntry(
      { status_override: value.length > 0 ? value : null },
      "Portfolio status saved.",
    );
  }

  async function updateFeaturedSubmission(value: string) {
    setFeaturedSubmissionId(value);
    await patchEntry(
      { featured_submission_id: value.length > 0 ? value : null },
      "Featured evidence saved.",
    );
  }

  async function regenerateCuration() {
    if (!canRegenerate) {
      await trackUpgradeClick("portfolio_regenerate_curation");
      return;
    }

    setPendingAction("regenerate");
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/portfolio/${view.project.id}/regenerate-curation`, {
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as { entry?: PortfolioEntry } & ApiErrorBody | null;

    if (!response.ok || !body?.entry) {
      setError(responseMessage(body, "Failed to regenerate curation."));
      setPendingAction(null);
      return;
    }

    setEntry(body.entry);
    setMessage("Curation regenerated.");
    setPendingAction(null);
    router.refresh();
  }

  async function generateExport(format: PortfolioExportFormat) {
    if (!canExport) {
      await trackUpgradeClick("portfolio_export");
      return;
    }

    const route = format === "common_app_activity" ? "common-app" : "resume";
    setPendingAction(format);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/portfolio/${view.project.id}/exports/${route}`, {
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as { portfolio_export?: PortfolioExport } & ApiErrorBody | null;

    if (!response.ok || !body?.portfolio_export) {
      setError(responseMessage(body, `Failed to generate ${exportLabel(format)}.`));
      setPendingAction(null);
      return;
    }

    setExports((current) => [
      body.portfolio_export!,
      ...current.filter((item) => item.export_format !== format),
    ]);
    setMessage(`${exportLabel(format)} generated.`);
    setPendingAction(null);
    router.refresh();
  }

  async function publish() {
    if (!canPublish) {
      await trackUpgradeClick("portfolio_publish");
      return;
    }

    setPendingAction("publish");
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/portfolio/${view.project.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name_choice: displayNameChoice,
        age_attestation: ageAttested,
        public_acknowledgement: publicAcknowledged,
      }),
    });
    const body = (await response.json().catch(() => null)) as { public_page?: PortfolioPublicPage; url?: string } & ApiErrorBody | null;

    if (!response.ok || !body?.public_page) {
      setError(responseMessage(body, "Failed to publish Portfolio page."));
      setPendingAction(null);
      return;
    }

    setPublicPage(body.public_page);
    setMessage("Portfolio page published.");
    setPendingAction(null);
    router.refresh();
  }

  async function unpublish() {
    setPendingAction("unpublish");
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/portfolio/${view.project.id}/unpublish`, {
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as { public_page?: PortfolioPublicPage | null } & ApiErrorBody | null;

    if (!response.ok) {
      setError(responseMessage(body, "Failed to unpublish Portfolio page."));
      setPendingAction(null);
      return;
    }

    setPublicPage(body?.public_page ?? null);
    setMessage("Portfolio page unpublished.");
    setPendingAction(null);
    router.refresh();
  }

  return (
    <div className="space-y-8 pb-12">
      <PortfolioCurationTrigger
        active={isEligibleForFirstTimeCuration(entry)}
        curationKey={`${entry.id}:${entry.updated_at}:${entry.curation_claimed_at ?? ""}`}
        projectId={view.project.id}
      />
      <Card>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="contrast">{getPlanLabel(plan)}</Badge>
            <Badge tone={view.projectTrack === "software" ? "software" : "research"}>
              {getTrackLabel(view.projectTrack)}
            </Badge>
            <Badge tone={view.effectiveStatus === "completed" ? "success" : "warning"}>
              {view.statusLabel}
            </Badge>
            {entry.curated_summary ? <Badge tone="contrast">Curated</Badge> : null}
          </div>
          <PageHeader
            eyebrow="Portfolio entry"
            title={view.project.title}
            description={entry.curated_summary ?? view.summary}
            actions={
              <Button href={`/project/${view.project.id}`} variant="outline">
                Open workspace
              </Button>
            }
            className="border-b-0 pb-0"
          />
          <ProgressBar
            value={view.completionPercent}
            label="Project progress"
            helperText={`${view.completedMilestones} of ${view.totalMilestones} project steps complete`}
            className="[&_.text-ink]:text-paper [&_.text-ink-muted]:text-paper/55"
          />
        </div>
      </Card>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="space-y-4">
          <Card className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="editorial-kicker">Curated summary</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">A conservative project readout.</h2>
              </div>
              <GatedButton
                allowed={canRegenerate}
                feature="portfolio_regenerate_curation"
                pending={pendingAction === "regenerate"}
                pendingLabel="Regenerating..."
                onAllowed={() => void regenerateCuration()}
                onLocked={() => void trackUpgradeClick("portfolio_regenerate_curation")}
              >
                Regenerate
              </GatedButton>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">
              {entry.curated_summary ?? missingCurationCopy(curationState, canRegenerate)}
            </p>
            {entry.curation_generated_at ? (
              <p className="text-xs text-ink-muted">
                Last generated {formatDate(entry.curation_generated_at)}
              </p>
            ) : null}
          </Card>

          <Card className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="portfolio-status" className="text-sm font-semibold text-ink">
                  Portfolio status
                </label>
                <Select
                  id="portfolio-status"
                  value={statusOverride}
                  onChange={(event) => void updateStatusOverride(event.target.value)}
                  disabled={pendingAction === "patch"}
                >
                  <option value="">Use project status ({view.statusLabel})</option>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="featured-submission" className="text-sm font-semibold text-ink">
                  Featured evidence
                </label>
                <Select
                  id="featured-submission"
                  value={featuredSubmissionId}
                  onChange={(event) => void updateFeaturedSubmission(event.target.value)}
                  disabled={pendingAction === "patch" || view.latestSubmissions.length === 0}
                >
                  <option value="">Use latest submitted evidence</option>
                  {view.latestSubmissions.map((submission) => {
                    const milestone = milestoneById.get(submission.milestone_id);
                    return (
                      <option key={submission.id} value={submission.id}>
                        {milestone ? `Step ${milestone.order_index + 1}: ${milestone.title}` : "Submitted work"}
                      </option>
                    );
                  })}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="featured-note" className="text-sm font-semibold text-ink">
                Evidence note
              </label>
              <Textarea
                id="featured-note"
                value={featuredEvidenceNote}
                onChange={(event) => setFeaturedEvidenceNote(event.target.value)}
                onBlur={() => void saveFeaturedEvidenceNote()}
                maxLength={1000}
                placeholder="Optional note about why this evidence matters."
              />
            </div>

            <div className="rounded-2xl border border-line bg-canvas p-4">
              <p className="editorial-kicker">Selected evidence preview</p>
              <p className="mt-2 line-clamp-[12] whitespace-pre-wrap text-sm leading-6 text-ink-soft">
                {selectedSubmission?.submission_text?.trim()
                  ? selectedSubmission.submission_text
                  : "No submitted work is available for this project yet."}
              </p>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="editorial-kicker">Student reflection</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">What you learned and would do next.</h2>
            </div>
            <Textarea
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              onBlur={() => void saveReflection()}
              maxLength={6000}
              rows={9}
              placeholder="Write a private reflection. If the project is published, this text is part of the public surface."
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
              <span>{reflection.length.toLocaleString()} / 6,000 characters</span>
              <span>Save on blur</span>
            </div>
          </Card>

          <ReviewerFeedbackSummary reviews={view.reviews} milestoneById={milestoneById} />
        </div>

        <div className="space-y-4">
          <GithubActivitySnapshot commits={view.cachedCommits} />
          <ExportsPanel
            exportsByFormat={exportsByFormat}
            canExport={canExport}
            pendingAction={pendingAction}
            onGenerate={(format) => void generateExport(format)}
            onLocked={() => void trackUpgradeClick("portfolio_export")}
          />
          <PublishPanel
            canPublish={canPublish}
            livePublicPage={livePublicPage}
            publicUrl={publicUrl}
            displayNameChoice={displayNameChoice}
            setDisplayNameChoice={setDisplayNameChoice}
            ageAttested={ageAttested}
            setAgeAttested={setAgeAttested}
            publicAcknowledged={publicAcknowledged}
            setPublicAcknowledged={setPublicAcknowledged}
            pendingAction={pendingAction}
            onPublish={() => void publish()}
            onUnpublish={() => void unpublish()}
            onLocked={() => void trackUpgradeClick("portfolio_publish")}
          />
        </div>
      </div>
    </div>
  );
}

function GatedButton({
  allowed,
  feature,
  pending,
  pendingLabel,
  children,
  onAllowed,
  onLocked,
  variant = "outline",
}: {
  allowed: boolean;
  feature: UpgradeFeature;
  pending: boolean;
  pendingLabel: string;
  children: string;
  onAllowed: () => void;
  onLocked: () => void;
  variant?: "primary" | "outline";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={allowed ? onAllowed : onLocked}
      disabled={allowed && pending}
      aria-disabled={!allowed}
      title={!allowed ? upgradeCopy(feature) : undefined}
      className={cn("rounded-full", !allowed && "cursor-not-allowed opacity-60")}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

function GithubActivitySnapshot({
  commits,
}: {
  commits: PortfolioEntryDetailView["cachedCommits"];
}) {
  return (
    <Card className="space-y-4">
      <div>
        <p className="editorial-kicker">Cached GitHub activity</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">Latest stored commits.</h2>
      </div>
      {commits.length > 0 ? (
        <ul className="space-y-3">
          {commits.slice(0, 6).map((commit) => (
            <li key={commit.sha} className="rounded-2xl border border-line bg-canvas p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs font-semibold text-ink">{commit.shortSha}</code>
                <span className="text-xs text-ink-muted">{formatDate(commit.authoredAt)}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">{commit.title}</p>
              {commit.body ? (
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-ink-soft">{commit.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-ink-soft">
          No cached GitHub commits are stored for this project.
        </p>
      )}
    </Card>
  );
}

function ExportsPanel({
  exportsByFormat,
  canExport,
  pendingAction,
  onGenerate,
  onLocked,
}: {
  exportsByFormat: Map<PortfolioExportFormat, PortfolioExport>;
  canExport: boolean;
  pendingAction: string | null;
  onGenerate: (format: PortfolioExportFormat) => void;
  onLocked: () => void;
}) {
  const commonApp = exportsByFormat.get("common_app_activity") ?? null;
  const resume = exportsByFormat.get("resume_bullets") ?? null;

  return (
    <Card className="space-y-5">
      <div>
        <p className="editorial-kicker">Exports</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">Application-ready drafts.</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <GatedButton
          allowed={canExport}
          feature="portfolio_export"
          pending={pendingAction === "common_app_activity"}
          pendingLabel="Generating..."
          onAllowed={() => onGenerate("common_app_activity")}
          onLocked={onLocked}
        >
          Common App
        </GatedButton>
        <GatedButton
          allowed={canExport}
          feature="portfolio_export"
          pending={pendingAction === "resume_bullets"}
          pendingLabel="Generating..."
          onAllowed={() => onGenerate("resume_bullets")}
          onLocked={onLocked}
        >
          Resume
        </GatedButton>
      </div>
      <ExportPreview label="Common App activity" item={commonApp} />
      <ExportPreview label="Resume bullets" item={resume} />
    </Card>
  );
}

function ExportPreview({
  label,
  item,
}: {
  label: string;
  item: PortfolioExport | null;
}) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {item ? <span className="text-xs text-ink-muted">{formatDate(item.generated_at)}</span> : null}
      </div>
      {item ? (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-3 text-xs leading-5 text-ink-soft">
          {item.export_text ?? JSON.stringify(item.export_json, null, 2)}
        </pre>
      ) : (
        <p className="mt-2 text-sm leading-6 text-ink-soft">No saved export yet.</p>
      )}
    </div>
  );
}

function PublishPanel({
  canPublish,
  livePublicPage,
  publicUrl,
  displayNameChoice,
  setDisplayNameChoice,
  ageAttested,
  setAgeAttested,
  publicAcknowledged,
  setPublicAcknowledged,
  pendingAction,
  onPublish,
  onUnpublish,
  onLocked,
}: {
  canPublish: boolean;
  livePublicPage: boolean;
  publicUrl: string | null;
  displayNameChoice: "anonymous" | "real";
  setDisplayNameChoice: (value: "anonymous" | "real") => void;
  ageAttested: boolean;
  setAgeAttested: (value: boolean) => void;
  publicAcknowledged: boolean;
  setPublicAcknowledged: (value: boolean) => void;
  pendingAction: string | null;
  onPublish: () => void;
  onUnpublish: () => void;
  onLocked: () => void;
}) {
  return (
    <Card className="space-y-5">
      <div>
        <p className="editorial-kicker">Publishing</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">Per-project public page.</h2>
      </div>

      {livePublicPage && publicUrl ? (
        <Alert tone="success" heading="Public page is live.">
          <a href={publicUrl} className="font-semibold underline underline-offset-4">
            {publicUrl}
          </a>
        </Alert>
      ) : (
        <Alert tone="info">This project is private.</Alert>
      )}

      <div className="space-y-2">
        <label htmlFor="display-name-choice" className="text-sm font-semibold text-ink">
          Display name
        </label>
        <Select
          id="display-name-choice"
          value={displayNameChoice}
          onChange={(event) => setDisplayNameChoice(event.target.value === "real" ? "real" : "anonymous")}
        >
          <option value="anonymous">A Sevri student</option>
          <option value="real">Use profile name</option>
        </Select>
      </div>

      <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
        <input
          type="checkbox"
          checked={ageAttested}
          onChange={(event) => setAgeAttested(event.target.checked)}
          className="mt-1"
        />
        <span>I attest that I am at least 16 years old.</span>
      </label>
      <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
        <input
          type="checkbox"
          checked={publicAcknowledged}
          onChange={(event) => setPublicAcknowledged(event.target.checked)}
          className="mt-1"
        />
        <span>I understand this page is public if published.</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <GatedButton
          allowed={canPublish}
          feature="portfolio_publish"
          pending={pendingAction === "publish"}
          pendingLabel="Publishing..."
          onAllowed={onPublish}
          onLocked={onLocked}
          variant="primary"
        >
          {livePublicPage ? "Republish" : "Publish"}
        </GatedButton>
        {livePublicPage ? (
          <Button
            type="button"
            variant="outline"
            onClick={onUnpublish}
            disabled={pendingAction === "unpublish"}
            className="rounded-full"
          >
            {pendingAction === "unpublish" ? "Unpublishing..." : "Unpublish"}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function ReviewerFeedbackSummary({
  reviews,
  milestoneById,
}: {
  reviews: PortfolioEntryDetailView["reviews"];
  milestoneById: Map<string, PortfolioEntryDetailView["milestones"][number]>;
}) {
  return (
    <Card className="space-y-5">
      <div className="space-y-1">
        <Badge tone={reviews.length > 0 ? "accent" : "neutral"}>Reviewer feedback</Badge>
        <h2 className="text-xl font-semibold text-ink">Feedback included in private curation.</h2>
      </div>

      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map((review) => {
            const milestone = milestoneById.get(review.milestone_id);
            return (
              <div key={review.id} className="rounded-2xl border border-line bg-canvas p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {milestone ? `Step ${milestone.order_index + 1}: ${milestone.title}` : "Project review"}
                  </p>
                  <Badge tone={review.ready_to_mark_complete ? "success" : "warning"}>
                    {review.ready_to_mark_complete ? "Ready" : "Not yet"}
                  </Badge>
                </div>
                <ReviewLine label="Strength" value={review.strength} />
                <ReviewLine label="What to tighten" value={review.tighten} />
                <ReviewLine label="Suggested next action" value={review.next_action} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm leading-6 text-ink-soft">
          No non-superseded reviewer feedback is attached to this project yet.
        </p>
      )}
    </Card>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}
