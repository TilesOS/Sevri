"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
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
import type { LatestOnboardingAnswers } from "@/lib/db/queries/onboarding";
import { projectGoalOptions, studentStageOptions } from "@/lib/validators/settings";
import type { ProjectFormatPreference } from "@/lib/validators/onboarding";

const DRAFT_KEY = "sevri:universal-onboarding:draft";

const wizardSchema = z.object({
  student_stage: z.string().trim().min(2, "Choose your student stage."),
  interests: z.string().trim().min(2, "Add at least one interest."),
  favorite_subjects: z.string().trim().min(2, "Add at least one favorite subject."),
  project_goal: z.enum([
    "learning", "portfolio", "college_applications", "internship_or_job", "class_or_capstone",
    "competition", "community_impact", "personal", "other",
  ]),
  success_definition: z.string().trim().min(10, "Describe what success would look like for you.").max(500),
  open_to_anything: z.boolean(),
  format_preferences: z.array(z.enum(["physical", "digital", "investigative", "creative", "community", "venture"])),
  preference_notes: z.string().max(500),
  experience_level: z.enum(["beginner", "intermediate", "advanced"]),
  existing_skills: z.string(),
  available_resources: z.string().max(1000),
  weekly_time_available: z.coerce.number().int().min(1).max(80),
  completion_date: z.string(),
  budget_constraints: z.string().max(500),
  preferred_challenge: z.enum(["beginner", "intermediate", "advanced"]),
  other_constraints: z.string().max(1000),
  lifecycle_emails_enabled: z.boolean(),
}).superRefine((value, context) => {
  if (!value.open_to_anything && value.format_preferences.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["format_preferences"],
      message: "Choose at least one format, or stay open to anything.",
    });
  }
});

type WizardValues = z.infer<typeof wizardSchema>;
type WizardField = keyof WizardValues;

const steps: Array<{ key: string; title: string; description: string; fields: WizardField[] }> = [
  {
    key: "interests",
    title: "Interests",
    description: "Start with what keeps pulling your attention.",
    fields: ["student_stage", "interests", "favorite_subjects"],
  },
  {
    key: "purpose",
    title: "Purpose",
    description: "Name why this project matters to you.",
    fields: ["project_goal", "success_definition"],
  },
  {
    key: "shape",
    title: "Shape",
    description: "Stay open, or point Sevri toward formats you want to explore.",
    fields: ["open_to_anything", "format_preferences", "preference_notes"],
  },
  {
    key: "reality",
    title: "Reality check",
    description: "Give the plan honest limits so it can be finishable.",
    fields: [
      "experience_level", "existing_skills", "available_resources", "weekly_time_available",
      "completion_date", "budget_constraints", "preferred_challenge", "other_constraints",
      "lifecycle_emails_enabled",
    ],
  },
];

const draftSchema = z.object({
  step: z.number().int().min(0).max(steps.length - 1),
  values: wizardSchema,
});

const formats: Array<{ value: ProjectFormatPreference; label: string; description: string }> = [
  { value: "physical", label: "Physical", description: "Build, fabricate, assemble, or prototype." },
  { value: "digital", label: "Digital", description: "Create software, media, data, or interactive work." },
  { value: "investigative", label: "Investigative", description: "Study a question through evidence and analysis." },
  { value: "creative", label: "Creative", description: "Make expressive work for an audience." },
  { value: "community", label: "Community", description: "Organize people around a useful outcome." },
  { value: "venture", label: "Venture", description: "Test an offer, service, or small enterprise." },
];

const experienceOptions = [
  { value: "beginner", label: "Beginner — I am learning the basics" },
  { value: "intermediate", label: "Intermediate — I can work with some guidance" },
  { value: "advanced", label: "Advanced — I can work independently" },
] as const;

const challengeOptions = [
  { value: "beginner", label: "Focused — stay narrow and complete the proof loop" },
  { value: "intermediate", label: "Stretch — learn one important new technique" },
  { value: "advanced", label: "Ambitious — take on the hardest realistic version" },
] as const;

function defaultsFromAnswers(initial: LatestOnboardingAnswers, emailEnabled: boolean): WizardValues {
  const answer = initial.answers;
  return {
    student_stage: initial.profileStudentStage ?? answer?.student_stage ?? "high_school_junior",
    interests: answer?.interests.join(", ") ?? "",
    favorite_subjects: answer?.favorite_subjects.join(", ") ?? "",
    project_goal: answer?.project_goal ?? "portfolio",
    success_definition: answer?.success_definition ?? "",
    open_to_anything: answer?.open_to_anything ?? true,
    format_preferences: answer?.format_preferences ?? [],
    preference_notes: answer?.preference_notes ?? "",
    experience_level: answer?.experience_level ?? "beginner",
    existing_skills: answer?.existing_skills.join(", ") ?? "",
    available_resources: answer?.available_resources ?? "",
    weekly_time_available: answer?.weekly_time_available ?? 6,
    completion_date: answer?.completion_date ?? "",
    budget_constraints: answer?.budget_constraints ?? "",
    preferred_challenge: answer?.preferred_challenge ?? "intermediate",
    other_constraints: answer?.other_constraints ?? "",
    lifecycle_emails_enabled: emailEnabled,
  };
}

export function OnboardingWizard({
  initialAnswers,
  initialLifecycleEmailEnabled = true,
}: {
  initialAnswers: LatestOnboardingAnswers;
  initialLifecycleEmailEnabled?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const serverDefaults = useMemo(
    () => defaultsFromAnswers(initialAnswers, initialLifecycleEmailEnabled),
    [initialAnswers, initialLifecycleEmailEnabled],
  );
  const form = useForm<WizardValues>({ resolver: zodResolver(wizardSchema), defaultValues: serverDefaults });
  const openToAnything = form.watch("open_to_anything");
  const selectedFormats = form.watch("format_preferences");

  useEffect(() => {
    const draft = window.localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = draftSchema.safeParse(JSON.parse(draft));
        if (parsed.success) {
          form.reset(parsed.data.values);
          setStep(parsed.data.step);
        } else {
          window.localStorage.removeItem(DRAFT_KEY);
        }
      } catch {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    }
    setDraftLoaded(true);
    trackClientEvent("onboarding_started", { flow: "universal" }).catch(() => undefined);
  }, [form]);

  useEffect(() => {
    if (!draftLoaded) return;
    const subscription = form.watch((values) => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, values }));
    });
    return () => subscription.unsubscribe();
  }, [draftLoaded, form, step]);

  useEffect(() => {
    if (draftLoaded) {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, values: form.getValues() }));
    }
  }, [draftLoaded, form, step]);

  async function nextStep() {
    if (await form.trigger(steps[step].fields)) {
      setError(null);
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  function toggleFormat(format: ProjectFormatPreference) {
    const next = selectedFormats.includes(format)
      ? selectedFormats.filter((item) => item !== format)
      : [...selectedFormats, format];
    form.setValue("format_preferences", next, { shouldValidate: true, shouldDirty: true });
  }

  async function submit(values: WizardValues) {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          interests: toList(values.interests),
          favorite_subjects: toList(values.favorite_subjects),
          existing_skills: toList(values.existing_skills),
          format_preferences: values.open_to_anything ? [] : values.format_preferences,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save onboarding.");
      window.localStorage.removeItem(DRAFT_KEY);
      await trackClientEvent("onboarding_completed", { flow: "universal" }).catch(() => undefined);
      router.push("/recommendations");
      router.refresh();
    } catch (submissionError) {
      setError(toUserFacingError(submissionError, "We couldn't save your answers. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const current = steps[step];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Find your project
          </div>
          <ProgressBar value={step + 1} max={steps.length} label={`Step ${step + 1} of ${steps.length}`} />
          <ol className="grid grid-cols-4 gap-2 lg:grid-cols-1" aria-label="Onboarding steps">
            {steps.map((item, index) => (
              <li key={item.key} className={cn("text-xs lg:text-sm", index === step ? "font-semibold text-ink" : "text-ink-muted")}>
                <span className="mr-2 hidden text-primary lg:inline">{index < step ? "✓" : `${index + 1}.`}</span>
                {item.title}
              </li>
            ))}
          </ol>
          <p className="hidden text-sm leading-6 text-ink-muted lg:block">
            Your answers guide the comparison. They never lock you into a project type.
          </p>
        </aside>

        <Card padding="lg" elevation="soft" className="min-h-[34rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-7"
            >
              <header className="max-w-2xl space-y-2">
                <p className="editorial-kicker">{current.title}</p>
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">{current.description}</h1>
              </header>

              <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
                {current.key === "interests" ? <>
                  <FormField label="Student stage" required error={form.formState.errors.student_stage?.message}>
                    <Select {...form.register("student_stage")}>
                      {studentStageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </FormField>
                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField label="Interests" required hint="Themes, problems, communities, or materials you keep returning to." error={form.formState.errors.interests?.message}>
                      <Input {...form.register("interests")} placeholder="Robotics, documentary film, local history" />
                    </FormField>
                    <FormField label="Favorite subjects" required hint="Classes or fields that make you want to go deeper." error={form.formState.errors.favorite_subjects?.message}>
                      <Input {...form.register("favorite_subjects")} placeholder="Physics, studio art, literature" />
                    </FormField>
                  </div>
                </> : null}

                {current.key === "purpose" ? <>
                  <FormField label="Primary goal" required>
                    <Select {...form.register("project_goal")}>
                      {projectGoalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="What would make this project a success for you?" required hint="Use your own definition—not what sounds impressive." error={form.formState.errors.success_definition?.message}>
                    <Textarea {...form.register("success_definition")} placeholder="I can show a finished artifact, explain the choices I made, and get useful feedback from…" />
                  </FormField>
                </> : null}

                {current.key === "shape" ? <>
                  <button
                    type="button"
                    aria-pressed={openToAnything}
                    onClick={() => form.setValue("open_to_anything", true, { shouldValidate: true })}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl p-5 text-left transition-colors",
                      openToAnything ? "bg-primary-soft text-ink" : "bg-surface/70 text-ink hover:bg-surface",
                    )}
                  >
                    <span className={cn("mt-0.5 grid h-5 w-5 place-items-center rounded-full border", openToAnything ? "border-primary bg-primary text-white" : "border-line-strong")}>
                      {openToAnything ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                    </span>
                    <span><span className="block font-semibold">Open to anything</span><span className="mt-1 block text-sm text-ink-muted">Give me three genuinely different ways to turn my interests into finished work.</span></span>
                  </button>
                  <div className="flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="text-xs font-medium text-ink-muted">or guide the mix</span><span className="h-px flex-1 bg-line" /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {formats.map((format) => {
                      const selected = !openToAnything && selectedFormats.includes(format.value);
                      return <button key={format.value} type="button" aria-pressed={selected} onClick={() => { form.setValue("open_to_anything", false, { shouldValidate: true }); toggleFormat(format.value); }} className={cn("rounded-xl p-4 text-left transition-colors", selected ? "bg-primary text-primary-foreground" : "bg-surface/70 text-ink hover:bg-surface") }>
                        <span className="font-semibold">{format.label}</span><span className={cn("mt-1 block text-sm", selected ? "text-primary-foreground/80" : "text-ink-muted")}>{format.description}</span>
                      </button>;
                    })}
                  </div>
                  {form.formState.errors.format_preferences?.message ? <p className="text-sm text-red-600">{form.formState.errors.format_preferences.message}</p> : null}
                  <FormField label="Preference notes" hint="Optional. Hybrid ideas are welcome."><Textarea {...form.register("preference_notes")} placeholder="I would love something physical that also has a digital storytelling layer…" /></FormField>
                </> : null}

                {current.key === "reality" ? <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField label="General experience" required><Select {...form.register("experience_level")}>{experienceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></FormField>
                    <FormField label="Preferred challenge" required><Select {...form.register("preferred_challenge")}>{challengeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></FormField>
                  </div>
                  <FormField label="Skills you already have" hint="Optional, comma separated."><Input {...form.register("existing_skills")} placeholder="Soldering, interviewing, illustration, Python" /></FormField>
                  <FormField label="Tools, materials, facilities, or people you can access" hint="Optional. Never assume access you do not have."><Textarea {...form.register("available_resources")} placeholder="School makerspace with supervision, phone camera, public library archives…" /></FormField>
                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField label="Hours per week" required error={form.formState.errors.weekly_time_available?.message}><Input type="number" min={1} max={80} {...form.register("weekly_time_available", { valueAsNumber: true })} /></FormField>
                    <FormField label="Ideal completion date" hint="Optional."><Input type="date" {...form.register("completion_date")} /></FormField>
                  </div>
                  <FormField label="Budget or access constraints" hint="Optional."><Input {...form.register("budget_constraints")} placeholder="$75 maximum, public transit only, no paid software…" /></FormField>
                  <FormField label="Anything else the plan must respect?" hint="Optional. Include safety, schedule, privacy, class, or competition requirements."><Textarea {...form.register("other_constraints")} /></FormField>
                  <label className="flex items-start gap-3 rounded-xl bg-surface/70 p-4 text-sm text-ink">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" {...form.register("lifecycle_emails_enabled")} />
                    <span><span className="font-semibold">Email me useful project nudges</span><span className="mt-1 block text-ink-muted">Progress reminders and coaching notes. You can change this in Settings.</span></span>
                  </label>
                </> : null}

                {error ? <Alert tone="danger">{error}</Alert> : null}
                <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
                  <Button variant="ghost" onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))} disabled={step === 0 || isSubmitting} leadingIcon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
                  {step < steps.length - 1 ? <Button onClick={nextStep} trailingIcon={<ArrowRight className="h-4 w-4" />}>Continue</Button> : <Button type="submit" disabled={isSubmitting} trailingIcon={<ArrowRight className="h-4 w-4" />}>{isSubmitting ? "Building your context…" : "Compare project directions"}</Button>}
                </div>
              </form>
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>
    </main>
  );
}
