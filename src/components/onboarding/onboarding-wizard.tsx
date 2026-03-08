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
  full_name: z.string().min(2),
  student_stage: z.string().min(2),
  target_outcome: z.enum(["college_apps", "internship", "portfolio", "learning"]),
  interests: z.string().min(2),
  favorite_subjects: z.string().min(2),
  coding_experience: z.enum(["beginner", "intermediate", "advanced"]),
  weekly_time_available: z.coerce.number().int().min(1).max(80),
  preferred_project_style: z.string().min(2),
  known_tools: z.string().optional(),
  target_schools_or_companies: z.string().optional(),
  preferred_difficulty: z.enum(["beginner", "beginner_intermediate", "intermediate", "intermediate_advanced"]),
  constraints: z.string().optional(),
  additional_context: z.string().optional(),
});

type WizardValues = z.infer<typeof wizardSchema>;

const stepFields: Array<Array<keyof WizardValues>> = [
  ["full_name", "student_stage", "target_outcome"],
  ["interests", "favorite_subjects", "coding_experience", "weekly_time_available"],
  [
    "preferred_project_style",
    "known_tools",
    "target_schools_or_companies",
    "preferred_difficulty",
    "constraints",
    "additional_context",
  ],
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/events/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "onboarding_started" }),
    }).catch(() => undefined);
  }, []);

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      full_name: "",
      student_stage: "high_school_junior",
      target_outcome: "portfolio",
      interests: "",
      favorite_subjects: "",
      coding_experience: "beginner",
      weekly_time_available: 6,
      preferred_project_style: "",
      known_tools: "",
      target_schools_or_companies: "",
      preferred_difficulty: "beginner_intermediate",
      constraints: "",
      additional_context: "",
    },
  });

  const progress = useMemo(() => ((step + 1) / stepFields.length) * 100, [step]);

  async function nextStep() {
    const isValid = await form.trigger(stepFields[step]);
    if (isValid) {
      setStep((prev) => Math.min(prev + 1, stepFields.length - 1));
    }
  }

  async function onSubmit(values: WizardValues) {
    setError(null);
    setIsSubmitting(true);

    const payload = onboardingInputSchema.parse({
      ...values,
      interests: toList(values.interests),
      favorite_subjects: toList(values.favorite_subjects),
      known_tools: toList(values.known_tools ?? ""),
      target_schools_or_companies: toList(values.target_schools_or_companies ?? ""),
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
  }

  const submitFinalStep = form.handleSubmit(onSubmit);

  return (
    <Card className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-ink-700">Onboarding</p>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">Build your Sevri profile</h1>
        <p className="mt-1 text-sm text-ink-600">We use this to generate a realistic project you can finish.</p>
      </div>

      <div className="h-2 w-full rounded-full bg-ink-100">
        <div className="h-2 rounded-full bg-mint-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        {step === 0 ? (
          <>
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
            <Field label="Technical interests (comma-separated)">
              <Input {...form.register("interests")} placeholder="AI, productivity, climate" />
            </Field>
            <Field label="Favorite subjects/domains (comma-separated)">
              <Input {...form.register("favorite_subjects")} placeholder="Math, economics, biology" />
            </Field>
            <Field label="Coding experience">
              <select className="w-full rounded-md border border-ink-200 px-3 py-2" {...form.register("coding_experience")}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </Field>
            <Field label="Weekly time available (hours)">
              <Input type="number" min={1} max={80} {...form.register("weekly_time_available", { valueAsNumber: true })} />
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
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

