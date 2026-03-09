"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toList } from "@/lib/utils";
import { onboardingInputSchema } from "@/lib/validators/onboarding";

const wizardSchema = z.object({
  project_track: z.enum(["software", "research"]),
  full_name: z.string().min(2),
  student_stage: z.string().min(2),
  target_outcome: z.enum(["college_apps", "internship", "portfolio", "learning"]),
  interests: z.string().min(2),
  favorite_subjects: z.string().min(2),
  weekly_time_available: z.coerce.number().int().min(1).max(80),

  coding_experience: z.enum(["beginner", "intermediate", "advanced"]),
  preferred_project_style: z.string().min(2),
  known_tools: z.string().optional(),
  target_schools_or_companies: z.string().optional(),
  preferred_difficulty: z.enum(["beginner", "beginner_intermediate", "intermediate", "intermediate_advanced"]),

  preferred_research_domain: z.string().min(2),
  research_experience: z.enum(["beginner", "intermediate", "advanced"]),
  mentor_access: z.enum(["none", "limited", "strong"]),
  methodology_preference: z.enum(["literature_review", "experiment", "data_analysis", "survey_based", "mixed"]),
  research_tools_or_resources: z.string().optional(),
  target_research_deliverable: z.enum([
    "paper",
    "poster",
    "presentation",
    "competition_submission",
    "portfolio_entry",
  ]),
  data_or_resource_access: z.string().optional(),

  constraints: z.string().optional(),
  additional_context: z.string().optional(),
});

type WizardValues = z.infer<typeof wizardSchema>;
type WizardField = keyof WizardValues;

const sharedStepFields: WizardField[][] = [
  ["project_track", "full_name", "student_stage", "target_outcome"],
  ["interests", "favorite_subjects", "weekly_time_available"],
];

const softwareStepFields: WizardField[] = [
  "coding_experience",
  "preferred_project_style",
  "known_tools",
  "target_schools_or_companies",
  "preferred_difficulty",
  "constraints",
  "additional_context",
];

const researchStepFields: WizardField[] = [
  "preferred_research_domain",
  "research_experience",
  "mentor_access",
  "methodology_preference",
  "research_tools_or_resources",
  "target_research_deliverable",
  "data_or_resource_access",
  "constraints",
  "additional_context",
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      project_track: "software",
      full_name: "",
      student_stage: "high_school_junior",
      target_outcome: "portfolio",
      interests: "",
      favorite_subjects: "",
      weekly_time_available: 6,

      coding_experience: "beginner",
      preferred_project_style: "web app",
      known_tools: "",
      target_schools_or_companies: "",
      preferred_difficulty: "beginner_intermediate",

      preferred_research_domain: "social science",
      research_experience: "beginner",
      mentor_access: "limited",
      methodology_preference: "data_analysis",
      research_tools_or_resources: "",
      target_research_deliverable: "portfolio_entry",
      data_or_resource_access: "",

      constraints: "",
      additional_context: "",
    },
  });

  const projectTrack = form.watch("project_track");

  useEffect(() => {
    fetch("/api/events/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "onboarding_started", metadata: { project_track: form.getValues("project_track") } }),
    }).catch(() => undefined);
  }, [form]);

  const stepFields = useMemo(
    () => [...sharedStepFields, projectTrack === "software" ? softwareStepFields : researchStepFields],
    [projectTrack],
  );

  const progress = useMemo(() => ((step + 1) / stepFields.length) * 100, [step, stepFields.length]);

  async function nextStep() {
    const isValid = await form.trigger(stepFields[step]);
    if (isValid) {
      setStep((prev) => Math.min(prev + 1, stepFields.length - 1));
    }
  }

  async function onSubmit(values: WizardValues) {
    setError(null);
    setIsSubmitting(true);

    try {
      const sharedPayload = {
        project_track: values.project_track,
        full_name: values.full_name,
        student_stage: values.student_stage,
        target_outcome: values.target_outcome,
        interests: toList(values.interests),
        favorite_subjects: toList(values.favorite_subjects),
        weekly_time_available: values.weekly_time_available,
        constraints: values.constraints,
        additional_context: values.additional_context,
      };

      const payload =
        values.project_track === "software"
          ? onboardingInputSchema.parse({
              ...sharedPayload,
              project_track: "software",
              coding_experience: values.coding_experience,
              preferred_project_style: values.preferred_project_style,
              known_tools: toList(values.known_tools ?? ""),
              target_schools_or_companies: toList(values.target_schools_or_companies ?? ""),
              preferred_difficulty: values.preferred_difficulty,
            })
          : onboardingInputSchema.parse({
              ...sharedPayload,
              project_track: "research",
              preferred_research_domain: values.preferred_research_domain,
              research_experience: values.research_experience,
              mentor_access: values.mentor_access,
              methodology_preference: values.methodology_preference,
              research_tools_or_resources: toList(values.research_tools_or_resources ?? ""),
              target_research_deliverable: values.target_research_deliverable,
              data_or_resource_access: values.data_or_resource_access,
            });

      const response = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; details?: string } | null;
        setError(body?.details ?? body?.error ?? "Failed to save onboarding.");
        setIsSubmitting(false);
        return;
      }

      router.push("/recommendations");
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to validate onboarding answers.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  const submitFinalStep = form.handleSubmit(onSubmit);

  return (
    <Card className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-ink-700">Onboarding</p>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">Choose your Sevri track</h1>
        <p className="mt-1 text-sm text-ink-600">
          Pick the path you want to execute: a software build or a research project with real, scoped outcomes.
        </p>
      </div>

      <div className="h-2 w-full rounded-full bg-ink-100">
        <div className="h-2 rounded-full bg-mint-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        {step === 0 ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <TrackOption
                title="Software Project"
                description="Build and ship a scoped app/tool you can show in portfolios and internships."
                isActive={projectTrack === "software"}
                onClick={() => form.setValue("project_track", "software", { shouldValidate: true })}
              />
              <TrackOption
                title="Research Project"
                description="Design a credible student research project with practical methods and deliverables."
                isActive={projectTrack === "research"}
                onClick={() => form.setValue("project_track", "research", { shouldValidate: true })}
              />
            </div>

            <Field label="Name">
              <Input {...form.register("full_name")} placeholder="Alex Johnson" />
            </Field>

            <Field label="Student stage">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("student_stage")}>
                <option value="high_school_freshman">High school freshman</option>
                <option value="high_school_sophomore">High school sophomore</option>
                <option value="high_school_junior">High school junior</option>
                <option value="high_school_senior">High school senior</option>
                <option value="college_freshman">College freshman</option>
                <option value="college_sophomore">College sophomore</option>
                <option value="college_junior">College junior</option>
                <option value="college_senior">College senior</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Target outcome">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("target_outcome")}>
                <option value="college_apps">College applications</option>
                <option value="internship">Internship</option>
                <option value="portfolio">Portfolio</option>
                <option value="learning">Learning</option>
              </select>
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label={projectTrack === "software" ? "Technical interests (comma-separated)" : "Project interests (comma-separated)"}>
              <Input
                {...form.register("interests")}
                placeholder={projectTrack === "software" ? "AI, productivity, climate" : "Behavioral science, health, local policy"}
              />
            </Field>
            <Field label={projectTrack === "software" ? "Favorite subjects/domains (comma-separated)" : "Academic subjects you enjoy (comma-separated)"}>
              <Input {...form.register("favorite_subjects")} placeholder="Math, economics, biology" />
            </Field>
            <Field label="Weekly time available (hours)">
              <Input type="number" min={1} max={80} {...form.register("weekly_time_available", { valueAsNumber: true })} />
            </Field>
          </>
        ) : null}

        {step === 2 && projectTrack === "software" ? (
          <>
            <Field label="Coding experience">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("coding_experience")}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </Field>
            <Field label="Preferred project style">
              <Input {...form.register("preferred_project_style")} placeholder="web app, AI tool, automation" />
            </Field>
            <Field label="Known tools (comma-separated)">
              <Input {...form.register("known_tools")} placeholder="React, Python, SQL" />
            </Field>
            <Field label="Target schools/companies (optional)">
              <Input {...form.register("target_schools_or_companies")} placeholder="MIT, Google, NASA" />
            </Field>
            <Field label="Preferred difficulty">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("preferred_difficulty")}>
                <option value="beginner">Beginner</option>
                <option value="beginner_intermediate">Beginner-Intermediate</option>
                <option value="intermediate">Intermediate</option>
                <option value="intermediate_advanced">Intermediate-Advanced</option>
              </select>
            </Field>
            <Field label="Constraints">
              <Textarea {...form.register("constraints")} placeholder="Schedule, laptop limits, class load..." />
            </Field>
            <Field label="Additional context">
              <Textarea {...form.register("additional_context")} placeholder="Anything else we should optimize for..." />
            </Field>
          </>
        ) : null}

        {step === 2 && projectTrack === "research" ? (
          <>
            <Field label="Preferred research domain">
              <Input {...form.register("preferred_research_domain")} placeholder="Biology, psychology, economics, CS theory" />
            </Field>
            <Field label="Research/statistics/writing experience">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("research_experience")}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </Field>
            <Field label="Access to mentors/labs/datasets">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("mentor_access")}>
                <option value="none">No meaningful access</option>
                <option value="limited">Some access</option>
                <option value="strong">Strong access</option>
              </select>
            </Field>
            <Field label="Preferred project type">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("methodology_preference")}>
                <option value="literature_review">Literature review</option>
                <option value="experiment">Experiment</option>
                <option value="data_analysis">Data analysis</option>
                <option value="survey_based">Survey-based</option>
                <option value="mixed">Mixed methods</option>
              </select>
            </Field>
            <Field label="Available tools/resources (comma-separated)">
              <Input {...form.register("research_tools_or_resources")} placeholder="Google Scholar, Excel, Python, school library" />
            </Field>
            <Field label="Target final deliverable">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("target_research_deliverable")}>
                <option value="paper">Paper</option>
                <option value="poster">Poster</option>
                <option value="presentation">Presentation</option>
                <option value="competition_submission">Competition submission</option>
                <option value="portfolio_entry">Portfolio entry</option>
              </select>
            </Field>
            <Field label="Data/resource access details (optional)">
              <Textarea {...form.register("data_or_resource_access")} placeholder="Public datasets, school survey permissions, mentor contacts..." />
            </Field>
            <Field label="Constraints">
              <Textarea {...form.register("constraints")} placeholder="No lab access, limited budget, no coding, timeline..." />
            </Field>
            <Field label="Additional context">
              <Textarea {...form.register("additional_context")} placeholder="Anything else we should optimize for..." />
            </Field>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
            disabled={step === 0 || isSubmitting}
          >
            Back
          </Button>

          {step < stepFields.length - 1 ? (
            <Button type="button" onClick={nextStep} disabled={isSubmitting}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={submitFinalStep} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Finish onboarding"}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium text-ink-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TrackOption({
  title,
  description,
  isActive,
  onClick,
}: {
  title: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition ${
        isActive ? "border-mint-500 bg-mint-50" : "border-ink-200 bg-white hover:border-ink-300"
      }`}
    >
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="mt-1 text-xs text-ink-600">{description}</p>
    </button>
  );
}


