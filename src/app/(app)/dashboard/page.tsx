import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Lightbulb, MessageSquareText, Paperclip, Sparkles } from "lucide-react";
import { getRequiredUser } from "@/lib/auth/guard";
import { resolveDisplayName } from "@/lib/auth/names";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getArchivedProjectsForDashboard, getProjectsForDashboard } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getRecommendationAvailability, getRecommendationGenerationCount } from "@/lib/db/queries/recommendations";
import { PLAN_LIMITS } from "@/lib/usage/limits";
import { projectPath } from "@/lib/copy/glossary";
import { getPlanLabel } from "@/components/theme/theme-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProjectProgressTracker } from "@/components/project/project-progress-tracker";
import { ProjectArchiveActions } from "@/components/project/project-archive-actions";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();
  const [projects, archivedProjects, plan, generationCount, availability, { data: profile }] = await Promise.all([
    getProjectsForDashboard(user.id),
    getArchivedProjectsForDashboard(user.id),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
    getRecommendationAvailability(user.id),
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
  ]);
  const active = projects.find((project) => project.status === "active" || project.status === "paused") ?? projects[0] ?? null;
  const name = resolveDisplayName({ profileFullName: profile?.full_name, userMetadata: user.user_metadata, email: user.email });
  const totals = projects.reduce((result, project) => ({
    completedSteps: result.completedSteps + project.completedMilestones,
    evidence: result.evidence + project.outputMetrics.evidenceCount,
    feedback: result.feedback + project.outputMetrics.reviewerFeedbackCount,
  }), { completedSteps: 0, evidence: 0, feedback: 0 });
  const finished = projects.filter((project) => project.status === "completed").length;
  const nextAction = active
    ? { href: active.hasRoadmap && active.currentStepNumber ? projectPath(active.id, `steps/${active.currentStepNumber}`) : projectPath(active.id), label: active.hasRoadmap ? "Continue project" : "Generate roadmap" }
    : availability.hasIntake ? { href: "/recommendations", label: "Explore ideas" } : { href: "/onboarding", label: "Start onboarding" };

  return <div className="space-y-8 pb-8">
    <PageHeader eyebrow={`Welcome back, ${name.split(/\s+/)[0] ?? "there"}`} title="Keep the next finishable step moving." description="Your active work, visible momentum, and next action—without the project-management noise." metadata={<><Badge tone="neutral">{getPlanLabel(plan)}</Badge><span>{projects.length ? `${projects.length} saved ${projects.length === 1 ? "project" : "projects"}` : "Your workspace is ready"}</span></>} actions={<Button href={nextAction.href} trailingIcon={<ArrowRight className="h-4 w-4" />}>{nextAction.label}</Button>} />

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.65fr)]">
      <div className="relative isolate overflow-hidden rounded-3xl bg-navy px-6 py-7 text-cream shadow-soft sm:px-8 sm:py-8">
        <div className="aurora-fallback pointer-events-none absolute inset-0 -z-10 opacity-35" />
        <span className="inline-flex items-center gap-2 rounded-full border border-cream/15 bg-cream/[0.07] px-3 py-1 text-[11px] font-semibold text-cream/75"><Sparkles className="h-3.5 w-3.5 text-teal" />{active ? active.project_kind_label : "Your next project starts here"}</span>
        <h2 className="mt-5 max-w-3xl font-display text-3xl leading-tight tracking-tight text-cream sm:text-4xl">{active?.title ?? "Choose a direction worth finishing."}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/70">{active ? active.hasRoadmap ? active.progress.stageDetail : "Turn the direction you chose into a concrete, finishable roadmap." : "Compare distinct project directions, then choose the one that fits your purpose, resources, and real schedule."}</p>
        {active ? <ProjectProgressTracker progress={active.progress} compact contrast className="mt-6 max-w-3xl" /> : null}
        <div className="mt-7 flex flex-wrap gap-2.5"><Button href={nextAction.href} variant="contrast" trailingIcon={<ArrowRight className="h-4 w-4" />}>{nextAction.label}</Button><Button href="/recommendations" variant="outline" className="border-cream/15 bg-cream/[0.06] text-cream shadow-none hover:border-cream/25 hover:bg-cream/[0.11]">Compare ideas</Button></div>
      </div>
      <Card tone="butter" padding="lg" elevation="soft">
        <p className="editorial-kicker">Momentum</p><h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">Proof that your work is moving.</h2>
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line/80">
          <Metric label="Completed steps" value={totals.completedSteps} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <Metric label="Evidence items" value={totals.evidence} icon={<Paperclip className="h-3.5 w-3.5" />} />
          <Metric label="Reviewer notes" value={totals.feedback} icon={<MessageSquareText className="h-3.5 w-3.5" />} />
          <Metric label="Finished projects" value={finished} icon={<Sparkles className="h-3.5 w-3.5" />} />
        </div>
        <p className="mt-4 text-xs leading-5 text-ink-muted">{plan === "pro_monthly" ? "Unlimited idea generations with Pro coaching, subject to fair-use limits." : `${PLAN_LIMITS.free.generation_limit} free idea generations plus roadmap access.`} {generationCount ? `${generationCount} idea ${generationCount === 1 ? "board" : "boards"} generated.` : ""}</p>
      </Card>
    </section>
    <ProjectsSection projects={projects} archivedProjects={archivedProjects} />
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="bg-paper/90 p-4"><div className="flex items-center gap-2 text-[11px] font-medium text-ink-muted">{icon}{label}</div><p className="mt-2 text-xl font-semibold tabular-nums text-ink">{new Intl.NumberFormat("en-US").format(value)}</p></div>; }

type DashboardProject = Awaited<ReturnType<typeof getProjectsForDashboard>>[number];
type ArchivedProject = Awaited<ReturnType<typeof getArchivedProjectsForDashboard>>[number];
function ProjectsSection({ projects, archivedProjects }: { projects: DashboardProject[]; archivedProjects: ArchivedProject[] }) {
  return <Card padding="none" elevation="soft" className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-semibold tracking-tight text-ink">Your projects</h2><p className="mt-1 text-sm text-ink-muted">Every active direction, with the next move visible.</p></div><Button href="/recommendations" variant="outline" size="sm" leadingIcon={<Lightbulb className="h-4 w-4" />}>Browse ideas</Button></div>
    {projects.length ? <div className="divide-y divide-line/75">{projects.map((project) => <div key={project.id} className="grid gap-4 px-5 py-4 hover:bg-surface/45 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(12rem,17rem)_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-ink">{project.title}</h3><Badge tone="neutral">{project.project_kind_label}</Badge></div><p className="mt-1 line-clamp-1 text-xs text-ink-muted">{project.progress.stageDetail}</p></div><div className="space-y-2"><div className="flex justify-between text-xs"><span className="font-medium text-ink-soft">{project.progress.stageLabel}</span><span className="tabular-nums text-ink-muted">{project.progress.percent}%</span></div><ProgressBar value={project.progress.percent} ariaLabel={`${project.title} progress`} /></div><div className="flex items-center gap-1"><Button href={`/project/${project.id}`} variant="ghost" size="sm" trailingIcon={<ArrowRight className="h-4 w-4" />}>Open</Button><ProjectArchiveActions projectId={project.id} projectTitle={project.title} archived={false} /></div></div>)}</div> : <div className="p-6"><h3 className="text-base font-semibold text-ink">Start with what matters to you.</h3><p className="mt-1 max-w-xl text-sm leading-6 text-ink-soft">Tell Sevri what you care about, what you want this project to do for you, and what you can realistically use.</p><Button href="/onboarding" size="sm" className="mt-4">Start onboarding</Button></div>}
    {archivedProjects.length ? <details className="border-t border-line/80"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink-soft sm:px-6">Archived ({archivedProjects.length}) — hidden, not deleted</summary><div className="divide-y divide-line/75 border-t border-line/80">{archivedProjects.map((project) => <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="text-sm font-medium text-ink-soft">{project.title}</span><Badge tone="neutral">{project.project_kind_label}</Badge></div><div className="flex items-center gap-1"><Button href={`/project/${project.id}`} variant="ghost" size="sm">Open</Button><ProjectArchiveActions projectId={project.id} projectTitle={project.title} archived /></div></div>)}</div></details> : null}
  </Card>;
}
