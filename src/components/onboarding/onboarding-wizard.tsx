"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldErrors } from "react-hook-form";
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
import { trackClientEvent } from "@/lib/analytics/events";
import { toUserFacingError } from "@/lib/errors/user-messages";
import { cn, toList } from "@/lib/utils";
import { onboardingInputSchema, type OnboardingInput } from "@/lib/validators/onboarding";
import type { LatestOnboardingAnswers } from "@/lib/db/queries/onboarding";
import { studentStageOptions, targetOutcomeOptions } from "@/lib/validators/settings";

function requiredTrackTextIssue(message: string) {
  return {
    code: z.ZodIssueCode.too_small,
    minimum: 2,
    type: "string",
    inclusive: true,
    message,
  } as const;
}

/**
 * Every required free-text answer is measured after trimming, so a field
 * containing only spaces blocks Continue with a visible message instead of
 * passing the client check and failing on the server. The server schema in
 * src/lib/validators/onboarding.ts enforces the same rule independently.
 */
const requiredText = (message: string) => z.string().trim().min(2, message);

const wizardSchema = z.object({
  project_track: z.enum(["software", "research"]),
  student_stage: requiredText("Choose your student stage."),
  target_outcome: z.enum(["college_apps", "internship", "portfolio", "learning"]),
  interests: requiredText("Add at least one interest — spaces alone won't work."),
  favorite_subjects: requiredText("Add at least one subject — spaces alone won't work."),
  weekly_time_available: z.coerce
    .number({ invalid_type_error: "Enter how many hours a week you have." })
    .int("Enter a whole number of hours.")
    .min(1, "Enter at least 1 hour a week.")
    .max(80, "Enter 80 hours a week or fewer."),
  preferred_difficulty: z.enum(["beginner", "intermediate", "advanced"]),

  coding_experience: z.enum(["beginner", "intermediate", "advanced"]),
  preferred_project_style: z.string(),
  known_tools: z.string().optional(),

  preferred_research_domain: z.string(),
  research_experience: z.enum(["beginner", "intermediate", "advanced"]),
  methodology_preference: z.enum(["literature_review", "experiment", "data_analysis", "survey_based", "mixed"]),
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
  lifecycle_emails_enabled: z.boolean(),
}).superRefine((values, context) => {
  // Track-specific fields are only required for the track actually chosen, so
  // they are validated here rather than on the field itself.
  if (values.project_track === "software" && values.preferred_project_style.trim().length < 2) {
    context.addIssue({
      ...requiredTrackTextIssue("Describe the kind of software work you want to do."),
      path: ["preferred_project_style"],
    });
  }

  if (values.project_track === "research" && values.preferred_research_domain.trim().length < 2) {
    context.addIssue({
      ...requiredTrackTextIssue("Name the research domain you want to work in."),
      path: ["preferred_research_domain"],
    });
  }
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
  preferred_difficulty: "intermediate",
  coding_experience: "beginner",
  preferred_project_style: "",
  known_tools: "",
  preferred_research_domain: "",
  research_experience: "beginner",
  methodology_preference: "data_analysis",
  target_research_deliverable: "portfolio_entry",
  data_or_resource_access: "",
  constraints: "",
  additional_context: "",
  lifecycle_emails_enabled: true,
};

const experienceOptions = [
  { value: "beginner", label: "Beginner — I am still learning the basics" },
  { value: "intermediate", label: "Intermediate — I can build with some guidance" },
  { value: "advanced", label: "Advanced — I can work independently" },
] as const;

const researchExperienceOptions = [
  { value: "beginner", label: "Beginner — I am new to structured research" },
  { value: "intermediate", label: "Intermediate — I know the basic process" },
  { value: "advanced", label: "Advanced — I can defend method choices" },
] as const;

const challengeOptions = [
  { value: "beginner", label: "Focused — stay close to what I know" },
  { value: "intermediate", label: "Stretch — teach me new techniques" },
  { value: "advanced", label: "Ambitious — the hardest realistic challenge" },
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

const emptyInitialAnswers: LatestOnboardingAnswers = {
  answersByTrack: {},
  initialProjectTrack: "software",
  profileStudentStage: null,
};

function listToFieldValue(items: string[] | undefined) {
  return items?.join(", ") ?? "";
}

/**
 * Stage is an identity fact, so the profile wins over whatever this track's
 * intake happened to store. Without this, switching tracks silently changed the
 * student's stage and the two tracks generated content about different people.
 */
function getWizardValuesFromStoredAnswers(
  answers: OnboardingInput,
  profileStudentStage: string | null,
): WizardValues {
  const values: WizardValues = {
    ...sharedDefaults,
    project_track: answers.project_track,
    student_stage: profileStudentStage ?? answers.student_stage,
    target_outcome: answers.target_outcome,
    interests: listToFieldValue(answers.interests),
    favorite_subjects: listToFieldValue(answers.favorite_subjects),
    weekly_time_available: answers.weekly_time_available,
    preferred_difficulty: answers.preferred_difficulty,
    constraints: answers.constraints ?? "",
    additional_context: answers.additional_context ?? "",
  };

  if (answers.project_track === "software") {
    return {
      ...values,
      coding_experience: answers.coding_experience,
      preferred_project_style: answers.preferred_project_style,
      known_tools: listToFieldValue(answers.known_tools),
    };
  }

  return {
    ...values,
    preferred_research_domain: answers.preferred_research_domain,
    research_experience: answers.research_experience,
    methodology_preference: answers.methodology_preference,
    target_research_deliverable: answers.target_research_deliverable,
    data_or_resource_access: answers.data_or_resource_access ?? "",
  };
}

function getInitialWizardValues(initialAnswers: LatestOnboardingAnswers): WizardValues {
  const preferredTrack = initialAnswers.initialProjectTrack;
  const storedAnswers =
    initialAnswers.answersByTrack[preferredTrack] ??
    initialAnswers.answersByTrack.software ??
    initialAnswers.answersByTrack.research;

  if (storedAnswers) {
    return getWizardValuesFromStoredAnswers(storedAnswers, initialAnswers.profileStudentStage);
  }

  return {
    ...sharedDefaults,
    project_track: preferredTrack,
    student_stage: initialAnswers.profileStudentStage ?? sharedDefaults.student_stage,
  };
}

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
        "preferred_difficulty",
        "preferred_project_style",
        "known_tools",
      ] as WizardField[],
    },
    {
      key: "constraints",
      title: "Constraints",
      description: "Name the tradeoffs, limits, and critical extra context that will keep your plan honest.",
      fields: ["constraints", "additional_context", "lifecycle_emails_enabled"] as WizardField[],
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
        "preferred_difficulty",
        "methodology_preference",
        "target_research_deliverable",
        "data_or_resource_access",
      ] as WizardField[],
    },
    {
      key: "constraints",
      title: "Constraints",
      description: "Name the tradeoffs, limits, and critical extra context that will keep your plan honest.",
      fields: ["constraints", "additional_context", "lifecycle_emails_enabled"] as WizardField[],
    },
  ],
} as const;

export function OnboardingWizard({
  initialAnswers = emptyInitialAnswers,
  initialLifecycleEmailEnabled = true,
}: {
  initialAnswers?: LatestOnboardingAnswers;
  initialLifecycleEmailEnabled?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialDefaultValues = useMemo(
    () => ({ ...getInitialWizardValues(initialAnswers), lifecycle_emails_enabled: initialLifecycleEmailEnabled }),
    [initialAnswers, initialLifecycleEmailEnabled],
  );
  const savedAnswerValues = useMemo(
    () => ({
      software: initialAnswers.answersByTrack.software
        ? getWizardValuesFromStoredAnswers(
            initialAnswers.answersByTrack.software,
            initialAnswers.profileStudentStage,
          )
        : null,
      research: initialAnswers.answersByTrack.research
        ? getWizardValuesFromStoredAnswers(
            initialAnswers.answersByTrack.research,
            initialAnswers.profileStudentStage,
          )
        : null,
    }),
    [initialAnswers],
  );

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: initialDefaultValues,
  });

  const projectTrack = form.watch("project_track");
  const targetOutcome = form.watch("target_outcome");
  const weeklyTimeAvailable = form.watch("weekly_time_available");
  const preferredDifficulty = form.watch("preferred_difficulty");
  const currentExperience = form.watch(projectTrack === "software" ? "coding_experience" : "research_experience");
  const interests = form.watch("interests");
  const favoriteSubjects = form.watch("favorite_subjects");

  const steps = useMemo(() => stepConfig[projectTrack], [projectTrack]);
  const currentStep = steps[step];

  useEffect(() => {
    trackClientEvent("onboarding_started", {
      project_track: form.getValues("project_track"),
    }).catch(() => undefined);
  }, [form]);

  async function nextStep() {
    const isValid = await form.trigger(currentStep.fields);
    if (isValid) {
      setError(null);
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  function selectProjectTrack(nextProjectTrack: WizardValues["project_track"]) {
    const currentValues = form.getValues();
    if (currentValues.project_track === nextProjectTrack) {
      return;
    }

    const nextValues = savedAnswerValues[nextProjectTrack] ?? {
      ...sharedDefaults,
      ...currentValues,
      project_track: nextProjectTrack,
    };

    form.reset({
      ...nextValues,
      // Track-specific answers are swapped; the student's stage is not one of
      // them. Carrying it across keeps the answer on screen consistent with the
      // profile that both tracks read from.
      student_stage: currentValues.student_stage,
      lifecycle_emails_enabled: currentValues.lifecycle_emails_enabled,
    });
    setError(null);
    setStep(0);
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
        preferred_difficulty: values.preferred_difficulty,
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
            })
          : onboardingInputSchema.parse({
              ...sharedPayload,
              project_track: "research",
              preferred_research_domain: values.preferred_research_domain,
              research_experience: values.research_experience,
              methodology_preference: values.methodology_preference,
              target_research_deliverable: values.target_research_deliverable,
              data_or_resource_access: values.data_or_resource_access,
            });

      const response = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, lifecycle_emails_enabled: values.lifecycle_emails_enabled }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; details?: string } | null;
        setError(toUserFacingError(body?.error, "We couldn't save your answers. Try again in a moment."));
        setIsSubmitting(false);
        return;
      }

      router.push(`/recommendations?track=${values.project_track}`);
      router.refresh();
    } catch (submitError) {
      setError(
        toUserFacingError(submitError, "We couldn't check your answers. Review the form and try again."),
      );
      setIsSubmitting(false);
    }
  }

  /**
   * A required answer can only fail on a step the user has already left (they
   * cleared it, or arrived with stored answers). Send them back to the step that
   * owns the first offending field so the inline message is actually on screen.
   */
  function onInvalid(errors: FieldErrors<WizardValues>) {
    const firstInvalidStep = steps.findIndex((stepItem) =>
      stepItem.fields.some((field) => errors[field]),
    );

    if (firstInvalidStep >= 0 && firstInvalidStep !== step) {
      setStep(firstInvalidStep);
    }

    setError("Some answers still need attention. Check the highlighted fields above.");
  }

  const submitFinalStep = form.handleSubmit(onSubmit, onInvalid);
  const progressValue = step + 1;
  const interestPreview = interests ? toList(interests).slice(0, 3).join(", ") : "Not set yet";
  const subjectPreview = favoriteSubjects ? toList(favoriteSubjects).slice(0, 3).join(", ") : "Not set yet";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
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
                    "rounded-lg border px-3 py-2.5 transition-colors",
                    isActive && "border-primary-line bg-primary-soft",
                    isComplete && "border-line-strong bg-paper",
                    !isActive && !isComplete && "border-line bg-surface text-ink-muted",
                  )}
                >
                  <p className="text-xs text-ink-muted">{isComplete ? "Complete" : `Step ${index + 1}`}</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{stepItem.title}</p>
                </div>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
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
                    <p className="text-sm font-semibold text-ink">
                      Choose your primary track
                      <span className="ml-1 text-coral">
                        *
                      </span>
                    </p>
                    <div role="radiogroup" aria-label="Choose your primary track" className="grid gap-3 md:grid-cols-2">
                      <TrackRadioCard
                        label="Software Project"
                        description="Build and ship a product experience with a believable scope."
                        checked={projectTrack === "software"}
                        checkedColor="navy"
                        onClick={() => selectProjectTrack("software")}
                      />
                      <TrackRadioCard
                        label="Research Project"
                        description="Develop a credible question, method, and evidence plan."
                        checked={projectTrack === "research"}
                        checkedColor="teal"
                        onClick={() => selectProjectTrack("research")}
                      />
                    </div>
                  </div>

                  <FormField
                    label="What do you want this project to help with?"
                    hint="This lets Sevri weight the kind of proof the project should create."
                    required
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
                  <FormField
                    label="Student stage"
                    hint="This one lives on your profile, so it stays the same on both tracks. You can change it any time in Settings."
                    required
                  >
                    <Select {...form.register("student_stage")}>
                      {studentStageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <p className="max-w-2xl text-xs leading-5 text-ink-muted">
                    The following two answers shape idea generation the most, so specific interests and subjects work best.
                  </p>

                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField
                      label="Interests"
                      hint="Comma-separated themes, domains, or problems you keep returning to."
                      error={form.formState.errors.interests?.message}
                      required
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
                      required
                    >
                      <Input {...form.register("favorite_subjects")} placeholder="Math, economics, biology" />
                    </FormField>
                  </div>

                  <FormField
                    label="Weekly time available"
                    hint="Be honest. The best recommendation is the one you can actually follow through with."
                    error={form.formState.errors.weekly_time_available?.message}
                    required
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
                  <FormField
                    label="Current coding experience"
                    hint="Choose what you can do today. This controls how much setup and explanation your roadmap includes."
                    required
                  >
                    <Select {...form.register("coding_experience")}>
                      {experienceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField
                    label="Preferred challenge"
                    hint="Choose how far you want the project to stretch beyond your current experience."
                    required
                  >
                    <Select {...form.register("preferred_difficulty")}>
                      {challengeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField
                    label="Preferred project style"
                    hint="Describe the kind of software work you want to accomplish."
                    error={form.formState.errors.preferred_project_style?.message}
                    required
                  >
                    <Input
                      {...form.register("preferred_project_style")}
                      className="placeholder:text-ink-muted/70"
                      placeholder="web app, workflow tool, embedded project"
                    />
                  </FormField>

                  <FormField
                    label="Known tools"
                    hint="Optional. Include anything you would love to work with."
                  >
                    <Input {...form.register("known_tools")} placeholder="React, Python, SQL" />
                  </FormField>
                </>
              ) : null}

              {currentStep.key === "research_setup" ? (
                <>
                  <FormField
                    label="Preferred research domain"
                    hint="Keep it concrete and specific so that Sevri can develop directions that excite you."
                    error={form.formState.errors.preferred_research_domain?.message}
                    required
                  >
                    <Input
                      {...form.register("preferred_research_domain")}
                      className="placeholder:text-ink-muted/70"
                      placeholder="electrical engineering, neurochemistry, computational biology"
                    />
                  </FormField>

                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField label="Research experience" required>
                      <Select {...form.register("research_experience")}>
                        {researchExperienceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Methodology preference" required>
                      <Select {...form.register("methodology_preference")}>
                        {methodologyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <FormField
                    label="Preferred challenge"
                    hint="Choose how far you want the method and analysis to stretch beyond your current experience."
                    required
                  >
                    <Select {...form.register("preferred_difficulty")}>
                      {challengeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Target final deliverable" required>
                    <Select {...form.register("target_research_deliverable")}>
                      {deliverableOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField
                    label="Data or resource access details"
                    hint="Optional. Mention dataset access, survey permissions, advisor support, or any hard limits."
                  >
                    <Textarea
                      {...form.register("data_or_resource_access")}
                      placeholder="Public datasets only, school survey access, advisor willing to review drafts..."
                    />
                  </FormField>
                </>
              ) : null}

              {currentStep.key === "constraints" ? (
                <>
                  <FormField
                    label="Constraints"
                    hint="Optional. Anything that should keep the plan grounded in reality: schedule, access, budget, obligations."
                  >
                    <Textarea
                      {...form.register("constraints")}
                      placeholder="Class load is heavy on weekdays, $200 budget, limited personal compute, no meaningful lab access..."
                    />
                  </FormField>

                  <FormField
                    label="Additional context"
                    hint="Optional. Add any nuance that should shape the final project comparison board."
                  >
                    <Textarea
                      {...form.register("additional_context")}
                      placeholder="I want something that feels polished and tangible enough for college applications, but I need it to fit around a summer job."
                    />
                  </FormField>

                  <label className="flex items-start gap-3 rounded-xl border border-line bg-surface/50 p-4 text-sm leading-6 text-ink-soft">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-line-strong accent-primary"
                      {...form.register("lifecycle_emails_enabled")}
                    />
                    <span>
                      <strong className="block text-ink">Send me useful project reminders</strong>
                      Get a couple of onboarding nudges and, after you start a project, a coach email if no progress is recorded for 7–14 days. You can turn these off anytime.
                    </span>
                  </label>
                </>
              ) : null}

              {error ? <Alert tone="danger">{error}</Alert> : null}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
                  disabled={step === 0 || isSubmitting}
                >
                  Back
                </Button>

                {step < steps.length - 1 ? (
                  <Button type="button" onClick={nextStep} disabled={isSubmitting}>
                    Continue
                  </Button>
                ) : (
                  <Button type="button" onClick={submitFinalStep} disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Finish onboarding"}
                  </Button>
                )}
              </div>
            </form>
          </motion.div>
        </AnimatePresence>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={projectTrack === "software" ? "accent" : "research"}>
                {projectTrack === "software" ? "Software track" : "Research track"}
              </Badge>
              <Badge tone="neutral">{targetOutcomeLabels[targetOutcome]}</Badge>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-muted">Live summary</p>
              <h2 className="text-lg font-semibold text-ink">
                {projectTrack === "software" ? "Build setup snapshot" : "Research setup snapshot"}
              </h2>
              <p className="text-sm leading-6 text-ink-soft">
                Sevri will use this summary to bias recommendations toward projects that feel ambitious
                enough to matter and scoped enough to finish.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <SummaryItem label="Track" value={projectTrack === "software" ? "Software Project" : "Research Project"} />
              <SummaryItem label="Outcome" value={targetOutcomeLabels[targetOutcome]} />
              <SummaryItem label="Time available" value={`${weeklyTimeAvailable || 0} hours / week`} />
              <SummaryItem
                label="Current experience"
                value={
                  projectTrack === "software"
                    ? experienceOptions.find((option) => option.value === currentExperience)?.label ?? currentExperience
                    : researchExperienceOptions.find((option) => option.value === currentExperience)?.label ?? currentExperience
                }
              />
              <SummaryItem
                label="Preferred challenge"
                value={challengeOptions.find((option) => option.value === preferredDifficulty)?.label ?? preferredDifficulty}
              />
              <SummaryItem label="Interests" value={interestPreview} />
              <SummaryItem label="Subjects" value={subjectPreview} />
            </div>
          </div>
        </Card>

        <Card tone={projectTrack === "research" ? "subtle" : "butter"} className={projectTrack === "research" ? "bg-surface-mint" : undefined} elevation="soft">
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
  checkedColor = "navy",
  onClick,
}: {
  label: string;
  description: string;
  checked: boolean;
  checkedColor?: "navy" | "teal";
  onClick: () => void;
}) {
  const accentVar = checkedColor === "teal" ? "var(--teal-deep)" : "var(--navy)";
  const accentBg = checkedColor === "teal" ? "rgba(68, 194, 199, 0.12)" : "rgba(11, 30, 77, 0.07)";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-5 text-left transition-all duration-200",
        checked ? "border-primary/25 shadow-soft" : "border-line bg-surface/35 hover:-translate-y-0.5 hover:border-line-strong hover:bg-paper hover:shadow-soft",
      )}
      style={checked ? { backgroundColor: accentBg } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-ink">{label}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
        </div>
        <span
          className="mt-1 h-5 w-5 rounded-full border border-line-strong ring-4 ring-paper"
          style={checked ? { backgroundColor: accentVar } : { backgroundColor: 'var(--paper)' }}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}
