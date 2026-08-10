import { BookOpen, ExternalLink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PROJECT_SECTION_LABELS } from "@/lib/copy/glossary";
import type { LearningResource } from "@/lib/ai/schemas";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

const STAGE_DETAILS: Record<LearningResource["learning_stage"], { label: string; description: string }> = {
  start_here: {
    label: "Start here",
    description: "Build the vocabulary and mental model you need before the first technical decision.",
  },
  build_with: {
    label: "Build with",
    description: "Keep these references open while you implement, investigate, or analyze the core work.",
  },
  go_deeper: {
    label: "Go deeper",
    description: "Use these once the core works and you are ready to understand the harder trade-offs.",
  },
};

const RESOURCE_TYPE_LABELS: Record<LearningResource["resource_type"], string> = {
  documentation: "Documentation",
  course: "Course",
  tutorial: "Tutorial",
  paper: "Paper",
  dataset: "Dataset",
  tool: "Tool",
  reference: "Reference",
};

export function LearningResourcesPreview({ workspace }: { workspace: ProjectWorkspaceView }) {
  const preview = workspace.learningResources.slice(0, 3);

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-ink">Learn as you build</h2>
          </div>
          <p className="text-sm leading-6 text-ink-muted">
            Your roadmap includes sources for the skills behind the work, not just the steps that use them.
          </p>
        </div>
        <Button href={`/project/${workspace.project.id}/resources`} variant="outline">
          Open learning resources
        </Button>
      </div>

      {preview.length > 0 ? (
        <div className="divide-y divide-line border-y border-line">
          {preview.map((resource) => (
            <ResourceRow key={resource.url} resource={resource} compact />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-ink-soft">
          This roadmap predates project learning resources. Step pages still include their original tools and references.
        </p>
      )}
    </Card>
  );
}

export function ProjectLearningResourcesView({ workspace }: { workspace: ProjectWorkspaceView }) {
  const resources = workspace.learningResources;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={PROJECT_SECTION_LABELS.resources}
        title="Learn what the project asks of you"
        description="A source-backed path from the first unfamiliar concept to the deeper material behind your finished work."
      />

      {resources.length === 0 ? (
        <Alert tone="info" heading="This roadmap does not have a learning library yet.">
          It was created before source-backed resources were added. Your existing step guidance and project work are unchanged.
        </Alert>
      ) : (
        (["start_here", "build_with", "go_deeper"] as const).map((stage) => {
          const stageResources = resources.filter((resource) => resource.learning_stage === stage);
          if (stageResources.length === 0) return null;
          const details = STAGE_DETAILS[stage];

          return (
            <section key={stage} className="space-y-4" aria-labelledby={`resources-${stage}`}>
              <div className="max-w-2xl space-y-1">
                <h2 id={`resources-${stage}`} className="text-xl font-semibold text-ink">
                  {details.label}
                </h2>
                <p className="text-sm leading-6 text-ink-muted">{details.description}</p>
              </div>
              <div className="divide-y divide-line rounded-xl border border-line bg-paper px-4 sm:px-5">
                {stageResources.map((resource) => (
                  <ResourceRow key={resource.url} resource={resource} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function ResourceRow({ resource, compact = false }: { resource: LearningResource; compact?: boolean }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start justify-between gap-4 py-4 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-ink transition-colors group-hover:text-primary">{resource.title}</p>
          <Badge tone="neutral">{RESOURCE_TYPE_LABELS[resource.resource_type]}</Badge>
          {resource.free_access ? <Badge tone="success">Free</Badge> : null}
        </div>
        <p className="text-xs text-ink-muted">
          {resource.provider} · Use during Step {resource.use_during_step}
        </p>
        {!compact ? <p className="max-w-3xl text-sm leading-6 text-ink-soft">{resource.why_it_matters}</p> : null}
      </div>
      <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-primary" aria-hidden="true" />
      <span className="sr-only"> Opens in a new tab</span>
    </a>
  );
}
