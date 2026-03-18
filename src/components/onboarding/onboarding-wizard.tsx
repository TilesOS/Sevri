"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, toList } from "@/lib/utils";
import { onboardingInputSchema } from "@/lib/validators/onboarding";
import { studentStageOptions, targetOutcomeOptions } from "@/lib/validators/settings";

const wizardSchema = z.object({
  project_track: z.enum(["software", "research"]),
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

const sharedDefaults: WizardValues = {
  project_track: "software",
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
};

const experienceOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

const difficultyOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "beginner_intermediate", label: "Beginner-Intermediate" },
  { value: "intermediate", label: "Intermediate" },
  { value: "intermediate_advanced", label: "Intermediate-Advanced" },
] as const;

const mentorAccessOptions = [
  { value: "none", label: "No meaningful access" },
  { value: "limited", label: "Some access" },
  { value: "strong", label: "Strong access" },
] as const;

const methodologyOptions = [
  { value: "literature_review", label: "Literature review" },
  { value: "experiment", label: "Experiment" },
  { value: "data_analysis", label: "Data analysis" },
  { value: "survey_based", label: "Survey-based" },
  { value: "mixed", label: "Mixed methods" },
] as const;

const deliverableOptions = [
  { value: "paper", label: "Paper" },
  { value: "poster", label: "Poster" },
  { value: "presentation", label: "Presentation" },
  { value: "competition_submission", label: "Competition submission" },
  { value: "portfolio_entry", label: "Portfolio entry" },
] as const;

const targetOutcomeLabels = Object.fromEntries(
  targetOutcomeOptions.map((option) => [option.value, option.label]),
) as Record<WizardValues["target_outcome"], string>;

const stepConfig = {
  software: [
    {
      key: "direction",
      title: "Direction",
      description: "Choose the type of proof you want to create and what you want it to help with.",
      fields: ["project_track", "target_outcome"] as WizardField[],
    },
    {
      key: "profile",
      title: "Profile",
      description: "Give Sevri the context it needs about your interests, stage, and available time.",
      fields: ["student_stage", "interests", "favorite_subjects", "weekly_time_available"] as WizardField[],
    },
    {
      key: "build_setup",
      title: "Build Setup",
      description: "Ground the project in your current tools, skill level, and appetite for difficulty.",
      fields: [
        "coding_experience",
        "preferred_project_style",
        "known_tools",
        "target_schools_or_companies",
        "preferred_difficulty",
      ] as WizardField[],
    },
    {
      key: "constraints",
      title: "Constraints",
      description: "Name the tradeoffs, limits, and extra context that should keep the plan honest.",
      fields: ["constraints", "additional_context"] as WizardField[],
    },
  ],
  research: [
    {
      key: "direction",
      title: "Direction",
      description: "Choose the type of proof you want to create and what you want it to help with.",
      fields: ["project_track", "target_outcome"] as WizardField[],
    },
    {
      key: "profile",
      title: "Profile",
      description: "Give Sevri the context it needs about your interests, stage, and available time.",
      fields: ["student_stage", "interests", "favorite_subjects", "weekly_time_available"] as WizardField[],
    },
    {
      key: "research_setup",
      title: "Research Setup",
      description: "Clarify your research domain, methodology preferences, and what resources are actually available.",
      fields: [
        "preferred_research_domain",
        "research_experience",
        "mentor_access",
        "methodology_preference",
        "research_tools_or_resources",
        "target_research_deliverable",
        "data_or_resource_access",
      ] as WizardField[],
    },
    {
      key: "constraints",
      title: "Constraints",
      description: "Name the tradeoffs, limits, and extra context that should keep the plan honest.",
      fields: ["constraints", "additional_context"] as WizardField[],
    },
  ],
} as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: sharedDefaults,
  });

  const projectTrack = form.watch("project_track");
  const targetOutcome = form.watch("target_outcome");
  const weeklyTimeAvailable = form.watch("weekly_time_available");
  const interests = form.watch("interests");
  const favoriteSubjects = form.watch("favorite_subjects");

  const steps = useMemo(() => stepConfig[projectTrack], [projectTrack]);
  const currentStep = steps[step];

  useEffect(() => {
    fetch("/api/events/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "onboarding_started",
        metadata: { project_track: form.getValues("project_track") },
      }),
    }).catch(() => undefined);
  }, [form]);

  async function nextStep() {
    const isValid = await form.trigger(currentStep.fields);
    if (isValid) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  async function onSubmit(values: WizardValues) {
    setError(null);
    setIsSubmitting(true);

    try {
      const sharedPayload = {
        project_track: values.project_track,
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

      router.push(`/recommendations?track=${values.project_track}`);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to validate onboarding answers.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  const submitFinalStep = form.handleSubmit(onSubmit);
  const progressValue = step + 1;
  const interestPreview = interests ? toList(interests).slice(0, 3).join(", ") : "Not set yet";
  const subjectPreview = favoriteSubjects ? toList(favoriteSubjects).slice(0, 3).join(", ") : "Not set yet";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
      <Card className="space-y-6">
        <div aria-live="polite" className="sr-only">
          {error ?? (isSubmitting ? "Saving onboarding." : "")}
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="accent">Onboarding wizard</Badge>
            <Badge tone={projectTrack === "software" ? "software" : "research"}>
              {projectTrack === "software" ? "Software track" : "Research track"}
            </Badge>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-4xl leading-none text-ink sm:text-5xl">
              Choose the direction you can actually carry.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-ink-soft">
              Sevri will use these answers to build a sharper comparison board. The goal is not to collect everything about you, only the context that changes what a finishable project looks like.
            </p>
          </div>

          <ProgressBar
            value={progressValue}
            max={steps.length}
            label={`Step ${progressValue} of ${steps.length}`}
            helperText={currentStep.description}
          />

          <div className="grid gap-3 sm:grid-cols-4">
            {steps.map((stepItem, index) => {
              const isActive = index === step;
              const isComplete = index < step;

              return (
                <div
                  key={stepItem.key}
                  className={cn(
                    "rounded-xl border px-4 py-3",
                    isActive
                      ? "border-line-strong bg-paper"
                      : isComplete
                        ? "border-primary-line bg-primary-soft"
                        : "border-line bg-surface/45",
                  )}
                >
                  <p className="editorial-kicker">{isComplete ? "Complete" : `Step ${index + 1}`}</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{stepItem.title}</p>
                </div>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep.key}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <p className="editorial-kicker">{currentStep.title}</p>
              <h2 className="text-2xl font-semibold text-ink">{currentStep.description}</h2>
            </div>

            <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
              {currentStep.key === "direction" ? (
                <>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-ink">Choose your primary track</p>
                    <div role="radiogroup" aria-label="Choose your primary track" className="grid gap-3 md:grid-cols-2">
                      <TrackRadioCard
                        label="Software Project"
                        description="Build and ship a product experience with a believable scope."
                        checked={projectTrack === "software"}
                        onClick={() => form.setValue("project_track", "software", { shouldValidate: true })}
                      />
                      <TrackRadioCard
                        label="Research Project"
                        description="Develop a credible question, method, and evidence plan."
                        checked={projectTrack === "research"}
                        onClick={() => form.setValue("project_track", "research", { shouldValidate: true })}
                      />
                    </div>
                  </div>

                  <FormField
                    label="What do you want this project to help with?"
                    hint="This lets Sevri weight the kind of proof the project should create."
                  >
                    <Select {...form.register("target_outcome")}>
                      {targetOutcomeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </>
              ) : null}

              {currentStep.key === "profile" ? (
                <>
                  <FormField label="Student stage" hint="Sevri uses this to calibrate ambition versus realism.">
                    <Select {...form.register("student_stage")}>
                      {studentStageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField
                      label="Interests"
                      hint="Comma-separated themes, domains, or problems you keep returning to."
                      error={form.formState.errors.interests?.message}
                    >
                      <Input
                        {...form.register("interests")}
                        placeholder={projectTrack === "software" ? "AI, climate, education" : "health, behavior, policy"}
                      />
                    </FormField>

                    <FormField
                      label="Favorite subjects"
                      hint="Comma-separated classes or fields that feel energizing."
                      error={form.formState.errors.favorite_subjects?.message}
                    >
                      <Input {...form.register("favorite_subjects")} placeholder="Math, economics, biology" />
                    </FormField>
                  </div>

                  <FormField
                    label="Weekly time available"
                    hint="Be honest. The best recommendation is the one you can actually carry."
                    error={form.formState.errors.weekly_time_available?.message}
                  >
                    <Input
                      type="number"
                      min={1}
                      max={80}
                      {...form.register("weekly_time_available", { valueAsNumber: true })}
                    />
                  </FormField>
                </>
              ) : null}

              {currentStep.key === "build_setup" ? (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField label="Coding experience">
                      <Select {...form.register("coding_experience")}>
                        {experienceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField
                      label="Preferred difficulty"
                      hint="This helps Sevri choose ambition you can still finish."
                    >
                      <Select {...form.register("preferred_difficulty")}>
                        {difficultyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <FormField
                    label="Preferred project style"
                    hint="Describe the kind of software work you want to be known for."
                    error={form.formState.errors.preferred_project_style?.message}
                  >
                    <Input {...form.register("preferred_project_style")} placeholder="web app, AI tool, automation" />
                  </FormField>

                  <FormField
                    label="Known tools"
                    hint="Comma-separated. Include anything you would realistically use."
                  >
                    <Input {...form.register("known_tools")} placeholder="React, Python, SQL" />
                  </FormField>

                  <FormField
                    label="Target schools or companies"
                    hint="Optional. Use this if you already know what kind of environment you want to be legible to."
                  >
                    <Input {...form.register("target_schools_or_companies")} placeholder="MIT, Google, NASA" />
                  </FormField>
                </>
              ) : null}

              {currentStep.key === "research_setup" ? (
                <>
                  <FormField
                    label="Preferred research domain"
                    hint="Keep it concrete enough that Sevri can make real tradeoffs."
                    error={form.formState.errors.preferred_research_domain?.message}
                  >
                    <Input
                      {...form.register("preferred_research_domain")}
                      placeholder="Biology, psychology, economics, CS theory"
                    />
                  </FormField>

                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField label="Research experience">
                      <Select {...form.register("research_experience")}>
                        {experienceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Mentor or resource access">
                      <Select {...form.register("mentor_access")}>
                        {mentorAccessOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField label="Methodology preference">
                      <Select {...form.register("methodology_preference")}>
                        {methodologyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Target final deliverable">
                      <Select {...form.register("target_research_deliverable")}>
                        {deliverableOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <FormField
                    label="Available tools or resources"
                    hint="Comma-separated. List anything that materially changes what research is realistic."
                  >
                    <Input
                      {...form.register("research_tools_or_resources")}
                      placeholder="Google Scholar, Excel, school library, public datasets"
                    />
                  </FormField>

                  <FormField
                    label="Data or resource access details"
                    hint="Optional. Mention survey permissions, lab access, mentors, or special constraints."
                  >
                    <Textarea
                      {...form.register("data_or_resource_access")}
                      placeholder="Public datasets only, survey access through a school club, mentor willing to review drafts..."
                    />
                  </FormField>
                </>
              ) : null}

              {currentStep.key === "constraints" ? (
                <>
                  <FormField
                    label="Constraints"
                    hint="Anything that should keep the plan grounded: schedule, hardware, access, budget, energy, obligations."
                  >
                    <Textarea
                      {...form.register("constraints")}
                      placeholder="Class load is heavy on weekdays, no budget, limited laptop power, no lab access..."
                    />
                  </FormField>

                  <FormField
                    label="Additional context"
                    hint="Optional. Add any nuance that should shape the final comparison board."
                  >
                    <Textarea
                      {...form.register("additional_context")}
                      placeholder="I want something that feels polished enough for a summer application, but I still need it to fit around exams."
                    />
                  </FormField>
                </>
              ) : null}

              {error ? <Alert tone="danger">{error}</Alert> : null}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
                  disabled={step === 0 || isSubmitting}
                  className="rounded-full"
                >
                  Back
                </Button>

                {step < steps.length - 1 ? (
                  <Button type="button" onClick={nextStep} disabled={isSubmitting} className="rounded-full px-6">
                    Continue
                  </Button>
                ) : (
                  <Button type="button" onClick={submitFinalStep} disabled={isSubmitting} className="rounded-full px-6">
                    {isSubmitting ? "Saving..." : "Finish onboarding"}
                  </Button>
                )}
              </div>
            </form>
          </motion.div>
        </AnimatePresence>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-28">
        <Card tone="contrast" className="border-contrast-line">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={projectTrack === "software" ? "accent" : "research"}>
                {projectTrack === "software" ? "Software track" : "Research track"}
              </Badge>
              <Badge tone="contrast">{targetOutcomeLabels[targetOutcome]}</Badge>
            </div>
            <div className="space-y-2">
              <p className="editorial-kicker text-paper/55">Live summary</p>
              <h2 className="text-3xl font-semibold text-paper">
                {projectTrack === "software" ? "Build setup snapshot" : "Research setup snapshot"}
              </h2>
              <p className="text-sm leading-6 text-paper/72">
                Sevri will use this summary to bias recommendations toward projects that feel ambitious
                enough to matter and scoped enough to finish.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <SummaryItem label="Track" value={projectTrack === "software" ? "Software Project" : "Research Project"} />
              <SummaryItem label="Outcome" value={targetOutcomeLabels[targetOutcome]} />
              <SummaryItem label="Time available" value={`${weeklyTimeAvailable || 0} hours / week`} />
              <SummaryItem label="Interests" value={interestPreview} />
              <SummaryItem label="Subjects" value={subjectPreview} />
            </div>
          </div>
        </Card>

        <Card tone={projectTrack === "research" ? "blush" : "primary"}>
          <p className="editorial-kicker">What Sevri will optimize for</p>
          <p className="mt-3 text-lg font-semibold text-ink">
            {projectTrack === "software"
              ? "A project with a believable user, problem, and workflow."
              : "A research direction with a believable question, method, and evidence plan."}
          </p>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            The strongest recommendation is not the most theatrical one. It is the one that can still
            look thoughtful when you are busy, tired, and halfway through the semester.
          </p>
        </Card>
      </div>
    </div>
  );
}

function TrackRadioCard({
  label,
  description,
  checked,
  onClick,
}: {
  label: string;
  description: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-5 text-left transition",
        checked ? "border-primary-line bg-primary-soft" : "border-line bg-surface/35 hover:border-line-strong hover:bg-paper",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-ink">{label}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
        </div>
        <span
          className={cn(
            "mt-1 h-5 w-5 rounded-full border",
            checked ? "border-primary bg-primary" : "border-line-strong bg-paper",
          )}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-contrast-line bg-paper/6 p-4">
      <p className="editorial-kicker text-paper/55">{label}</p>
      <p className="mt-2 text-sm leading-6 text-paper">{value}</p>
    </div>
  );
}
